const db = require('../db')
const EventoService = require('./eventoService')
const JogadorRepository = require('../repositories/jogadorRepository')

function paraCentavos(valor) {
  return Math.round((Number(valor) || 0) * 100)
}

function real(valor) {
  return (Number(valor) || 0) / 100
}

/**
 * Controle financeiro por jogador de um evento.
 *
 * Partida com valor de aposta > 0: o perdedor deve pagar ao vencedor.
 * Para cada jogador é calculado:
 *   - aReceber: soma dos valores das partidas que venceu (a receber);
 *   - aPagar:   soma dos valores das partidas que perdeu (a pagar);
 *   - saldo:    aReceber - aPagar (positivo = credor, negativo = devedor).
 *
 * Jogadores que DESISTIRAM no meio do evento (ativo = 0) fazem o acerto no
 * momento da saída e NÃO entram mais nos cálculos correntes: as partidas
 * envolvendo desistentes ficam fora do bolo vivo. Eles aparecem no campo
 * `desistentes` com a situação travada do dia em que saíram.
 *
 * O método `_calcularAcertos` faz a compensação (netting): devedores são
 * casados com credores gerando a lista "quem deve pagar para quem".
 */
const FinanceiroService = {
  /**
   * Agrega por jogador o controle financeiro das partidas enviadas.
   *
   * Partidas PAGAS (pago = 1) saem dos saldos (aReceber/aPagar) e são
   * contabilizadas em partidasPagas/valorQuitado do jogador.
   * Partidas PENDENTES seguem penduradas como aReceber/aPagar.
   */
  _agregarJogadores(jogadores, partidas) {
    const stats = new Map()
    jogadores.forEach((j) => {
      stats.set(j.id, {
        jogador: j,
        partidasApostadas: 0,
        partidasPagas: 0,
        valorQuitado: 0,
        aReceber: 0,
        aPagar: 0
      })
    })

    partidas.forEach((p) => {
      const valor = paraCentavos(p.valor_aposta)
      if (valor <= 0) return

      const vencedor = stats.get(p.vencedor_id)
      const perdedorId = p.jogador_a_id === p.vencedor_id ? p.jogador_b_id : p.jogador_a_id
      const perdedor = stats.get(perdedorId)

      if (p.pago === 1) {
        if (vencedor) {
          vencedor.partidasApostadas += 1
          vencedor.partidasPagas += 1
          vencedor.valorQuitado += valor
        }
        if (perdedor) {
          perdedor.partidasApostadas += 1
          perdedor.partidasPagas += 1
          perdedor.valorQuitado += valor
        }
        return
      }

      if (vencedor) {
        vencedor.aReceber += valor
        vencedor.partidasApostadas += 1
      }
      if (perdedor) {
        perdedor.aPagar += valor
        perdedor.partidasApostadas += 1
      }
    })

    const linhas = [...stats.values()].map((s) => ({
      jogador: s.jogador,
      partidasApostadas: s.partidasApostadas,
      partidasPagas: s.partidasPagas,
      valorQuitado: real(s.valorQuitado),
      aReceber: real(s.aReceber),
      aPagar: real(s.aPagar),
      saldo: real(s.aReceber - s.aPagar)
    }))

    linhas.sort((x, y) => {
      if (y.saldo !== x.saldo) return y.saldo - x.saldo
      return x.jogador.id - y.jogador.id
    })

    return { linhas }
  },

  _partidasDoEvento(eventoId) {
    return db
      .prepare(`
        SELECT id, jogador_a_id, jogador_b_id, vencedor_id, valor_aposta, pago
        FROM partidas
        WHERE evento_id = ?
        ORDER BY data_partida ASC, id ASC
      `)
      .all(eventoId)
  },

  gerar(eventoId) {
    const evento = EventoService.obter(eventoId)
    const jogadores = JogadorRepository.listarPorEvento(evento.id)
    const ativos = jogadores.filter((j) => j.ativo === 1)
    const desistentes = jogadores.filter((j) => j.ativo === 0)

    const todas = this._partidasDoEvento(evento.id)
    const idsAtivos = new Set(ativos.map((j) => j.id))

    // Bolo vivo: apenas partidas entre jogadores que continuam no evento.
    const partidasVivas = todas.filter(
      (p) => idsAtivos.has(p.jogador_a_id) && idsAtivos.has(p.jogador_b_id)
    )

    const { linhas } = this._agregarJogadores(ativos, partidasVivas)

    // Totais do evento: pago + pendente = total movimentado.
    const apostadas = partidasVivas.filter((p) => paraCentavos(p.valor_aposta) > 0)
    const pagas = apostadas.filter((p) => p.pago === 1)
    let somaPago = 0
    pagas.forEach((p) => {
      somaPago += paraCentavos(p.valor_aposta)
    })
    const somaTotal = apostadas.reduce((s, p) => s + paraCentavos(p.valor_aposta), 0)

    // Situação travada de quem saiu (somente partidas ainda não quitadas).
    const dadosDesistentes = desistentes
      .map((j) => {
        const partidasDoJogador = todas.filter(
          (p) => (p.jogador_a_id === j.id || p.jogador_b_id === j.id) && p.pago !== 1
        )
        const { linhas: l } = this._agregarJogadores([j], partidasDoJogador)
        return l[0]
      })
      .filter((l) => l && l.partidasApostadas > 0)

    return {
      evento,
      jogadoresFinanceiros: linhas,
      desistentes: dadosDesistentes,
      partidasApostadas: apostadas.length,
      partidasPagas: pagas.length,
      partidasPendentes: apostadas.length - pagas.length,
      totalMovimentado: real(somaTotal),
      totalPago: real(somaPago),
      totalPendente: real(somaTotal - somaPago),
      acertos: this._calcularAcertos(linhas)
    }
  },

  /**
   * Projeta o acerto de um jogador no momento da desistência:
   * quanto ele deve pagar / deve receber dos jogadores que continuam.
   */
  projetarDesistencia(eventoId, jogadorId) {
    const evento = EventoService.obter(eventoId)
    const jogador = JogadorRepository.obterPorId(jogadorId)
    if (!jogador || jogador.evento_id !== evento.id) {
      throw new Error('Jogador não pertence a este evento.')
    }
    if (jogador.ativo === 0) {
      throw new Error('Jogador já está marcado como desistente.')
    }

    const todosJogadores = JogadorRepository.listarPorEvento(evento.id)
    const idsAtivos = new Set(todosJogadores.filter((j) => j.ativo === 1).map((j) => j.id))

    const partidasDoJogador = this._partidasDoEvento(evento.id).filter(
      (p) => (p.jogador_a_id === jogadorId || p.jogador_b_id === jogadorId) && p.pago !== 1
    )

    const { linhas } = this._agregarJogadores([jogador], partidasDoJogador)
    const situacao = linhas[0]

    const contasPorOponente = new Map()
    partidasDoJogador.forEach((p) => {
      const valor = paraCentavos(p.valor_aposta)
      if (valor <= 0) return
      const oponenteId = p.jogador_a_id === jogadorId ? p.jogador_b_id : p.jogador_a_id
      if (!idsAtivos.has(oponenteId)) return

      let conta = contasPorOponente.get(oponenteId)
      if (!conta) {
        const oponente = JogadorRepository.obterPorId(oponenteId)
        conta = { oponente, receber: 0, pagar: 0 }
        contasPorOponente.set(oponenteId, conta)
      }
      if (p.vencedor_id === jogadorId) {
        conta.receber += valor
      } else {
        conta.pagar += valor
      }
    })

    const contas = [...contasPorOponente.values()]
      .map((c) => ({
        ...c,
        receber: real(c.receber),
        pagar: real(c.pagar),
        saldo: real(c.receber - c.pagar)
      }))
      .sort((a, b) => b.saldo - a.saldo)

    return { jogador, ...situacao, contas }
  },

  _calcularAcertos(linhas) {
    const devedores = linhas
      .filter((l) => l.saldo < 0)
      .map((l) => ({
        jogador: l.jogador,
        restante: paraCentavos(-l.saldo)
      }))
      .sort((a, b) => b.restante - a.restante)

    const credores = linhas
      .filter((l) => l.saldo > 0)
      .map((l) => ({
        jogador: l.jogador,
        restante: paraCentavos(l.saldo)
      }))
      .sort((a, b) => b.restante - a.restante)

    const acertos = []
    credores.forEach((credor) => {
      for (const devedor of devedores) {
        if (credor.restante <= 0 || devedor.restante <= 0) continue
        const valor = Math.min(credor.restante, devedor.restante)
        if (valor <= 0) continue
        acertos.push({
          devedor: {
            id: devedor.jogador.id,
            nome: devedor.jogador.nome,
            apelido: devedor.jogador.apelido
          },
          credor: {
            id: credor.jogador.id,
            nome: credor.jogador.nome,
            apelido: credor.jogador.apelido
          },
          valor: real(valor)
        })
        credor.restante -= valor
        devedor.restante -= valor
      }
    })
    return acertos
  }
}

module.exports = FinanceiroService