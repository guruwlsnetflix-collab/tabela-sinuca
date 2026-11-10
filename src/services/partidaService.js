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

class PartidaApostaNegativaError extends Error {
  constructor() {
    super('O valor da aposta não pode ser negativo.')
    this.status = 400
  }
}

class PartidaJogadorDesistenteError extends Error {
  constructor(nome) {
    super(`O jogador "${nome}" parou de jogar neste evento.`)
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

  // Garante que a partida pertence ao evento da URL (ver JogadorService.obterDoEvento)
  obterDoEvento(eventoId, id) {
    const partida = PartidaRepository.obterPorId(id)
    if (!partida || partida.evento_id !== Number(eventoId)) {
      throw new PartidaNaoEncontradaError()
    }
    return partida
  },

  registrar({ evento_id, jogador_a_id, jogador_b_id, vencedor_id, data_partida, valor_aposta, pago }) {
    const evento = EventoService.obter(evento_id)
    if (evento.status === 'encerrado') {
      throw new PartidaEventoEncerradoError()
    }
    this._validarParticipacao(evento_id, { jogador_a_id, jogador_b_id, vencedor_id })
    const aposta = this._normalizarAposta(valor_aposta, evento.valor_aposta_padrao)
    return PartidaRepository.criar({
      evento_id,
      jogador_a_id,
      jogador_b_id,
      vencedor_id,
      data_partida,
      valor_aposta: aposta,
      pago: this._normalizarPago(pago)
    })
  },

  atualizar(id, { jogador_a_id, jogador_b_id, vencedor_id, data_partida, valor_aposta, pago }) {
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
      data_partida,
      valor_aposta: this._normalizarAposta(valor_aposta, partida.valor_aposta),
      pago: this._normalizarPago(pago)
    })
  },

  // Marca/desmarca a quitação da aposta. Permitido mesmo em evento encerrado,
  // pois é apenas o registro de um pagamento.
  alternarPago(id) {
    this.obter(id)
    return PartidaRepository.alternarPago(id)
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

  _normalizarAposta(valor, padrao) {
    const grande = (v) => Math.round((Number(v) || 0) * 100) / 100
    let aposta
    if (valor === undefined || valor === null || valor === '') {
      aposta = grande(padrao)
    } else {
      aposta = grande(valor)
    }
    if (aposta < 0) {
      throw new PartidaApostaNegativaError()
    }
    return aposta
  },

  _normalizarPago(valor) {
    if (valor === undefined || valor === null || valor === '') return 0
    if (valor === true || valor === 1 || valor === '1' || valor === 'on' || valor === 'true') {
      return 1
    }
    return 0
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
      if (jogador.ativo === 0) {
        throw new PartidaJogadorDesistenteError(jogador.nome)
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
  PartidaJogadorForaDoEventoError,
  PartidaApostaNegativaError,
  PartidaJogadorDesistenteError
}
