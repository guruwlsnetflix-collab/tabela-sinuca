const PartidaRepository = require('../repositories/partidaRepository')
const JogadorRepository = require('../repositories/jogadorRepository')
const EventoService = require('./eventoService')

class PartidaNaoEncontradaError extends Error {
  constructor() {
    super('Partida não encontrada.')
    this.status = 404
  }
}

class PartidaEventoEncerradoError extends Error {
  constructor() {
    super('Não é possível alterar partidas em um evento encerrado.')
    this.status = 400
  }
}

class PartidaJogadorForaDoEventoError extends Error {
  constructor(nomeCampo) {
    super(`O jogador do campo "${nomeCampo}" não pertence a este evento.`)
    this.status = 400
  }
}

const PartidaService = {
  listarPorEvento(eventoId) {
    EventoService.obter(eventoId)
    return PartidaRepository.listarPorEvento(eventoId)
  },

  obter(id) {
    const partida = PartidaRepository.obterPorId(id)
    if (!partida) {
      throw new PartidaNaoEncontradaError()
    }
    return partida
  },

  registrar({ evento_id, jogador_a_id, jogador_b_id, vencedor_id, data_partida }) {
    const evento = EventoService.obter(evento_id)
    if (evento.status === 'encerrado') {
      throw new PartidaEventoEncerradoError()
    }
    this._validarParticipacao(evento_id, { jogador_a_id, jogador_b_id, vencedor_id })
    return PartidaRepository.criar({ evento_id, jogador_a_id, jogador_b_id, vencedor_id, data_partida })
  },

  atualizar(id, { jogador_a_id, jogador_b_id, vencedor_id, data_partida }) {
    const partida = this.obter(id)
    const evento = EventoService.obter(partida.evento_id)
    if (evento.status === 'encerrado') {
      throw new PartidaEventoEncerradoError()
    }
    this._validarParticipacao(evento.id, { jogador_a_id, jogador_b_id, vencedor_id })
    return PartidaRepository.atualizar(id, {
      jogador_a_id,
      jogador_b_id,
      vencedor_id,
      data_partida
    })
  },

  excluir(id) {
    const partida = this.obter(id)
    const evento = EventoService.obter(partida.evento_id)
    if (evento.status === 'encerrado') {
      throw new PartidaEventoEncerradoError()
    }
    PartidaRepository.excluir(id)
    return partida
  },

  _validarParticipacao(eventoId, { jogador_a_id, jogador_b_id, vencedor_id }) {
    if (Number(jogador_a_id) === Number(jogador_b_id)) {
      throw new Error('O jogador A não pode ser o mesmo que o jogador B.')
    }
    for (const [campo, id] of [
      ['jogador A', jogador_a_id],
      ['jogador B', jogador_b_id],
      ['vencedor', vencedor_id]
    ]) {
      const jogador = JogadorRepository.obterPorId(id)
      if (!jogador) {
        throw new PartidaJogadorForaDoEventoError(campo)
      }
      if (jogador.evento_id !== eventoId) {
        throw new PartidaJogadorForaDoEventoError(campo)
      }
    }
    if (![Number(jogador_a_id), Number(jogador_b_id)].includes(Number(vencedor_id))) {
      throw new Error('O vencedor deve ser o jogador A ou o jogador B.')
    }
  }
}

module.exports = PartidaService
module.exports.Errors = {
  PartidaNaoEncontradaError,
  PartidaEventoEncerradoError,
  PartidaJogadorForaDoEventoError
}
