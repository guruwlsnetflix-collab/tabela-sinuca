const EventoRepository = require('../repositories/eventoRepository')
const AuthService = require('./authService')

const STATUS_VALIDOS = ['planejado', 'em_andamento', 'encerrado']

class EventoNaoEncontradoError extends Error {
  constructor() {
    super('Evento não encontrado.')
    this.status = 404
  }
}

class EventoNomeDuplicadoError extends Error {
  constructor() {
    super('Já existe um evento com este nome.')
    this.status = 400
  }
}

class EventoExclusaoBloqueadaError extends Error {
  constructor() {
    super('Não é possível excluir um evento que possui partidas registradas.')
    this.status = 400
  }
}

const EventoService = {
  statusValidos: STATUS_VALIDOS,

  _normalizarAposta(valor) {
    if (valor === undefined || valor === null || valor === '') {
      return 0
    }
    const v = Math.round((Number(valor) || 0) * 100) / 100
    if (v < 0) {
      throw new Error('O valor da aposta padrão não pode ser negativo.')
    }
    return v
  },

  listar() {
    return EventoRepository.listar()
  },

  obter(id) {
    const evento = EventoRepository.obterPorId(id)
    if (!evento) {
      throw new EventoNaoEncontradoError()
    }
    return evento
  },

  criar({ nome, data_inicio, data_fim, valor_aposta_padrao, senha }) {
    if (EventoRepository.obterPorNome(nome)) {
      throw new EventoNomeDuplicadoError()
    }
    return EventoRepository.criar({
      nome,
      data_inicio,
      data_fim,
      valor_aposta_padrao: this._normalizarAposta(valor_aposta_padrao),
      senha_hash: senha && String(senha).trim() ? AuthService.hashSenha(senha) : null
    })
  },

  atualizar(id, { nome, data_inicio, data_fim, status, valor_aposta_padrao, senha }) {
    this.obter(id)
    if (EventoRepository.obterPorNome(nome, id)) {
      throw new EventoNomeDuplicadoError()
    }
    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
      throw new Error('Status inválido.')
    }
    if (status) {
      EventoRepository.atualizarStatus(id, status)
    }
    if (senha && String(senha).trim()) {
      EventoRepository.atualizarSenha(id, AuthService.hashSenha(senha))
    }
    return EventoRepository.atualizar(id, {
      nome,
      data_inicio,
      data_fim,
      valor_aposta_padrao: this._normalizarAposta(valor_aposta_padrao)
    })
  },

  mudarStatus(id, status) {
    this.obter(id)
    if (!STATUS_VALIDOS.includes(status)) {
      throw new Error('Status inválido.')
    }
    return EventoRepository.atualizarStatus(id, status)
  },

  excluir(id) {
    const evento = this.obter(id)
    if (EventoRepository.contarPartidas(id) > 0) {
      throw new EventoExclusaoBloqueadaError()
    }
    EventoRepository.excluir(id)
    return evento
  }
}

module.exports = EventoService
module.exports.Errors = {
  EventoNaoEncontradoError,
  EventoNomeDuplicadoError,
  EventoExclusaoBloqueadaError
}
