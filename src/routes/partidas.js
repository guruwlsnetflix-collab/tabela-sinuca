const express = require('express')
const { validationResult } = require('express-validator')

const router = express.Router()

const EventoService = require('../services/eventoService')
const JogadorService = require('../services/jogadorService')
const PartidaService = require('../services/partidaService')
const partidaValidators = require('../validators/partidaValidator')

function renderForm(res, { evento, jogadores, partida, erros }) {
  const editando = Boolean(partida && partida.id)
  const status = erros ? 400 : 200
  res.status(status).render('pages/partidas/form', {
    title: editando ? 'Editar partida' : 'Nova partida',
    evento,
    jogadores,
    partida: partida || { jogador_a_id: '', jogador_b_id: '', vencedor_id: '', data_partida: '' },
    erros
  })
}

router.get('/eventos/:eventoId/partidas/novo', (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    const jogadores = JogadorService.listarPorEvento(evento.id)
    const partida = {
      jogador_a_id: req.query.jogador_a_id || '',
      jogador_b_id: req.query.jogador_b_id || '',
      vencedor_id: req.query.vencedor_id || '',
      data_partida: ''
    }
    renderForm(res, { evento, jogadores, partida, erros: null })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.post('/eventos/:eventoId/partidas', partidaValidators.criar, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  const evento = EventoService.obter(eventoId)
  const jogadores = JogadorService.listarPorEvento(eventoId)

  const erros = validationResult(req)
  if (!erros.isEmpty()) {
    const mapa = {}
    erros.array().forEach((e) => {
      mapa[e.path] = e.msg
    })
    return renderForm(res, { evento, jogadores, partida: req.body, erros: mapa })
  }

  try {
    PartidaService.registrar({ ...req.body, evento_id: eventoId })
    res.redirect(`/eventos/${eventoId}?msg=Partida registrada com sucesso.`)
  } catch (err) {
    renderForm(res, {
      evento,
      jogadores,
      partida: req.body,
      erros: { geral: err.message }
    })
  }
})

router.get('/eventos/:eventoId/partidas/:id/editar', (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    const partida = PartidaService.obter(Number(req.params.id))
    const jogadores = JogadorService.listarPorEvento(evento.id)
    renderForm(res, { evento, jogadores, partida, erros: null })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.post('/eventos/:eventoId/partidas/:id', partidaValidators.atualizar, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  const id = Number(req.params.id)
  const evento = EventoService.obter(eventoId)
  const jogadores = JogadorService.listarPorEvento(eventoId)

  const erros = validationResult(req)
  if (!erros.isEmpty()) {
    const mapa = {}
    erros.array().forEach((e) => {
      mapa[e.path] = e.msg
    })
    return renderForm(res, { evento, jogadores, partida: { ...req.body, id }, erros: mapa })
  }

  try {
    PartidaService.atualizar(id, req.body)
    res.redirect(`/eventos/${eventoId}?msg=Partida atualizada com sucesso.`)
  } catch (err) {
    renderForm(res, {
      evento,
      jogadores,
      partida: { ...req.body, id },
      erros: { geral: err.message }
    })
  }
})

router.post('/eventos/:eventoId/partidas/:id/excluir', (req, res) => {
  const eventoId = Number(req.params.eventoId)
  try {
    PartidaService.excluir(Number(req.params.id))
    res.redirect(`/eventos/${eventoId}?msg=Partida excluída.`)
  } catch (err) {
    res.redirect(`/eventos/${eventoId}?erro=${encodeURIComponent(err.message)}`)
  }
})

module.exports = router
