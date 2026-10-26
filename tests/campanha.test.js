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
    nome: 'Evento campanha',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02'
  })
  const a = JogadorService.criar({ evento_id: evento.id, nome: 'Ana' })
  const b = JogadorService.criar({ evento_id: evento.id, nome: 'Beto' })
  const c = JogadorService.criar({ evento_id: evento.id, nome: 'Carla' })
  return { evento, a, b, c }
}

describe('JogadorService.campanha', () => {
  beforeEach(limparDb)

  it('lista de quem ganhou e para quem perdeu', () => {
    const { evento, a, b, c } = criarCenario()
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: c.id,
      vencedor_id: c.id
    })

    const campanha = JogadorService.campanha(evento.id, a.id)
    expect(campanha.resumo.jogos).toBe(2)
    expect(campanha.resumo.vitorias).toBe(1)
    expect(campanha.resumo.derrotas).toBe(1)

    const vitoria = campanha.partidas.find((p) => p.adversario === 'Beto')
    const derrota = campanha.partidas.find((p) => p.adversario === 'Carla')
    expect(vitoria.vitoria).toBe(true)
    expect(derrota.vitoria).toBe(false)
    expect(derrota.vencedor).toBe('Carla')
  })

  it('jogador sem partidas tem resumo zerado', () => {
    const { evento, a } = criarCenario()
    const campanha = JogadorService.campanha(evento.id, a.id)
    expect(campanha.resumo).toEqual({ vitorias: 0, derrotas: 0, jogos: 0 })
  })

  it('rejeita jogador de outro evento', () => {
    const { evento } = criarCenario()
    const outro = EventoService.criar({
      nome: 'Outro',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    const intruso = JogadorService.criar({ evento_id: outro.id, nome: 'Intruso' })
    expect(() => JogadorService.campanha(evento.id, intruso.id)).toThrow('não pertence a este evento')
  })
})

describe('Rota de campanha', () => {
  beforeEach(limparDb)

  it('GET /eventos/:id/jogadores/:id/campanha exibe a campanha', async () => {
    const { evento, a, b } = criarCenario()
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    const res = await request(app).get(`/eventos/${evento.id}/jogadores/${a.id}/campanha`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Campanha de Ana')
    expect(res.text).toContain('Vitória')
  })
})
