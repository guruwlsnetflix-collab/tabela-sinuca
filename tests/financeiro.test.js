import { describe, it, expect, beforeEach } from 'vitest'

const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const PartidaService = require('../src/services/partidaService')
const FinanceiroService = require('../src/services/financeiroService')

function limparDb() {
  db.exec('DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarEvento(extra = {}) {
  return EventoService.criar({
    nome: 'Evento financeiro',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02',
    ...extra
  })
}

describe('EventoService - valor de aposta padrão', () => {
  beforeEach(limparDb)

  it('cria evento com valor de aposta padrão definido', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10.5 })
    expect(evento.valor_aposta_padrao).toBe(10.5)
  })

  it('cria evento sem valor de aposta padrão (default 0)', () => {
    const evento = criarEvento()
    expect(evento.valor_aposta_padrao).toBe(0)
  })

  it('atualiza o valor de aposta padrão', () => {
    const evento = criarEvento()
    EventoService.atualizar(evento.id, {
      nome: evento.nome,
      data_inicio: evento.data_inicio,
      data_fim: evento.data_fim,
      valor_aposta_padrao: 20
    })
    expect(EventoService.obter(evento.id).valor_aposta_padrao).toBe(20)
  })
})

describe('PartidaService - marcação de pagamento', () => {
  beforeEach(limparDb)

  it('registra partida com aposta já paga', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      pago: '1'
    })
    expect(partida.pago).toBe(1)
  })

  it('registra partida sem pagamento por padrão', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    expect(partida.pago).toBe(0)
  })

  it('alterna o estado de pagamento (pendente <-> paga)', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    expect(partida.pago).toBe(0)
    expect(PartidaService.alternarPago(partida.id).pago).toBe(1)
    expect(PartidaService.alternarPago(partida.id).pago).toBe(0)
  })

  it('permite alternar pagamento mesmo em evento encerrado', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    EventoService.mudarStatus(evento.id, 'encerrado')
    expect(PartidaService.alternarPago(partida.id).pago).toBe(1)
  })

  it('normaliza valores de pagamento recebidos do form', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const api = {
      registrar: (extra) =>
        PartidaService.registrar({
          evento_id: evento.id,
          jogador_a_id: a.id,
          jogador_b_id: b.id,
          vencedor_id: a.id,
          ...extra
        })
    }

    expect(api.registrar({ pago: 'on' }).pago).toBe(1)
    expect(api.registrar({ pago: 'true' }).pago).toBe(1)
    expect(api.registrar({ pago: 1 }).pago).toBe(1)
    expect(api.registrar({ pago: true }).pago).toBe(1)
    expect(api.registrar({ pago: 'qualquer' }).pago).toBe(0)
    expect(api.registrar({ pago: '' }).pago).toBe(0)
  })
})

