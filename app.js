// ...existing code...
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    headers: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ...existing code...
const produtoRoutes = require('./ROUTES/produto');
app.use('/produtos', produtoRoutes);

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ status: 'Servidor rodando com sucesso!' });
});

module.exports = app;