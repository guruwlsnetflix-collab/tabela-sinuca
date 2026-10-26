const fs = require('fs')
const os = require('os')
const path = require('path')

process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sinuca-test-')), 'test.db')
process.env.SENHA_MAESTRA = 'senha-mestre-teste'
process.env.SESSION_SECRET = 'segredo-de-teste'

const { initDb } = require('../src/db/init')
initDb()
