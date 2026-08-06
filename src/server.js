const app = require('./app')
const config = require('./config')

app.listen(config.port, config.host, () => {
  console.log(`[server] Tabela de Sinuca rodando em http://${config.host}:${config.port}`)
})
