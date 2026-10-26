const fs = require('fs')
const path = require('path')

const config = require('../config')
const db = require('./index')

function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  db.exec(schema)
  migrar()
  console.log(`[db] Banco de dados inicializado em: ${config.databasePath}`)
}

// Migrações incrementais para bancos já existentes (idempotentes).
function migrar() {
  const colunas = db.prepare('PRAGMA table_info(torneios)').all()
  if (!colunas.some((c) => c.name === 'numero_mesas')) {
    db.exec(
      'ALTER TABLE torneios ADD COLUMN numero_mesas INTEGER NOT NULL DEFAULT 1 CHECK (numero_mesas >= 1)'
    )
  }
  if (!colunas.some((c) => c.name === 'senha_hash')) {
    db.exec('ALTER TABLE torneios ADD COLUMN senha_hash TEXT')
  }

  const colunasEventos = db.prepare('PRAGMA table_info(eventos)').all()
  if (!colunasEventos.some((c) => c.name === 'valor_aposta_padrao')) {
    db.exec('ALTER TABLE eventos ADD COLUMN valor_aposta_padrao REAL NOT NULL DEFAULT 0')
  }
  if (!colunasEventos.some((c) => c.name === 'senha_hash')) {
    db.exec('ALTER TABLE eventos ADD COLUMN senha_hash TEXT')
  }

  const colunasPartidas = db.prepare('PRAGMA table_info(partidas)').all()
  if (!colunasPartidas.some((c) => c.name === 'valor_aposta')) {
    db.exec('ALTER TABLE partidas ADD COLUMN valor_aposta REAL NOT NULL DEFAULT 0')
  }
  if (!colunasPartidas.some((c) => c.name === 'pago')) {
    db.exec('ALTER TABLE partidas ADD COLUMN pago INTEGER NOT NULL DEFAULT 0')
  }
}

if (require.main === module) {
  initDb()
}

module.exports = { initDb }
