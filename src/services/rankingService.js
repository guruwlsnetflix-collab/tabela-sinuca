const db = require('../db')
const JogadorRepository = require('../repositories/jogadorRepository')
const EventoService = require('./eventoService')

const RankingService = {
  gerar(eventoId) {
    const evento = EventoService.obter(eventoId)
    const jogadores = JogadorRepository.listarPorEvento(evento.id)

    const partidas = db
      .prepare(`
        SELECT jogador_a_id, jogador_b_id, vencedor_id
        FROM partidas
        WHERE evento_id = ?
      `)
      .all(evento.id)

    const stats = new Map()
    jogadores.forEach((j) => {
      stats.set(j.id, {
        jogador: j,
        jogos: 0,
        vitorias: 0,
        derrotas: 0
      })
    })

    partidas.forEach((p) => {
      for (const id of [p.jogador_a_id, p.jogador_b_id]) {
        const s = stats.get(id)
        if (s) {
          s.jogos += 1
        }
      }
      const vencedor = stats.get(p.vencedor_id)
      if (vencedor) {
        vencedor.vitorias += 1
      }
      const perdedor = stats.get(p.jogador_a_id === p.vencedor_id ? p.jogador_b_id : p.jogador_a_id)
      if (perdedor) {
        perdedor.derrotas += 1
      }
    })

    const linhas = [...stats.values()].map((s) => ({
      ...s,
      saldo: s.vitorias - s.derrotas,
      aproveitamento: s.jogos === 0 ? 0 : Math.round((s.vitorias / s.jogos) * 100)
    }))

    linhas.sort((x, y) => {
      if (x.jogos === 0 && y.jogos === 0) return x.jogador.id - y.jogador.id
      if (x.jogos === 0) return 1
      if (y.jogos === 0) return -1
      if (y.vitorias !== x.vitorias) return y.vitorias - x.vitorias
      if (x.derrotas !== y.derrotas) return x.derrotas - y.derrotas
      return x.jogador.id - y.jogador.id
    })

    return linhas.map((linha, indice) => ({
      ...linha,
      posicao: indice + 1
    }))
  }
}

module.exports = RankingService
