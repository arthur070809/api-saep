const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});


(async () => {
    try {
        const conn = await connection.getConnection();
        console.log('Conectado ao MySQL com sucesso!');
        conn.release();
    } catch (error) {
        console.error('Erro ao conectar ao banco:', error.message);
    }
})();

module.exports = connection;