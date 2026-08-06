const fs = require('fs')
const path = require('path')

const config = require('../config')
const db = require('./index')

function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  db.exec(schema)
  console.log(`[db] Banco de dados inicializado em: ${config.databasePath}`)
}

if (require.main === module) {
  initDb()
}

module.exports = { initDb }
