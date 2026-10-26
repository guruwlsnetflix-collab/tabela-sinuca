const app = require('./app')
const config = require('./config')

if (config.senhaMaestraGerada && config.env !== 'test') {
  console.log('[auth] Nenhuma SENHA_MAESTRA definida no .env. Gerada temporariamente:')
  console.log(`[auth]   ${config.senhaMaestra}`)
  console.log('[auth] Defina SENHA_MAESTRA no .env para usar uma senha fixa.')
}

app.listen(config.port, config.host, () => {
  console.log(`[server] Tabela de Sinuca rodando em http://${config.host}:${config.port}`)
})
