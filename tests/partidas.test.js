import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const PartidaService = require('../src/services/partidaService')

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
    const res = await request(app)
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({ jogador_a_id: String(a.id), jogador_b_id: String(b.id), vencedor_id: String(a.id) })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`/eventos/${evento.id}?msg=Partida%20registrada%20com%20sucesso.`)
  })

  it('POST rejeita vencedor que não é participante', async () => {
    const { evento, a, b } = criarCenario()
    const outro = EventoService.criar({
      nome: 'Outro',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    const intruso = JogadorService.criar({ evento_id: outro.id, nome: 'Intruso' })
    const res = await request(app)
      .post(`/eventos/${evento.id}/partidas`)
      .type('form')
      .send({ jogador_a_id: String(a.id), jogador_b_id: String(b.id), vencedor_id: String(intruso.id) })
    expect(res.status).toBe(400)
    expect(res.text).toContain('não pertence a este evento')
  })

  it('GET form de nova partida avisa quando faltam jogadores', async () => {
    const evento = EventoService.criar({
      nome: 'Evento com 1 jogador',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    JogadorService.criar({ evento_id: evento.id, nome: 'Único' })
    const res = await request(app).get(`/eventos/${evento.id}/partidas/novo`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('ao menos')
  })
})
