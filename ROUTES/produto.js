const express = require('express');
const router = express.Router();
const db = require('../db');
 
// ─────────────────────────────────────────────
// ETAPA 6 - GET /listar
// Lista todos os produtos da tabela
// ─────────────────────────────────────────────
router.get('/listar', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM produtos');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});
 
 
// ─────────────────────────────────────────────
// ETAPA 7 - POST /criar
// Cria um novo produto com validações
// ─────────────────────────────────────────────
router.post('/criarproduto', async (req, res) => {
    const { nome, valor, quantidade, categoria } = req.body;
 
    if (!nome || valor === undefined || quantidade === undefined || !categoria) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios: nome, valor, quantidade, categoria' });
    }
 
    try {
        const [result] = await db.query(
            'INSERT INTO produtos (nome, valor, quantidade, categoria) VALUES (?, ?, ?, ?)',
            [nome, valor, quantidade, categoria]
        );
        console.log('Produto criado com sucesso',
            'nome:', nome,
            'valor:', valor,
            'quantidade:', quantidade,
            'categoria:', categoria);
        res.status(201).json({ id: result.insertId, nome, valor, quantidade, categoria });
    } catch (error) {
        console.error('Erro ao criar produto:', error.message);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});
// ─────────────────────────────────────────────
// ETAPA 8 - GET /registrar-entrada
// Registrar entrada de produtos no estoque (api)
// ─────────────────────────────────────────────
router.post('/registrar-entrada', async (req, res) => {
    const { produtos_id, quantidade, dt } = req.body;

    if (produtos_id === undefined || quantidade === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: produtos_id, quantidade' });
    }

    const qty = parseInt(quantidade, 10);
    if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'quantidade deve ser um inteiro positivo' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Bloqueia a linha do produto para evitar race conditions
        const [prodRows] = await conn.query('SELECT quantidade FROM produtos WHERE id = ? FOR UPDATE', [produtos_id]);
        if (prodRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const currentQty = prodRows[0].quantidade;
        const newQty = currentQty + qty;
        const insertDt = dt ? dt : new Date();

        // Insere a movimentação como entrada
        const [insertResult] = await conn.query(
            'INSERT INTO movimentacoes (dt, tipo, quantidade, produtos_id) VALUES (?, ?, ?, ?)',
            [insertDt, 'entrada', qty, produtos_id]
        );

        // Atualiza o estoque do produtoa
        await conn.query('UPDATE produtos SET quantidade = ? WHERE id = ?', [newQty, produtos_id]);

        await conn.commit();

        console.log(`Entrada registrada: id_mov=${insertResult.insertId} | produtos_id=${produtos_id} | quantidade_entrada=${qty} | nova_quantidade=${newQty}`);

        res.status(201).json({
            message: 'Entrada registrada com sucesso',
            id_movimentacao: insertResult.insertId,
            produto_id: produtos_id,
            nova_quantidade: newQty
        });
    } catch (error) {
        await conn.rollback().catch(() => {});
        console.error('Erro ao registrar entrada:', error.message);
        res.status(500).json({ error: 'Erro ao registrar entrada' });
    } finally {
        conn.release();
    }
}); 
// ─────────────────────────────────────────────
// ETAPA 9 - GET /valor-por-categoria
// Retorna o valor total (valor * quantidade) agrupado por categoria
// Aceita filtro opcional por categorias via query param: ?categorias=A,B
// ─────────────────────────────────────────────
router.get('/valor-por-categoria', async (req, res) => {
    try {
        const categoriasQuery = req.query.categorias;
        let categorias = [];
        if (categoriasQuery) {
            categorias = categoriasQuery.split(',').map(s => s.trim()).filter(Boolean);
        }
 
        let sql = 'SELECT categoria, SUM(valor * quantidade) AS total_valor FROM produtos';
        const params = [];
 
        if (categorias.length > 0) {
            const placeholders = categorias.map(() => '?').join(',');
            sql += ` WHERE categoria IN (${placeholders})`;
            params.push(...categorias);
        }
 
        sql += ' GROUP BY categoria';
        const [rows] = await db.query(sql, params);
 
        const result = rows.map(r => ({
            categoria: r.categoria,
            total_valor: Number(r.total_valor) || 0
        }));
 
        res.json(result);
    } catch (error) {
        console.error('Erro ao calcular valor por categoria:', error.message);
        res.status(500).json({ error: 'Erro ao calcular valor por categoria' });
    }
});
 
 
// ─────────────────────────────────────────────
// ETAPA 10 - GET /saidas  [CORRIGIDO]
// Lista todas as SAÍDAS em ordem decrescente por data
// CORREÇÃO: adicionado filtro WHERE tipo = 'saída'
// antes retornava TODAS as movimentações sem distinção de tipo
// ─────────────────────────────────────────────
router.get('/saidas', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                m.id,
                m.dt,
                m.tipo,
                m.quantidade,
                m.produtos_id,
                p.nome AS produto_nome,
                p.categoria AS produto_categoria
            FROM movimentacoes m
            INNER JOIN produtos p ON m.produtos_id = p.id
            WHERE m.tipo IN ('saida', 'saída')
            ORDER BY m.dt DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar saídas:', error.message);
        res.status(500).json({ error: 'Erro ao listar saídas' });
    }
});

