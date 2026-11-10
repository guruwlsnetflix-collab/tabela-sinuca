const AuthService = require('../services/authService')

function podeEditarEvento(sessao, eventoId) {
  return Boolean(sessao && (sessao.mestre || sessao.eventos.includes(Number(eventoId))))
}

function podeEditarTorneio(sessao, torneioId) {
  return Boolean(sessao && (sessao.mestre || sessao.torneios.includes(Number(torneioId))))
}

function carregarSessao(req, res, next) {
  req.sessao = AuthService.lerSessao(req)
  res.locals.sessao = req.sessao
  res.locals.ehMestre = Boolean(req.sessao && req.sessao.mestre)
  res.locals.podeEditarEvento = (eventoId) => podeEditarEvento(req.sessao, eventoId)
  res.locals.podeEditarTorneio = (torneioId) => podeEditarTorneio(req.sessao, torneioId)
  next()
}

function redirecionarParaLogin(req, res) {
  const destino = req.originalUrl || '/'
  res.redirect(`/login?next=${encodeURIComponent(destino)}`)
}

// Sem permissão, leva à tela de acesso do próprio evento/torneio, onde basta
// informar a senha dele (ou a mestra). Depois volta para onde o usuário estava.
// Em POSTs, volta para a página de detalhe, pois o formulário não é repetível.
function redirecionarParaAcesso(req, res, tipo, id) {
  const destino = req.method === 'GET' ? req.originalUrl : `/${tipo}/${id}`
  res.redirect(`/${tipo}/${id}/acesso?next=${encodeURIComponent(destino)}`)
}

function exigirMestre(req, res, next) {
  if (req.sessao && req.sessao.mestre) return next()
  return redirecionarParaLogin(req, res)
}

function exigirEvento(req, res, next) {
  const eventoId = Number(req.params.eventoId || req.params.id)
  if (podeEditarEvento(req.sessao, eventoId)) return next()
  return redirecionarParaAcesso(req, res, 'eventos', eventoId)
}

function exigirTorneio(req, res, next) {
  const torneioId = Number(req.params.id)
  if (podeEditarTorneio(req.sessao, torneioId)) return next()
  return redirecionarParaAcesso(req, res, 'torneios', torneioId)
}

module.exports = {
  carregarSessao,
  exigirMestre,
  exigirTorneio,
  exigirEvento,
  redirecionarParaLogin,
  podeEditarEvento,
  podeEditarTorneio
}
