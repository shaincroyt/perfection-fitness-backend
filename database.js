const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
pool.getConnection()
    .then(conn => {
        console.log('✅ Conectado a Railway');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error Railway:', err);
    });