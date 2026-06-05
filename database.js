const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'autorack.proxy.rlwy.net',
    port: 10323,
    user: 'root',
    password: 'vxhDUSfJqyiXvuFLKfWAssMPmITpukZL',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 5,
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