// ...existing code...
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /produtos -> lista todos os produtos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM produtos');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// GET /produtos/estoque-por-categoria -> total por categoria (view vw_estoque)
router.get('/estoque-por-categoria', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT categoria, SUM(quantidade) as total FROM vw_estoque GROUP BY categoria');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar estoque por categoria:', error);
        res.status(500).json({ error: 'Erro ao buscar estoque por categoria' });
    }   
});

// POST /produtos -> cria produto
router.post('/', async (req, res) => {
    const { nome, valor, quantidade, categoria } = req.body;
    if (!nome || valor === undefined || quantidade === undefined || !categoria) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios: nome, valor, quantidade, categoria' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO produtos (nome, valor, quantidade, categoria) VALUES (?, ?, ?, ?)',
            [nome, valor, quantidade, categoria]
        );
        res.status(201).json({ id: result.insertId, nome, valor, quantidade, categoria });
    } catch (error) {
        console.error('Erro ao criar produto:', error.message);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

module.exports = router;