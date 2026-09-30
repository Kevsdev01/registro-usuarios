// src/config/database.js
// Un único pool de conexiones compartido por toda la aplicación.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',        // tildes y ñ correctas
  dateStrings: true,         // fechas como texto, sin desfase de zona horaria
  waitForConnections: true,  // si todas están ocupadas, espera en cola
  connectionLimit: 10,       // máximo 10 conexiones simultáneas
  queueLimit: 0              // cola sin límite
});

// Verifica que la base de datos responda
async function testConnection() {
  const [rows] = await pool.query(
    'SELECT DATABASE() AS db, CURRENT_USER() AS user, VERSION() AS version'
  );
  console.log(`MySQL conectado → base: ${rows[0].db} | usuario: ${rows[0].user} | versión: ${rows[0].version}`);
}

module.exports = { pool, testConnection };