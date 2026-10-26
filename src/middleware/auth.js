const AuthService = require('../services/authService')

function carregarSessao(req, res, next) {
  req.sessao = AuthService.lerSessao(req)
  res.locals.sessao = req.sessao
  res.locals.ehMestre = Boolean(req.sessao && req.sessao.nivel === 'mestre')
  res.locals.podeEditarEvento = (eventoId) =>
    Boolean(
      req.sessao &&
        (req.sessao.nivel === 'mestre' ||
          (req.sessao.nivel === 'evento' &&
            Array.isArray(req.sessao.eventos) &&
            req.sessao.eventos.includes(Number(eventoId))))
    )
  res.locals.podeEditarTorneio = (torneioId) =>
    Boolean(
      req.sessao &&
        (req.sessao.nivel === 'mestre' ||
          (req.sessao.nivel === 'torneio' &&
            Array.isArray(req.sessao.torneios) &&
            req.sessao.torneios.includes(Number(torneioId))))
    )
  next()
}

function redirecionarParaLogin(req, res) {
  const destino = req.originalUrl || '/'
  res.redirect(`/login?next=${encodeURIComponent(destino)}`)
}

function exigirMestre(req, res, next) {
  if (req.sessao && req.sessao.nivel === 'mestre') return next()
  return redirecionarParaLogin(req, res)
}

function exigirEvento(req, res, next) {
  if (!req.sessao) return redirecionarParaLogin(req, res)
  if (req.sessao.nivel === 'mestre') return next()
  if (req.sessao.nivel === 'evento') {
    const eventoId = Number(req.params.eventoId || req.params.id)
    if (Array.isArray(req.sessao.eventos) && req.sessao.eventos.includes(eventoId)) return next()
  }
  return redirecionarParaLogin(req, res)
}

function exigirTorneio(req, res, next) {
  if (!req.sessao) return redirecionarParaLogin(req, res)
  if (req.sessao.nivel === 'mestre') return next()
  if (req.sessao.nivel === 'torneio') {
    const torneioId = Number(req.params.eventoId || req.params.id)
    if (Array.isArray(req.sessao.torneios) && req.sessao.torneios.includes(torneioId)) return next()
  }
  return redirecionarParaLogin(req, res)
}

module.exports = { carregarSessao, exigirMestre, exigirTorneio, exigirEvento, redirecionarParaLogin }
