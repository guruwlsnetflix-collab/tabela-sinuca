const express = require('express')

const config = require('./config')
const routes = require('./routes')
const eventosRoutes = require('./routes/eventos')
const jogadoresRoutes = require('./routes/jogadores')
const { initDb } = require('./db/init')

const app = express()

app.set('view engine', 'ejs')
app.set('views', config.viewsDir)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(config.publicDir))

initDb()

app.use('/', routes)
app.use('/', eventosRoutes)
app.use('/', jogadoresRoutes)

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use((req, res) => {
  res.status(404).render('pages/404')
})

app.use((err, req, res, next) => {
  console.error('[error]', err)
  res.status(500).render('pages/500', { message: err.message })
})

module.exports = app
