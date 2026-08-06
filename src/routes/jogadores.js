const express = require('express')
const { validationResult } = require('express-validator')

const router = express.Router()

const EventoService = require('../services/eventoService')
const JogadorService = require('../services/jogadorService')
const jogadorValidators = require('../validators/jogadorValidator')

function renderForm(res, { evento, jogador, erros }) {
  const editando = Boolean(jogador && jogador.id)
  const status = erros ? 400 : 200
  res.status(status).render('pages/jogadores/form', {
    title: editando ? 'Editar jogador' : 'Novo jogador',
    evento,
    jogador: jogador || { nome: '', apelido: '', telefone: '' },
    erros
  })
}

router.get('/eventos/:eventoId/jogadores/novo', (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    renderForm(res, { evento, jogador: null, erros: null })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.post('/eventos/:eventoId/jogadores', jogadorValidators.criar, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  const evento = EventoService.obter(eventoId)

  const erros = validationResult(req)
  if (!erros.isEmpty()) {
    const mapa = {}
    erros.array().forEach((e) => {
      mapa[e.path] = e.msg
    })
    return renderForm(res, { evento, jogador: req.body, erros: mapa })
  }

  try {
    JogadorService.criar({ ...req.body, evento_id: eventoId })
    res.redirect(`/eventos/${eventoId}?msg=Jogador cadastrado com sucesso.`)
  } catch (err) {
    renderForm(res, {
      evento,
      jogador: req.body,
      erros: { geral: err.message }
    })
  }
})

router.get('/eventos/:eventoId/jogadores/:id/editar', (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    const jogador = JogadorService.obter(Number(req.params.id))
    renderForm(res, { evento, jogador, erros: null })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.post('/eventos/:eventoId/jogadores/:id', jogadorValidators.atualizar, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  const id = Number(req.params.id)
  const evento = EventoService.obter(eventoId)

  const erros = validationResult(req)
  if (!erros.isEmpty()) {
    const mapa = {}
    erros.array().forEach((e) => {
      mapa[e.path] = e.msg
    })
    return renderForm(res, { evento, jogador: { ...req.body, id }, erros: mapa })
  }

  try {
    JogadorService.atualizar(id, { ...req.body, ativo: true })
    res.redirect(`/eventos/${eventoId}?msg=Jogador atualizado com sucesso.`)
  } catch (err) {
    renderForm(res, {
      evento,
      jogador: { ...req.body, id },
      erros: { geral: err.message }
    })
  }
})

router.get('/eventos/:eventoId/jogadores/:id/campanha', (req, res) => {
  try {
    const campanha = JogadorService.campanha(
      Number(req.params.eventoId),
      Number(req.params.id)
    )
    res.render('pages/jogadores/campanha', {
      title: `Campanha de ${campanha.jogador.nome}`,
      campanha
    })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.post('/eventos/:eventoId/jogadores/:id/excluir', (req, res) => {
  const eventoId = Number(req.params.eventoId)
  try {
    JogadorService.excluir(Number(req.params.id))
    res.redirect(`/eventos/${eventoId}?msg=Jogador excluído.`)
  } catch (err) {
    res.redirect(`/eventos/${eventoId}?erro=${encodeURIComponent(err.message)}`)
  }
})

module.exports = router
