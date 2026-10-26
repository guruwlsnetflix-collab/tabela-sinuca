require('dotenv').config()

const crypto = require('crypto')
const path = require('path')

function hashSha256(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex')
}

const senhaMaestraDefinida = Boolean(process.env.SENHA_MAESTRA)
const senhaMaestra = process.env.SENHA_MAESTRA || crypto.randomBytes(24).toString('hex')

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'sinuca.db'),
  viewsDir: path.join(__dirname, 'views'),
  publicDir: path.join(__dirname, '..', 'public'),

  // Autenticação
  senhaMaestra,
  senhaMaestraDefinida,
  senhaMaestraGerada: !senhaMaestraDefinida,
  segredoSessao: process.env.SESSION_SECRET || hashSha256(`sinuca:${senhaMaestra}`),
  duracaoSessaoMs: 12 * 60 * 60 * 1000
}

module.exports = config
