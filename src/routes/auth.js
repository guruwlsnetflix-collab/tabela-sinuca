const express = require('express')

const router = express.Router()

const AuthService = require('../services/authService')

function destinoPosLogin(req) {
  const proximo = req.query.next
  if (typeof proximo === 'string' && proximo.startsWith('/')) return proximo
  return '/'
}

router.get('/login', (req, res) => {
  res.render('pages/auth/login', {
    title: 'Entrar',
    erro: req.query.erro || null,
    next: typeof req.query.next === 'string' ? req.query.next : '/'
  })
})

router.post('/login', (req, res) => {
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