// ─────────────────────────────────────────────
// ETAPA 11 - GET /limites
// Identifica produtos que atingiram o limite mínimo (quantidade = 0)
// ou o limite máximo (quantidade >= 100), e calcula o percentual atingido
// Fórmula: percentual = (quantidade / 100) * 100
// ─────────────────────────────────────────────
router.get('/limites', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                nome,
                valor,
                quantidade,
                categoria,
 
                CASE 
                    WHEN quantidade <= 0  THEN 'minimo'
                    WHEN quantidade >= 100 THEN 'maximo'
                END AS limite_atingido
 
            FROM produtos
            WHERE quantidade <= 0 OR quantidade >= 100
        `);
 
        const result = rows.map(r => ({
            id: r.id,
            nome: r.nome,
            valor: Number(r.valor),
            quantidade: r.quantidade,
            categoria: r.categoria,
            limite_atingido: r.limite_atingido,
            // Formata o percentual com símbolo % para facilitar a leitura
            percentual: `${Number(r.percentual).toFixed(2)}%`
        }));
 
        res.json(result);
    } catch (error) {
        console.error('Erro ao verificar limites de estoque:', error.message);
        res.status(500).json({ error: 'Erro ao verificar limites de estoque' });
    }
});
 
 
// ─────────────────────────────────────────────
// ETAPA 12 - POST /movimentacoes-periodo
// Lista entradas e saídas no período informado (body: data_inicial, data_final)
// Retorna por produto: total entradas, total saídas, saldo, 
// valor financeiro das entradas e valor financeiro das saídas
// ─────────────────────────────────────────────
router.post('/movimentacoes-periodo', async (req, res) => {
    const { data_inicial, data_final } = req.body;

    // Valida se os dois campos foram enviados
    if (!data_inicial || !data_final) {
        return res.status(400).json({ error: 'Os campos data_inicial e data_final são obrigatórios' });
    }

    // Valida o formato esperado: AAAA-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data_inicial) || !dateRegex.test(data_final)) {
        return res.status(400).json({ error: 'As datas devem estar no formato YYYY-MM-DD (ex: 2024-01-31)' });
    }

    // Valida se a data inicial não é posterior à data final
    if (new Date(data_inicial) > new Date(data_final)) {
        return res.status(400).json({ error: 'A data_inicial não pode ser maior que a data_final' });
    }

    try {
        const start = `${data_inicial} 00:00:00`;
        const end = `${data_final} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                p.nome AS nome_produto,

                COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END), 0) AS total_entradas,
                COALESCE(SUM(CASE WHEN m.tipo IN ('saida','saída') THEN m.quantidade ELSE 0 END), 0) AS total_saidas,
                COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN m.tipo IN ('saida','saída') THEN m.quantidade ELSE 0 END), 0) AS saldo_periodo,
                COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade * p.valor ELSE 0 END), 0) AS valor_financeiro_entradas,
                COALESCE(SUM(CASE WHEN m.tipo IN ('saida','saída') THEN m.quantidade * p.valor ELSE 0 END), 0) AS valor_financeiro_saidas

            FROM movimentacoes m
            INNER JOIN produtos p ON m.produtos_id = p.id
            WHERE m.dt BETWEEN ? AND ?
            GROUP BY p.id, p.nome
            ORDER BY p.nome ASC
        `, [start, end]);

        const result = rows.map(r => ({
            nome_produto:              r.nome_produto,
            total_entradas:            Number(r.total_entradas),
            total_saidas:              Number(r.total_saidas),
            saldo_periodo:             Number(r.saldo_periodo),
            valor_financeiro_entradas: Number(r.valor_financeiro_entradas),
            valor_financeiro_saidas:   Number(r.valor_financeiro_saidas)
        }));

        res.json(result);
    } catch (error) {
        console.error('Erro ao listar movimentações no período:', error.message);
        res.status(500).json({ error: 'Erro ao listar movimentações no período' });
    }
});

// ...existing code...

// ─────────────────────────────────────────────
// ETAPA 13 - POST /maiores-saidas
// Lista produtos com maior volume de SAÍDA no período informado
// ─────────────────────────────────────────────
router.post('/maiores-saidas', async (req, res) => {
    const { data_inicial, data_final } = req.body;

    // Valida se os dois campos foram enviados
    if (!data_inicial || !data_final) {
        return res.status(400).json({ error: 'Os campos data_inicial e data_final são obrigatórios' });
    }

    // Valida o formato esperado: AAAA-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data_inicial) || !dateRegex.test(data_final)) {
        return res.status(400).json({ error: 'As datas devem estar no formato YYYY-MM-DD (ex: 2024-01-31)' });
    }

    // Valida se a data inicial não é posterior à data final
    if (new Date(data_inicial) > new Date(data_final)) {
        return res.status(400).json({ error: 'A data_inicial não pode ser maior que a data_final' });
    }

    try {
        const start = `${data_inicial} 00:00:00`;
        const end = `${data_final} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                p.nome AS nome_produto,

                COALESCE(SUM(m.quantidade), 0) AS quantidade_total_saida,
                COALESCE(SUM(m.quantidade * p.valor), 0) AS valor_financeiro_saidas

            FROM movimentacoes m
            INNER JOIN produtos p ON m.produtos_id = p.id
            WHERE m.tipo IN ('saida','saída') AND m.dt BETWEEN ? AND ?
            GROUP BY p.id, p.nome
            ORDER BY quantidade_total_saida DESC
        `, [start, end]);

        const result = rows.map(r => ({
            nome_produto:            r.nome_produto,
            quantidade_total_saida:  Number(r.quantidade_total_saida),
            valor_financeiro_saidas: Number(r.valor_financeiro_saidas)
        }));

        res.json(result);
    } catch (error) {
        console.error('Erro ao listar maiores saídas:', error.message);
        res.status(500).json({ error: 'Erro ao listar maiores saídas no período' });
    }
});

// ...existing code...
module.exports = router;