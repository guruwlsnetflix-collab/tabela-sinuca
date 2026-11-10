const compression = require('compression')
const express = require('express')
const morgan = require('morgan')

const config = require('./config')
const routes = require('./routes')
const authRoutes = require('./routes/auth')
const eventosRoutes = require('./routes/eventos')
const jogadoresRoutes = require('./routes/jogadores')
const partidasRoutes = require('./routes/partidas')
const torneiosRoutes = require('./routes/torneios')
const apiTorneiosRoutes = require('./routes/apiTorneios')
const { carregarSessao } = require('./middleware/auth')
const { naoEncontrado, tratarErro } = require('./middleware/erros')
const { cabecalhos, verificarOrigem } = require('./middleware/seguranca')
const formatacao = require('./utils/formatacao')
const { initDb } = require('./db/init')

const app = express()

app.set('view engine', 'ejs')
app.set('views', config.viewsDir)
app.disable('x-powered-by')
// Atrás de um proxy reverso (Nginx, Cloudflare Tunnel, hospedagem em nuvem) é
// preciso confiar no proxy para obter o IP real (limite de login) e saber se a
// conexão é HTTPS (cookie "secure")
if (config.trustProxy) app.set('trust proxy', 1)

app.locals.appNome = config.appNome
app.locals.appVersao = config.appVersao
Object.assign(app.locals, formatacao)

app.use(cabecalhos)
app.use(compression())
if (config.env !== 'test') {
  app.use(
    morgan(config.env === 'production' ? 'combined' : 'dev', {
      skip: (req) => req.path === '/health'
    })
  )
}

app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(express.json({ limit: '100kb' }))
app.use(express.static(config.publicDir, { maxAge: config.env === 'production' ? '7d' : 0 }))
app.use(carregarSessao)
app.use((req, res, next) => {
  // Destaca o item do menu correspondente à página atual
  res.locals.secaoAtual = req.path.startsWith('/torneios')
    ? 'torneios'
    : req.path.startsWith('/eventos')
      ? 'eventos'
      : req.path === '/'
        ? 'inicio'
        : null
  next()
})
app.use(verificarOrigem)

initDb()

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', versao: config.appVersao })
})

app.use('/', authRoutes)
app.use('/', routes)
app.use('/', eventosRoutes)
app.use('/', jogadoresRoutes)
app.use('/', partidasRoutes)
app.use('/', torneiosRoutes)
app.use('/', apiTorneiosRoutes)

app.use(naoEncontrado)
app.use(tratarErro)

module.exports = app
