const express = require('express')
const { validationResult } = require('express-validator')

const router = express.Router()

const EventoService = require('../services/eventoService')
const JogadorService = require('../services/jogadorService')
const FinanceiroService = require('../services/financeiroService')
const jogadorValidators = require('../validators/jogadorValidator')
const { exigirEvento } = require('../middleware/auth')
const { renderErro } = require('../middleware/erros')

function fmtMoeda(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')
}

function textoAcerto(projecao) {
  const linhas = projecao.contas
    .filter((c) => c.saldo !== 0)
    .map((c) => {
      const nome = c.oponente.nome || c.oponente.apelido || '?'
      if (c.saldo > 0) {
        return `receber ${fmtMoeda(c.saldo)} de ${nome}`
      }
      return `pagar ${fmtMoeda(-c.saldo)} a ${nome}`
    })
  if (linhas.length === 0) {
    return 'situação financeira zerada'
  }
  return linhas.join('; ')
}

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

router.get('/eventos/:eventoId/jogadores/novo', exigirEvento, (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    renderForm(res, { evento, jogador: null, erros: null })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/eventos/:eventoId/jogadores', exigirEvento, jogadorValidators.criar, (req, res) => {
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

router.get('/eventos/:eventoId/jogadores/:id/editar', exigirEvento, (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.eventoId))
    const jogador = JogadorService.obter(Number(req.params.id))
    renderForm(res, { evento, jogador, erros: null })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/eventos/:eventoId/jogadores/:id', exigirEvento, jogadorValidators.atualizar, (req, res) => {
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
    const campanha = JogadorService.campanha(Number(req.params.eventoId), Number(req.params.id))
    res.render('pages/jogadores/campanha', {
      title: `Campanha de ${campanha.jogador.nome}`,
      campanha
    })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/eventos/:eventoId/jogadores/:id/excluir', exigirEvento, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  try {
    JogadorService.excluir(Number(req.params.id))
    res.redirect(`/eventos/${eventoId}?msg=Jogador excluído.`)
  } catch (err) {
    res.redirect(`/eventos/${eventoId}?erro=${encodeURIComponent(err.message)}`)
  }
})

router.post('/eventos/:eventoId/jogadores/:id/desistir', exigirEvento, (req, res) => {
  const eventoId = Number(req.params.eventoId)
  const jogadorId = Number(req.params.id)
  try {
    const projecao = FinanceiroService.projetarDesistencia(eventoId, jogadorId)
    JogadorService.desistir(jogadorId)
    const msg =
      `${projecao.jogador.nome} parou de jogar. Acerto de saída: ${textoAcerto(projecao)}. ` +
      'Ele não entrará mais nos cálculos; os demais seguem o evento.'
    res.redirect(`/eventos/${eventoId}?msg=${encodeURIComponent(msg)}`)
  } catch (err) {
    res.redirect(`/eventos/${eventoId}?erro=${encodeURIComponent(err.message)}`)
  }
})

module.exports = router
