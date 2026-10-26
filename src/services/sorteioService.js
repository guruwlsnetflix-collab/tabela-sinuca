const db = require('../db')
const JogadorRepository = require('../repositories/jogadorRepository')
const EventoService = require('./eventoService')

function sortear(lista, rng) {
  const aleatorio = rng || Math.random
  const indice = Math.floor(aleatorio() * lista.length)
  return lista[indice]
}

const SorteioService = {
  obterAdversarios(eventoId, vencedorId) {
    const evento = EventoService.obter(eventoId)
    const vencedor = JogadorRepository.obterPorId(vencedorId)
    if (!vencedor) {
      throw new Error('Jogador vencedor não encontrado.')
    }
    if (vencedor.evento_id !== evento.id) {
      throw new Error('O jogador vencedor não pertence a este evento.')
    }

    const jogadores = JogadorRepository.listarPorEvento(eventoId).filter(
      (j) => j.ativo === 1 && j.id !== vencedorId
    )

    if (jogadores.length === 0) {
      return { adversarios: [], ultimoAdversario: null }
    }

    const ultimaPartida = db
      .prepare(
        `
        SELECT p.jogador_a_id, p.jogador_b_id
        FROM partidas p
        WHERE p.evento_id = ? AND (p.jogador_a_id = ? OR p.jogador_b_id = ?)
        ORDER BY p.data_partida DESC, p.id DESC
        LIMIT 1
      `
      )
      .get(eventoId, vencedorId, vencedorId)

    const ultimoAdversario = ultimaPartida
      ? ultimaPartida.jogador_a_id === vencedorId
        ? ultimaPartida.jogador_b_id
        : ultimaPartida.jogador_a_id
      : null

    const semUltimo = jogadores.filter((j) => j.id !== ultimoAdversario)
    const candidatos = semUltimo.length > 0 ? semUltimo : jogadores

    return { adversarios: candidatos, ultimoAdversario }
  },

  sugerirProximoAdversario(eventoId, vencedorId, rng) {
    const { adversarios, ultimoAdversario } = this.obterAdversarios(eventoId, vencedorId)
    if (adversarios.length === 0) {
      return { sugestao: null, ultimoAdversario, semOponente: true }
    }
    const sugestao = sortear(adversarios, rng)
    return { sugestao, ultimoAdversario, semOponente: false }
  }
}

module.exports = SorteioService
