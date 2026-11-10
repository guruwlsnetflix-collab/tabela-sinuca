const express = require('express')

const router = express.Router()

const AuthService = require('../services/authService')
const EventoService = require('../services/eventoService')
const TorneioService = require('../services/torneioService')
const { podeEditarEvento, podeEditarTorneio } = require('../middleware/auth')
const { renderErro } = require('../middleware/erros')
const { limiteLogin } = require('../middleware/seguranca')

// Aceita apenas caminhos internos. "//site.com" e "/\site.com" são
// interpretados pelo navegador como outro domínio (redirecionamento aberto).
function destinoSeguro(valor, padrao = '/') {
  if (typeof valor !== 'string' || !valor.startsWith('/')) return padrao
  if (valor.startsWith('//') || valor.startsWith('/\\')) return padrao
  return valor
}

function destinoPosLogin(req) {
  return destinoSeguro(req.body.next || req.query.next)
}

router.get('/login', (req, res) => {
  res.render('pages/auth/login', {
    title: 'Entrar',
    erro: req.query.erro || null,
    next: destinoSeguro(req.query.next)
  })
})

router.post('/login', limiteLogin, (req, res) => {
  const sessao = AuthService.autenticar(String(req.body.senha || ''))
  if (!sessao) {
    return res.status(400).render('pages/auth/login', {
      title: 'Entrar',
      erro: 'Senha incorreta.',
      next: destinoPosLogin(req)
    })
  }
  AuthService.definirSessao(req, res, sessao)
  res.redirect(destinoPosLogin(req))
})

router.post('/logout', (req, res) => {
  AuthService.limparSessao(req, res)
  res.redirect('/?msg=' + encodeURIComponent('Você saiu do modo de administração.'))
})

// ---------------- Acesso a um evento/torneio específico ----------------
// Tela "Administrar": pede apenas a senha daquele evento/torneio (ou a mestra)

const ALVOS = {
  eventos: {
    rotulo: 'evento',
    obter: (id) => EventoService.obter(id),
    autenticar: (id, senha) => AuthService.autenticarEvento(id, senha),
    jaPode: podeEditarEvento
  },
  torneios: {
    rotulo: 'torneio',
    obter: (id) => TorneioService.obter(id),
    autenticar: (id, senha) => AuthService.autenticarTorneio(id, senha),
    jaPode: podeEditarTorneio
  }
}

function renderAcesso(res, { tipo, item, erro, next, status = 200 }) {
  res.status(status).render('pages/auth/acesso', {
    title: `Administrar ${item.nome}`,
    tipo,
    rotulo: ALVOS[tipo].rotulo,
    item,
    erro: erro || null,
    next
  })
}

Object.keys(ALVOS).forEach((tipo) => {
  const alvo = ALVOS[tipo]

  router.get(`/${tipo}/:id/acesso`, (req, res) => {
    try {
      const id = Number(req.params.id)
      const item = alvo.obter(id)
      const next = destinoSeguro(req.query.next, `/${tipo}/${id}`)
      if (alvo.jaPode(req.sessao, id)) return res.redirect(next)
      renderAcesso(res, { tipo, item, erro: req.query.erro, next })
    } catch (err) {
      renderErro(res, err)
    }
  })

  router.post(
    `/${tipo}/:id/acesso`,
    (req, res, next) => {
      try {
        const id = Number(req.params.id)
        req.alvoAcesso = alvo.obter(id)
        req.renderLimite = (mensagem) =>
          renderAcesso(res, {
            tipo,
            item: req.alvoAcesso,
            erro: mensagem,
            next: destinoSeguro(req.body.next, `/${tipo}/${id}`),
            status: 429
          })
        next()
      } catch (err) {
        renderErro(res, err)
      }
    },
    limiteLogin,
    (req, res) => {
      const id = req.alvoAcesso.id
      const next = destinoSeguro(req.body.next, `/${tipo}/${id}`)
      const sessao = alvo.autenticar(id, String(req.body.senha || ''))
      if (!sessao) {
        return renderAcesso(res, {
          tipo,
          item: req.alvoAcesso,
          erro: `Senha incorreta. Use a senha definida na criação do ${alvo.rotulo}.`,
          next,
          status: 400
        })
      }
      AuthService.definirSessao(req, res, sessao)
      const [caminho, ancora] = next.split('#')
      const separador = caminho.includes('?') ? '&' : '?'
      const msg = encodeURIComponent('Modo administrador ativado.')
      res.redirect(`${caminho}${separador}msg=${msg}${ancora ? '#' + ancora : ''}`)
    }
  )
})

module.exports = router
