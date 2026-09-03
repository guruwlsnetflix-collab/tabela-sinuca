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
    db.exec("ALTER TABLE torneios ADD COLUMN numero_mesas INTEGER NOT NULL DEFAULT 1 CHECK (numero_mesas >= 1)")
  }
}

if (require.main === module) {
  initDb()
}

module.exports = { initDb }
