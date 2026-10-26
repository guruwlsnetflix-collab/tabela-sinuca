import { describe, it, expect, beforeEach } from 'vitest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const PartidaService = require('../src/services/partidaService')
const { agenteMestre } = require('./authHelper')

function limparDb() {
  db.exec('DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarCenario() {
  const evento = EventoService.criar({
    nome: 'Evento de partidas',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02'
  })
  const a = JogadorService.criar({ evento_id: evento.id, nome: 'Jogador A' })
  const b = JogadorService.criar({ evento_id: evento.id, nome: 'Jogador B' })
  return { evento, a, b }
}

describe('PartidaService', () => {
  beforeEach(limparDb)

  it('registra partida e define o vencedor', () => {
    const { evento, a, b } = criarCenario()
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    expect(partida.id).toBeTruthy()
    expect(partida.vencedor).toBe('Jogador A')
  })

  it('rejeita jogador contra si mesmo', () => {
    const { evento, a } = criarCenario()
    expect(() =>
      PartidaService.registrar({
        evento_id: evento.id,
        jogador_a_id: a.id,
        jogador_b_id: a.id,
        vencedor_id: a.id
      })
    ).toThrow('não pode ser o mesmo')
  })

  it('rejeita vencedor fora da partida', () => {
    const evento = EventoService.criar({
      nome: 'Com três jogadores',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })
    expect(() =>
      PartidaService.registrar({
        evento_id: evento.id,
        jogador_a_id: a.id,
        jogador_b_id: b.id,
        vencedor_id: c.id
      })
    ).toThrow('O vencedor deve ser o jogador A ou o jogador B.')
  })

  it('rejeita jogador que não pertence ao evento', () => {
    const { evento, a, b } = criarCenario()
    const outro = EventoService.criar({
      nome: 'Outro evento',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    const intruso = JogadorService.criar({ evento_id: outro.id, nome: 'Intruso' })
    expect(() =>
      PartidaService.registrar({
        evento_id: evento.id,
        jogador_a_id: a.id,
        jogador_b_id: intruso.id,
        vencedor_id: b.id
      })
    ).toThrow('não pertence a este evento')
  })

  it('bloqueia partida envolvendo jogador desistente', () => {
    const evento = EventoService.criar({
      nome: 'Com desistente',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })

    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    JogadorService.desistir(b.id)

    expect(() =>
      PartidaService.registrar({
        evento_id: evento.id,
        jogador_a_id: b.id,
        jogador_b_id: c.id,
        vencedor_id: c.id
      })
    ).toThrow('parou de jogar')
  })

  it('bloqueia registrar partida em evento encerrado', () => {
    const { evento, a, b } = criarCenario()
    EventoService.mudarStatus(evento.id, 'encerrado')
    expect(() =>
      PartidaService.registrar({
        evento_id: evento.id,
        jogador_a_id: a.id,
        jogador_b_id: b.id,
        vencedor_id: a.id
      })
    ).toThrow('evento encerrado')
  })

  it('edita partida alterando o vencedor', () => {
    const { evento, a, b } = criarCenario()
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    const atualizada = PartidaService.atualizar(partida.id, {
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: b.id
    })
    expect(atualizada.vencedor).toBe('Jogador B')
  })

  it('exclui partida', () => {
    const { evento, a, b } = criarCenario()
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    PartidaService.excluir(partida.id)
    expect(() => PartidaService.obter(partida.id)).toThrow('Partida não encontrada.')
  })
})

describe('Rotas de partidas', () => {
  beforeEach(limparDb)

  it('POST /eventos/:id/partidas registra e redireciona', async () => {
    const { evento, a, b } = criarCenario()
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({ jogador_a_id: String(a.id), jogador_b_id: String(b.id), vencedor_id: String(a.id) })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`/eventos/${evento.id}?msg=Partida%20registrada%20com%20sucesso.`)
  })

  it('POST registra aposta e aplica o padrão quando o campo vem vazio', async () => {
    const evento = EventoService.criar({
      nome: 'Com aposta padrão',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02',
      valor_aposta_padrao: 7
    })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({
        jogador_a_id: String(a.id),
        jogador_b_id: String(b.id),
        vencedor_id: String(a.id),
        valor_aposta: ''
      })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`/eventos/${evento.id}?msg=Partida%20registrada%20com%20sucesso.`)
    expect(PartidaService.listarPorEvento(evento.id)[0].valor_aposta).toBe(7)
  })

  it('POST rejeita aposta negativa', async () => {
    const { evento, a, b } = criarCenario()
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({
        jogador_a_id: String(a.id),
        jogador_b_id: String(b.id),
        vencedor_id: String(a.id),
        valor_aposta: '-10'
      })
    expect(res.status).toBe(400)
    expect(res.text).toContain('valor da aposta')
  })

  it('GET form de nova partida sugesta o valor padrão do evento', async () => {
    const evento = EventoService.criar({
      nome: 'Sugestão de aposta',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02',
      valor_aposta_padrao: 9.5
    })
    JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const agente = await agenteMestre(app)
    const res = await agente.get(`/eventos/${evento.id}/partidas/novo`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Sugerido automaticamente')
    expect(res.text).toContain('R$ 9,50')
  })

  it('GET form de nova partida inicia a data com a data de início do evento', async () => {
    const evento = EventoService.criar({
      nome: 'Sugestão de data',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    const agente = await agenteMestre(app)
    const res = await agente.get(`/eventos/${evento.id}/partidas/novo`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('value="2026-08-01T00:00"')
  })

  it('POST rejeita vencedor que não é participante', async () => {
    const { evento, a, b } = criarCenario()
    const outro = EventoService.criar({
      nome: 'Outro',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    const intruso = JogadorService.criar({ evento_id: outro.id, nome: 'Intruso' })
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({ jogador_a_id: String(a.id), jogador_b_id: String(b.id), vencedor_id: String(intruso.id) })
    expect(res.status).toBe(400)
    // O validador intercepta antes do service, mas mantém a rejeição
    // de um vencedor que não é participante (400).
    expect(res.text).toMatch(/vencedor deve ser o jogador A ou o jogador B|não pertence a este evento/)
  })

  it('POST rejeita jogador A igual ao jogador B com erro de campo', async () => {
    const { evento, a } = criarCenario()
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({ jogador_a_id: String(a.id), jogador_b_id: String(a.id), vencedor_id: String(a.id) })
    expect(res.status).toBe(400)
    expect(res.text).toContain('O jogador B não pode ser o mesmo que o jogador A.')
  })

  it('POST rejeita vencedor que não é um dos dois jogadores da partida', async () => {
    const { evento, a, b } = criarCenario()
    const c = JogadorService.criar({ evento_id: evento.id, nome: 'C' })
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({ jogador_a_id: String(a.id), jogador_b_id: String(b.id), vencedor_id: String(c.id) })
    expect(res.status).toBe(400)
    expect(res.text).toContain('O vencedor deve ser o jogador A ou o jogador B.')
  })

  it('GET form de nova partida avisa quando faltam jogadores', async () => {
    const evento = EventoService.criar({
      nome: 'Evento com 1 jogador',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    JogadorService.criar({ evento_id: evento.id, nome: 'Único' })
    const agente = await agenteMestre(app)
    const res = await agente.get(`/eventos/${evento.id}/partidas/novo`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('ao menos')
  })

  it('POST registra partida com aposta já paga quando o checkbox é enviado', async () => {
    const { evento, a, b } = criarCenario()
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({
        jogador_a_id: String(a.id),
        jogador_b_id: String(b.id),
        vencedor_id: String(a.id),
        valor_aposta: '10',
        pago: '1'
      })
    expect(res.status).toBe(302)
    expect(PartidaService.listarPorEvento(evento.id)[0].pago).toBe(1)
  })

  it('POST /partidas/:id/pago alterna para paga', async () => {
    const { evento, a, b } = criarCenario()
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10
    })
    const agente = await agenteMestre(app)
    const res = await agente.post(`/eventos/${evento.id}/partidas/${partida.id}/pago`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(
      `/eventos/${evento.id}?msg=${encodeURIComponent('Partida marcada como paga.')}`
    )
    expect(PartidaService.obter(partida.id).pago).toBe(1)
  })

  it('POST /partidas/:id/pago alterna pendente de volta', async () => {
    const { evento, a, b } = criarCenario()
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10,
      pago: '1'
    })
    const agente = await agenteMestre(app)
    const res = await agente.post(`/eventos/${evento.id}/partidas/${partida.id}/pago`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(
      `/eventos/${evento.id}?msg=${encodeURIComponent('Partida marcada como pendente.')}`
    )
    expect(PartidaService.obter(partida.id).pago).toBe(0)
  })

  it('POST /partidas/:id/pago redireciona com erro para partida inexistente', async () => {
    const { evento } = criarCenario()
    const agente = await agenteMestre(app)
    const res = await agente.post(`/eventos/${evento.id}/partidas/99999/pago`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain(encodeURIComponent('Partida não encontrada.'))
  })

  it('GET form de edição exibe checkbox marcado quando a partida está paga', async () => {
    const { evento, a, b } = criarCenario()
    const partida = PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id,
      valor_aposta: 10,
      pago: '1'
    })
    const agente = await agenteMestre(app)
    const res = await agente.get(`/eventos/${evento.id}/partidas/${partida.id}/editar`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Aposta já quitada')
    expect(res.text).toContain('checked')
  })
})
