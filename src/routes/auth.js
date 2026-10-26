const express = require('express')

const router = express.Router()

const AuthService = require('../services/authService')
const { limiteLogin } = require('../middleware/seguranca')

// Aceita apenas caminhos internos. "//site.com" e "/\site.com" são
// interpretados pelo navegador como outro domínio (redirecionamento aberto).
function destinoSeguro(valor) {
  if (typeof valor !== 'string' || !valor.startsWith('/')) return '/'
  if (valor.startsWith('//') || valor.startsWith('/\\')) return '/'
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
  AuthService.definirSessao(res, sessao)
  res.redirect(destinoPosLogin(req))
})

router.post('/logout', (req, res) => {
  AuthService.limparSessao(res)
  res.redirect('/')
})

module.exports = router
