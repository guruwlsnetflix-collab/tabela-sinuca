const express = require('express')

const router = express.Router()
const TorneioService = require('../services/torneioService')

function serializarConfronto(c) {
  return {
    id: c.id,
    numero: c.numero,
    fase: c.fase,
    status: c.status,
    jogador_a: c.jogador_a_nome || null,
    jogador_b: c.jogador_b_nome || null,
    vencedor: c.vencedor_nome || null,
    placar_a: c.placar_a,
    placar_b: c.placar_b,
    vitorias_necessarias: c.vitorias_necessarias,
    preparado: c.preparado,
    partidas_realizadas: c.partidasRealizadas
  }
}

function serializarEstado(estado) {
  return {
    torneio: {
      id: estado.torneio.id,
      nome: estado.torneio.nome,
      local: estado.torneio.local,
      data_inicio: estado.torneio.data_inicio,
      previsao_termino: estado.torneio.previsao_termino,
      modalidade: estado.torneio.modalidade,
      numero_mesas: estado.torneio.numero_mesas,
      status: estado.torneio.status,
      vencedor: estado.torneio.vencedor_nome || null
    },
    total_jogadores: estado.totalJogadores,
    mesas_ocupadas: estado.mesasOcupadas,
    mesas_disponiveis: estado.mesasDisponiveis,
    fases: estado.fases.map((fase) => ({
      key: fase.key,
      label: fase.label,
      confrontos: fase.confrontos.map(serializarConfronto)
    })),
    proximos_confrontos: estado.proximosConfrontos.map(serializarConfronto),
    fase_atual: estado.faseAtual
      ? {
          key: estado.faseAtual.key,
          label: estado.faseAtual.label,
          confronto: estado.faseAtual.confronto
            ? serializarConfronto(estado.faseAtual.confronto)
            : null
        }
      : null
  }
}

router.get('/api/torneios', (req, res) => {
  const torneios = TorneioService.listar().map((t) => ({
    id: t.id,
    nome: t.nome,
    local: t.local,
    data_inicio: t.data_inicio,
    modalidade: t.modalidade,
    numero_mesas: t.numero_mesas,
    status: t.status,
    vencedor: t.vencedor_nome || null,
    url: `/torneios/${t.id}`
  }))
  res.json({ total: torneios.length, torneios })
})

router.get('/api/torneios/:id', (req, res) => {
  try {
    const estado = TorneioService.obterEstado(Number(req.params.id))
    res.json(serializarEstado(estado))
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message })
  }
})

// Alias compatível com o painel público
router.get('/api/torneios/:id/painel', (req, res) => {
  try {
    const estado = TorneioService.obterEstado(Number(req.params.id))
    res.json(serializarEstado(estado))
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message })
  }
})

module.exports = router