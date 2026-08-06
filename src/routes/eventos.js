const express = require('express')
const { validationResult } = require('express-validator')

const router = express.Router()

const EventoService = require('../services/eventoService')
const eventoValidators = require('../validators/eventoValidator')
const db = require('../db')

const STATUS_LABEL = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  encerrado: 'Encerrado'
}

router.get('/eventos/novo', (req, res) => {
  res.render('pages/eventos/form', {
    title: 'Novo evento',
    evento: { nome: '', data_inicio: '', data_fim: '' },
    statusLabel: STATUS_LABEL,
    erros: null,
    modoEdicao: false
  })
})

router.post('/eventos', eventoValidators.criar, (req, res) => {
  const erros = validationResult(req)
  if (!erros.isEmpty()) {
    const mapa = {}
    erros.array().forEach((e) => {
      mapa[e.path] = e.msg
    })
    return res.status(400).render('pages/eventos/form', {
      title: 'Novo evento',
      evento: req.body,
      statusLabel: STATUS_LABEL,
      erros: mapa,
      modoEdicao: false
    })
  }

  try {
    const evento = EventoService.criar(req.body)
    res.redirect(`/eventos/${evento.id}?msg=Evento criado com sucesso.`)
  } catch (err) {
    res.status(400).render('pages/eventos/form', {
      title: 'Novo evento',
      evento: req.body,
      statusLabel: STATUS_LABEL,
      erros: { geral: err.message },
      modoEdicao: false
    })
  }
})

router.get('/eventos/:id', (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.id))
    const jogadores = db
      .prepare('SELECT id, nome, apelido, ativo FROM jogadores WHERE evento_id = ? ORDER BY nome')
      .all(evento.id)
    const partidas = db
      .prepare(`
        SELECT p.id, p.data_partida, pa.nome AS jogador_a, pb.nome AS jogador_b,
               pv.nome AS vencedor, p.jogador_a_id, p.jogador_b_id, p.vencedor_id
        FROM partidas p
        JOIN jogadores pa ON pa.id = p.jogador_a_id
        JOIN jogadores pb ON pb.id = p.jogador_b_id
        JOIN jogadores pv ON pv.id = p.vencedor_id
        WHERE p.evento_id = ?
        ORDER BY p.data_partida DESC, p.id DESC
      `)
      .all(evento.id)

    res.render('pages/eventos/detalhe', {
      title: evento.nome,
      evento,
      jogadores,
      partidas,
      statusLabel: STATUS_LABEL,
      msg: req.query.msg || null,
      erro: req.query.erro || null
    })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.get('/eventos/:id/editar', (req, res) => {
  try {
    const evento = EventoService.obter(Number(req.params.id))
    res.render('pages/eventos/form', {
      title: 'Editar evento',
      evento,
      statusLabel: STATUS_LABEL,
      erros: null,
      modoEdicao: true
    })
  } catch (err) {
    res.status(err.status || 500).render('pages/404')
  }
})

router.post('/eventos/:id', eventoValidators.atualizar, (req, res) => {
  const id = Number(req.params.id)
  const erros = validationResult(req)
  if (!erros.isEmpty()) {
    const mapa = {}
    erros.array().forEach((e) => {
      mapa[e.path] = e.msg
    })
    return res.status(400).render('pages/eventos/form', {
      title: 'Editar evento',
      evento: { ...req.body, id },
      statusLabel: STATUS_LABEL,
      erros: mapa,
      modoEdicao: true
    })
  }

  try {
    EventoService.atualizar(id, req.body)
    res.redirect(`/eventos/${id}?msg=Evento atualizado com sucesso.`)
  } catch (err) {
    res.status(400).render('pages/eventos/form', {
      title: 'Editar evento',
      evento: { ...req.body, id },
      statusLabel: STATUS_LABEL,
      erros: { geral: err.message },
      modoEdicao: true
    })
  }
})

router.post('/eventos/:id/status', eventoValidators.status, (req, res) => {
  try {
    EventoService.mudarStatus(Number(req.params.id), req.body.status)
    res.redirect(`/eventos/${req.params.id}?msg=Status atualizado.`)
  } catch (err) {
    res.redirect(`/eventos/${req.params.id}?erro=${encodeURIComponent(err.message)}`)
  }
})

router.post('/eventos/:id/excluir', (req, res) => {
  try {
    EventoService.excluir(Number(req.params.id))
    res.redirect('/?msg=Evento excluído.')
  } catch (err) {
    res.redirect(`/eventos/${req.params.id}?erro=${encodeURIComponent(err.message)}`)
  }
})

module.exports = router
