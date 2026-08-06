require('dotenv').config()

const path = require('path')

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'sinuca.db'),
  viewsDir: path.join(__dirname, 'views'),
  publicDir: path.join(__dirname, '..', 'public')
}

module.exports = config
