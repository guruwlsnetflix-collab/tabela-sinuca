const config = require('../config')

const TITULOS = {
  400: 'Requisição inválida',
  403: 'Acesso negado',
  404: 'Página não encontrada',
  429: 'Muitas requisições',
  500: 'Erro no servidor'
}

const MENSAGENS = {
  404: 'O endereço que você procurou não existe ou foi removido.',
  500: 'Algo deu errado do nosso lado. Tente novamente em instantes.'
}

function renderErro(res, err) {
  const codigo = (err && Number(err.status)) || 500
  const interno = codigo >= 500
  if (interno) console.error('[error]', err)
  const mensagemErro = err && err.message
  res.status(codigo).render('pages/erro', {
    title: TITULOS[codigo] || TITULOS[interno ? 500 : 400],
    codigo,
    // Erros 4xx trazem mensagens pensadas para o usuário ("Evento não encontrado")
    mensagem: (!interno && mensagemErro) || MENSAGENS[codigo] || MENSAGENS[500],
    // Em produção, detalhes de erros internos não são expostos ao visitante
    detalhe: interno && config.env !== 'production' ? mensagemErro : null
  })
}

function naoEncontrado(req, res) {
  renderErro(res, { status: 404 })
}

// eslint-disable-next-line no-unused-vars
function tratarErro(err, req, res, next) {
  renderErro(res, err)
}

module.exports = { renderErro, naoEncontrado, tratarErro }