describe('PartidaService - valor de aposta', () => {
  beforeEach(limparDb)

  it('sugere o valor padrão do evento quando a aposta não é informada', () => {
    const evento = criarEvento({ valor_aposta_padrao: 5 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    expect(partida.valor_aposta).toBe(5)
  })

  it('permite definir aposta diferente do padrão', () => {
    const evento = criarEvento({ valor_aposta_padrao: 5 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 0.5
    })
    expect(partida.valor_aposta).toBe(0.5)
  })

  it('permite zerar a aposta mesmo com padrão definido', () => {
    const evento = criarEvento({ valor_aposta_padrao: 5 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 0
    })
    expect(partida.valor_aposta).toBe(0)
  })

  it('rejeita aposta negativa', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    expect(() =>
      PartidaService.registrar({
        evento_id: evento.id,
        jogador_a_id: a.id,
        jogador_b_id: b.id,
        vencedor_id: a.id,
        valor_aposta: -3
      })
    ).toThrow('não pode ser negativo')
  })
})

describe('FinanceiroService', () => {
  beforeEach(limparDb)

  it('calcula a receber, a pagar e saldo de cada jogador', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })

    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: c.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })

    const fin = FinanceiroService.gerar(evento.id)
    const porNome = new Map(fin.jogadoresFinanceiros.map((l) => [l.jogador.nome, l]))

    expect(porNome.get('A').aReceber).toBe(20)
    expect(porNome.get('A').aPagar).toBe(0)
    expect(porNome.get('A').saldo).toBe(20)

    expect(porNome.get('B').aPagar).toBe(10)
    expect(porNome.get('B').saldo).toBe(-10)

    expect(porNome.get('C').aPagar).toBe(10)
    expect(porNome.get('C').saldo).toBe(-10)

    expect(fin.totalMovimentado).toBe(20)
    expect(fin.partidasApostadas).toBe(2)
  })

  it('ignora partidas sem aposta', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })

    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 0
    })

    const fin = FinanceiroService.gerar(evento.id)
    expect(fin.totalMovimentado).toBe(0)
    expect(fin.partidasApostadas).toBe(0)
    expect(fin.acertos).toEqual([])
  })

  it('indica quem deve pagar para quem (câmara de compensação)', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })
    const d = JogadorService.criar({ evento_id: evento.id, nome: 'D' })

    // A vence B (10) — B deve 10 a A
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })
    // C vence D (6) — D deve 6 a C
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: c.id,
      jogador_b_id: d.id,
      vencedor_id: c.id,
      valor_aposta: 6
    })
    // C vence B (4) — B deve 4 a C
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: b.id,
      jogador_b_id: c.id,
      vencedor_id: c.id,
      valor_aposta: 4
    })

    const fin = FinanceiroService.gerar(evento.id)
    expect(fin.totalMovimentado).toBe(20)

    const resumo = fin.acertos.map((ac) => `${ac.devedor.nome}->${ac.credor.nome}:${ac.valor}`).sort()
    expect(resumo).toEqual(['B->A:10', 'B->C:4', 'D->C:6'])
  })

  it('compensa valores quando um jogador deve e recebe ao mesmo tempo', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })

    // A vence B (10) → B deve 10 a A
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })
    // C vence A (4) → A deve 4 a C
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: c.id,
      vencedor_id: c.id,
      valor_aposta: 4
    })

    const fin = FinanceiroService.gerar(evento.id)
    const porNome = new Map(fin.jogadoresFinanceiros.map((l) => [l.jogador.nome, l]))

    expect(porNome.get('A').saldo).toBe(6)
    expect(porNome.get('B').saldo).toBe(-10)
    expect(porNome.get('C').saldo).toBe(4)

    // B paga direto a A (6) e a C (4)
    const resumo = fin.acertos.map((ac) => `${ac.devedor.nome}->${ac.credor.nome}:${ac.valor}`).sort()
    expect(resumo).toEqual(['B->A:6', 'B->C:4'])
  })

  it('retorna situação zerada quando não há jogadores', () => {
    const evento = criarEvento()
    const fin = FinanceiroService.gerar(evento.id)
    expect(fin.jogadoresFinanceiros).toEqual([])
    expect(fin.totalMovimentado).toBe(0)
  })

  it('exclui partidas de desistentes do cálculo corrente', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })

    // A vence B (10) e depois C vence A (6)
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: c.id,
      vencedor_id: c.id,
      valor_aposta: 6
    })
    JogadorService.desistir(b.id)

    const fin = FinanceiroService.gerar(evento.id)
    const porNome = new Map(fin.jogadoresFinanceiros.map((l) => [l.jogador.nome, l]))

    expect(fin.jogadoresFinanceiros).toHaveLength(2)
    expect(porNome.get('B')).toBeUndefined()
    expect(porNome.get('A').aPagar).toBe(6)
    expect(porNome.get('A').saldo).toBe(-6)
    expect(porNome.get('C').aReceber).toBe(6)
    expect(porNome.get('C').saldo).toBe(6)
    expect(fin.totalMovimentado).toBe(6)
    expect(fin.partidasApostadas).toBe(1)

    // Desistente continua com a situação travada de saída
    const dest = fin.desistentes.find((d) => d.jogador.id === b.id)
    expect(dest.aPagar).toBe(10)
    expect(dest.aReceber).toBe(0)
    expect(dest.saldo).toBe(-10)
  })

  it('projeta o acerto de saída do desistente por oponente', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })

    // A vence B (10) → B deve 10 a A; B vence C (4) → C deve 4 a B
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: b.id,
      jogador_b_id: c.id,
      vencedor_id: b.id,
      valor_aposta: 4
    })

    const proj = FinanceiroService.projetarDesistencia(evento.id, b.id)
    expect(proj.jogador.id).toBe(b.id)
    expect(proj.aReceber).toBe(4)
    expect(proj.aPagar).toBe(10)
    expect(proj.saldo).toBe(-6)

    const porOpo = new Map(proj.contas.map((ct) => [ct.oponente.nome, ct]))
    expect(porOpo.get('A').pagar).toBe(10)
    expect(porOpo.get('A').saldo).toBe(-10)
    expect(porOpo.get('C').receber).toBe(4)
    expect(porOpo.get('C').saldo).toBe(4)
  })

  it('rejeita projeção de desistência para jogador já inativo', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    JogadorService.desistir(a.id)
    expect(() => FinanceiroService.projetarDesistencia(evento.id, a.id)).toThrow('já está marcado')
  })

  it('ignora partidas pagas nos saldos e acertos (não pendentes)', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })

    // A vence B (10) já quitada
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10,
      pago: '1'
    })
    // C vence A (6) ainda pendente
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: c.id,
      vencedor_id: c.id,
      valor_aposta: 6
    })

    const fin = FinanceiroService.gerar(evento.id)
    const porNome = new Map(fin.jogadoresFinanceiros.map((l) => [l.jogador.nome, l]))

    // Partida paga não entra nos saldos correntes
    expect(porNome.get('A').aPagar).toBe(6)
    expect(porNome.get('A').saldo).toBe(-6)
    expect(porNome.get('C').aReceber).toBe(6)
    expect(porNome.get('C').saldo).toBe(6)
    expect(porNome.get('B').saldo).toBe(0)

    // Mas a partida paga continua em partidasApostadas/totalMovimentado (quitadas)
    expect(fin.partidasApostadas).toBe(2)
    expect(fin.partidasPagas).toBe(1)
    expect(fin.partidasPendentes).toBe(1)
    expect(fin.totalMovimentado).toBe(16)
    expect(fin.totalPago).toBe(10)
    expect(fin.totalPendente).toBe(6)

    // Quem deve para quem considera só as pendentes (C -> A, 6)
    const resumo = fin.acertos.map((ac) => `${ac.devedor.nome}->${ac.credor.nome}:${ac.valor}`).sort()
    expect(resumo).toEqual(['A->C:6'])
  })

  it('acumula valorQuitado e partidasPagas por jogador', () => {
    const evento = criarEvento({ valor_aposta_padrao: 10 })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })

    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10,
      pago: '1'
    })
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 4,
      pago: '1'
    })

    const fin = FinanceiroService.gerar(evento.id)
    const porNome = new Map(fin.jogadoresFinanceiros.map((l) => [l.jogador.nome, l]))

    expect(porNome.get('A').valorQuitado).toBe(14)
    expect(porNome.get('A').partidasPagas).toBe(2)
    expect(porNome.get('B').valorQuitado).toBe(14)
    expect(porNome.get('B').partidasPagas).toBe(2)
    expect(fin.totalPago).toBe(14)
    expect(fin.totalPendente).toBe(0)
  })

  it('exclui partidas pagas da projeção de desistência', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })

    // A vence B (10) já paga — não deve obrigar B a pagar de novo
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10,
      pago: '1'
    })
    // A vence B (6) pendente
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 6
    })

    const proj = FinanceiroService.projetarDesistencia(evento.id, b.id)
    expect(proj.aPagar).toBe(6)
    expect(proj.saldo).toBe(-6)
  })

  it('exclui partidas pagas da situação travada de desistentes', () => {
    const evento = criarEvento()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })

    // A vence B (10) já paga e depois A vence B (6) pendente
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10,
      pago: '1'
    })
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 6
    })
    JogadorService.desistir(b.id)

    const fin = FinanceiroService.gerar(evento.id)
    const dest = fin.desistentes.find((d) => d.jogador.id === b.id)
    expect(dest.aPagar).toBe(6)
    expect(dest.saldo).toBe(-6)
  })
})
