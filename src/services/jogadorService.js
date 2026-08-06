const JogadorRepository = require('../repositories/jogadorRepository')
const EventoService = require('./eventoService')

class JogadorNaoEncontradoError extends Error {
  constructor() {
    super('Jogador não encontrado.')
    this.status = 404
  }
}

class JogadorEventoEncerradoError extends Error {
  constructor() {
    super('Não é possível alterar jogadores em um evento encerrado.')
    this.status = 400
  }
}

class JogadorExclusaoBloqueadaError extends Error {
  constructor() {
    super('Não é possível excluir um jogador que possui partidas registradas.')
    this.status = 400
  }
}

const JogadorService = {
  listarPorEvento(eventoId) {
    EventoService.obter(eventoId)
    return JogadorRepository.listarPorEvento(eventoId)
  },

  obter(id) {
    const jogador = JogadorRepository.obterPorId(id)
    if (!jogador) {
      throw new JogadorNaoEncontradoError()
    }
    return jogador
  },

  criar({ evento_id, nome, apelido, telefone }) {
    const evento = EventoService.obter(evento_id)
    if (evento.status === 'encerrado') {
      throw new JogadorEventoEncerradoError()
    }
    return JogadorRepository.criar({ evento_id, nome, apelido, telefone })
  },

  atualizar(id, { nome, apelido, telefone, ativo }) {
    const jogador = this.obter(id)
    const evento = EventoService.obter(jogador.evento_id)
    if (evento.status === 'encerrado') {
      throw new JogadorEventoEncerradoError()
    }
    return JogadorRepository.atualizar(id, { nome, apelido, telefone, ativo })
  },

  excluir(id) {
    const jogador = this.obter(id)
    const evento = EventoService.obter(jogador.evento_id)
    if (evento.status === 'encerrado') {
      throw new JogadorEventoEncerradoError()
    }
    if (JogadorRepository.contarPartidas(id) > 0) {
      throw new JogadorExclusaoBloqueadaError()
    }
    JogadorRepository.excluir(id)
    return jogador
  },

  campanha(eventoId, jogadorId) {
    const jogador = this.obter(jogadorId)
    const evento = EventoService.obter(eventoId)
    if (jogador.evento_id !== evento.id) {
      throw new Error('O jogador não pertence a este evento.')
    }

    const partidas = JogadorRepository.listarPartidas(jogadorId).map((p) => {
      const vitoria = p.vencedor_id === jogadorId
      const adversarioId = p.jogador_a_id === jogadorId ? p.jogador_b_id : p.jogador_a_id
      const adversario = p.jogador_a_id === jogadorId ? p.jogador_b : p.jogador_a
      return {
        id: p.id,
        data_partida: p.data_partida,
        adversario,
        adversarioId,
        vencedor: p.vencedor,
        vitoria
      }
    })

    return {
      jogador,
      evento,
      partidas,
      resumo: {
        vitorias: partidas.filter((p) => p.vitoria).length,
        derrotas: partidas.filter((p) => !p.vitoria).length,
        jogos: partidas.length
      }
    }
  }
}

module.exports = JogadorService
module.exports.Errors = {
  JogadorNaoEncontradoError,
  JogadorEventoEncerradoError,
  JogadorExclusaoBloqueadaError
}
