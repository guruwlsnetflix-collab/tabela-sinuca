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
const { initDb } = require('./db/init')

const app = express()

app.set('view engine', 'ejs')
app.set('views', config.viewsDir)
app.disable('x-powered-by')
// Na Railway o app roda atrás de um proxy HTTPS: necessário para IP real
// (limite de login) e para o cookie "secure"
if (config.env === 'production') app.set('trust proxy', 1)

app.locals.appNome = config.appNome
app.locals.appVersao = config.appVersao

app.use(cabecalhos)
app.use(compression())
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev', {
    skip: (req) => req.path === '/health'
  }))
}

app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(express.json({ limit: '100kb' }))
app.use(express.static(config.publicDir, { maxAge: config.env === 'production' ? '7d' : 0 }))
app.use(carregarSessao)
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
