const express = require('express')

const router = express.Router()

const db = require('../db')
const TorneioService = require('../services/torneioService')
const { podeEditarEvento, podeEditarTorneio } = require('../middleware/auth')

const EVENTO_STATUS_LABEL = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  encerrado: 'Encerrado'
}

function listarEventos() {
  return db
    .prepare(
      `
      SELECT e.id, e.nome, e.data_inicio, e.data_fim, e.status,
             (SELECT COUNT(*) FROM jogadores j WHERE j.evento_id = e.id AND j.ativo = 1) AS total_jogadores,
             (SELECT COUNT(*) FROM partidas p WHERE p.evento_id = e.id) AS total_partidas
      FROM eventos e
      ORDER BY e.data_inicio DESC, e.id DESC
    `
    )
    .all()
}

function listarTorneios() {
  const totais = new Map(
    db
      .prepare('SELECT torneio_id, COUNT(*) AS total FROM torneio_jogadores GROUP BY torneio_id')
      .all()
      .map((r) => [r.torneio_id, r.total])
  )
  return TorneioService.listar().map((t) => ({ ...t, total_jogadores: totais.get(t.id) || 0 }))
}

router.get('/', (req, res) => {
  const eventos = listarEventos()
  const torneios = listarTorneios()

  res.render('pages/home', {
    title: res.locals.appNome,
    eventos,
    torneios,
    aoVivo: {
      eventos: eventos.filter((e) => e.status === 'em_andamento'),
      torneios: torneios.filter((t) => ['sorteado', 'em_andamento'].includes(t.status))
    },
    administrados: {
      eventos: eventos.filter(
        (e) => podeEditarEvento(req.sessao, e.id) && !(req.sessao && req.sessao.mestre)
      ),
      torneios: torneios.filter(
        (t) => podeEditarTorneio(req.sessao, t.id) && !(req.sessao && req.sessao.mestre)
      )
    },
    totais: {
      eventos: eventos.length,
      torneios: torneios.length,
      partidas:
        eventos.reduce((s, e) => s + e.total_partidas, 0) +
        db.prepare('SELECT COUNT(*) AS total FROM torneio_partidas').get().total
    },
    eventoStatusLabel: EVENTO_STATUS_LABEL,
    torneioStatusLabel: TorneioService.STATUS_LABEL,
    msg: req.query.msg || null,
    erro: req.query.erro || null
  })
})

router.get('/eventos', (req, res) => {
  res.render('pages/eventos/index', {
    title: 'Eventos',
    eventos: listarEventos(),
    statusLabel: EVENTO_STATUS_LABEL,
    msg: req.query.msg || null,
    erro: req.query.erro || null
  })
})

module.exports = router
