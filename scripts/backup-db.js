const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const mysqlCore = require('mysql2');
require('dotenv').config();

const REQUIRED_ENV = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const BACKUP_DIR = path.resolve(__dirname, '..', 'backups');

function assertRequiredEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
  }
}

function buildSslConfig() {
  if (process.env.DB_SSL === 'false') {
    return undefined;
  }

  if (process.env.DB_SSL_CA) {
    return {
      ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'),
      rejectUnauthorized: true
    };
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  };
}

function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BACKUP_TIMEZONE || 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}_${value('hour')}-${value('minute')}`;
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function chunkRows(rows, size = 100) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function getTables(connection) {
  const [tables] = await connection.query('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE']);

  return tables.map((row) => Object.values(row)[0]);
}

async function getViews(connection) {
  const [views] = await connection.query('SHOW FULL TABLES WHERE Table_type = ?', ['VIEW']);

  return views.map((row) => Object.values(row)[0]);
}

async function dumpTableStructure(connection, tableName) {
  const [rows] = await connection.query(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`);
  const createSql = rows[0]['Create Table'];

  return [
    `DROP TABLE IF EXISTS ${quoteIdentifier(tableName)};`,
    `${createSql};`
  ].join('\n');
}

async function dumpViewStructure(connection, viewName) {
  const [rows] = await connection.query(`SHOW CREATE VIEW ${quoteIdentifier(viewName)}`);
  const createSql = rows[0]['Create View'];

  return [
    `DROP VIEW IF EXISTS ${quoteIdentifier(viewName)};`,
    `${createSql};`
  ].join('\n');
}

async function dumpTableData(connection, tableName) {
  const [rows, fields] = await connection.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);

  if (rows.length === 0) {
    return `-- Sin datos para ${quoteIdentifier(tableName)}`;
  }

  const columns = fields.map((field) => quoteIdentifier(field.name)).join(', ');
  const inserts = chunkRows(rows).map((chunk) => {
    const values = chunk.map((row) => {
      const rowValues = fields.map((field) => mysqlCore.escape(row[field.name])).join(', ');
      return `(${rowValues})`;
    }).join(',\n');

    return `INSERT INTO ${quoteIdentifier(tableName)} (${columns}) VALUES\n${values};`;
  });

  return inserts.join('\n');
}

async function createBackup() {
  assertRequiredEnv();
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: buildSslConfig()
  });

  try {
    const tables = await getTables(connection);
    const views = await getViews(connection);
    const timestamp = formatTimestamp();
    const fileName = `perfection_backup_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);
    const output = [];

    output.push('-- Backup MySQL - Perfection Fitness');
    output.push(`-- Base de datos: ${process.env.DB_NAME}`);
    output.push(`-- Fecha: ${timestamp}`);
    output.push('');
    output.push('SET NAMES utf8mb4;');
    output.push('SET FOREIGN_KEY_CHECKS = 0;');
    output.push('');

    for (const tableName of tables) {
      output.push(`-- Estructura de tabla ${quoteIdentifier(tableName)}`);
      output.push(await dumpTableStructure(connection, tableName));
      output.push('');
    }

    for (const tableName of tables) {
      output.push(`-- Datos de tabla ${quoteIdentifier(tableName)}`);
      output.push(await dumpTableData(connection, tableName));
      output.push('');
    }

    for (const viewName of views) {
      output.push(`-- Estructura de vista ${quoteIdentifier(viewName)}`);
      output.push(await dumpViewStructure(connection, viewName));
      output.push('');
    }

    output.push('SET FOREIGN_KEY_CHECKS = 1;');
    output.push('');

    await fs.writeFile(filePath, output.join('\n'), 'utf8');

    console.log(`Backup creado correctamente: ${path.relative(process.cwd(), filePath)}`);
    console.log(`Tablas exportadas: ${tables.length}`);
    console.log(`Vistas exportadas: ${views.length}`);
  } finally {
    await connection.end();
  }
}

createBackup().catch((error) => {
  console.error(`No se pudo crear el backup: ${error.message}`);
  process.exitCode = 1;
});
