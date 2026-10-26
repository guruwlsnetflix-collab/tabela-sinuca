const express = require('express')
const { validationResult } = require('express-validator')

const router = express.Router()

const EventoService = require('../services/eventoService')
const JogadorService = require('../services/jogadorService')
const PartidaService = require('../services/partidaService')
const partidaValidators = require('../validators/partidaValidator')
const { exigirEvento } = require('../middleware/auth')
const { renderErro } = require('../middleware/erros')

function dataInicioSugerida(evento) {
  if (!evento || !evento.data_inicio) return ''
  const d = String(evento.data_inicio).trim()
  return d.length >= 10 ? `${d.substring(0, 10)}T00:00` : ''
}

function jogadoresParaForm(jogadores, partida) {
  const presentes = new Set(
    partida
      ? [partida.jogador_a_id, partida.jogador_b_id, partida.vencedor_id].map(Number)
      : []
  )
  return jogadores.filter((j) => j.ativo === 1 || presentes.has(j.id))
}

function renderForm(res, { evento, jogadores, partida, erros }) {
  const editando = Boolean(partida && partida.id)
  const status = erros ? 400 : 200
  res.status(status).render('pages/partidas/form', {
    title: editando ? 'Editar partida' : 'Nova partida',
    evento,
    jogadores: jogadoresParaForm(jogadores, partida || null),
    partida: partida || {
      jogador_a_id: '',
      jogador_b_id: '',
      vencedor_id: '',
      data_partida: dataInicioSugerida(evento),
      valor_aposta: ''
    },
    erros
  })
}

router.get('/eventos/:eventoId/partidas/novo', exigirEvento, (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    const jogadores = JogadorService.listarPorEvento(evento.id)
    const partida = {
      jogador_a_id: req.query.jogador_a_id || '',
      jogador_b_id: req.query.jogador_b_id || '',
      vencedor_id: req.query.vencedor_id || '',
      data_partida: dataInicioSugerida(evento),
      valor_aposta: evento.valor_aposta_padrao
    }
    renderForm(res, { evento, jogadores, partida, erros: null })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/eventos/:eventoId/partidas', exigirEvento, partidaValidators.criar, (req, res) => {
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

router.get('/eventos/:eventoId/partidas/:id/editar', exigirEvento, (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    const partida = PartidaService.obter(Number(req.params.id))
    const jogadores = JogadorService.listarPorEvento(evento.id)
    renderForm(res, { evento, jogadores, partida, erros: null })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/eventos/:eventoId/partidas/:id', exigirEvento, partidaValidators.atualizar, (req, res) => {
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

router.post('/eventos/:eventoId/partidas/:id/pago', exigirEvento, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  try {
    const partida = PartidaService.alternarPago(Number(req.params.id))
    const msg =
      partida.pago === 1
        ? 'Partida marcada como paga.'
        : 'Partida marcada como pendente.'
    res.redirect(`/eventos/${eventoId}?msg=${encodeURIComponent(msg)}`)
  } catch (err) {
    res.redirect(`/eventos/${eventoId}?erro=${encodeURIComponent(err.message)}`)
  }
})

router.post('/eventos/:eventoId/partidas/:id/excluir', exigirEvento, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  try {
    PartidaService.excluir(Number(req.params.id))
    res.redirect(`/eventos/${eventoId}?msg=Partida excluída.`)
  } catch (err) {
    res.redirect(`/eventos/${eventoId}?erro=${encodeURIComponent(err.message)}`)
  }
})

module.exports = router
