const express = require('express');
const router = express.Router();
const db = require('../db');

//get lista todos os produtos
router.get('/listar', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM produtos');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});


//post cria produto
router.post('/criar', async (req, res) => {
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

//get /produtos/valor-por-categoria total (valor * quantidade) por categoria
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

//get /produtos/saidas lista todas as saídas em ordem decrescente por data
router.get('/saidas', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT *
            FROM movimentacoes
            ORDER BY COALESCE(data, created_at, '1970-01-01') DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar saídas:', error.message);
        res.status(500).json({ error: 'Erro ao listar saídas' });
    }
});

module.exports = router;