const fs = require('fs')
const path = require('path')

const config = require('../config')
const db = require('./index')

// Cópia consistente do banco mesmo com o servidor rodando (a API de backup do
// SQLite respeita o WAL, ao contrário de copiar o arquivo .db diretamente).
async function fazerBackup(destinoDir = path.join(path.dirname(config.databasePath), 'backups')) {
  fs.mkdirSync(destinoDir, { recursive: true })
  const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const destino = path.join(destinoDir, `sinuca-${carimbo}.db`)
  await db.backup(destino)
  return destino
}

if (require.main === module) {
  fazerBackup(process.argv[2])
    .then((destino) => console.log(`[backup] Banco salvo em ${destino}`))
    .catch((err) => {
      console.error('[backup] Falha ao salvar o banco:', err.message)
      process.exitCode = 1
    })
}

module.exports = { fazerBackup }
