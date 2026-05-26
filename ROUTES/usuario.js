const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    try {
        const produtos = db.query('SELECT * FROM produtos');
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

router.post ('/', (req, res) => {
    const {nome, quantidade, categoria} = req.body;
    if (!nome || !quantidade || !categoria) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const [result] = db.query(
            'INSERT INTO produtos (nome, valor, quantidade, categoria) VALUES (?, ?, ?)',
            [nome, quantidade, categoria]
        );
        res.status(201).json({ id: result.insertId, nome, valor, quantidade, categoria });
    } catch (error) { console.log ('Erro ao criar produto:', error.message);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

router.get('/', (req, res) => {
    try {
        const produtos = db.query('SELECT total FROM vw_estoque group by categoria');
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }   
});

module.exports = router;