import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const PartidaService = require('../src/services/partidaService')
const RankingService = require('../src/services/rankingService')

function limparDb() {
  db.exec('DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarEventoComJogadores(nomes) {
  const evento = EventoService.criar({
    nome: 'Evento ranking',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02'
  })
  const jogadores = nomes.map((nome) => JogadorService.criar({ evento_id: evento.id, nome }))
  return { evento, jogadores }
}

function registrar(evento, a, b, vencedor) {
  PartidaService.registrar({
    evento_id: evento.id,
    jogador_a_id: a.id,
    jogador_b_id: b.id,
    vencedor_id: vencedor.id
  })
}

describe('RankingService', () => {
  beforeEach(limparDb)

  it('ordena por vitórias e derrotas', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B', 'C', 'D'])
    const [a, b, c, d] = jogadores
    registrar(evento, a, b, a)
    registrar(evento, a, c, a)
    registrar(evento, a, d, d)
    registrar(evento, b, c, b)
    registrar(evento, b, d, b)
    registrar(evento, c, d, c)

    const ranking = RankingService.gerar(evento.id)
    expect(ranking.map((r) => r.jogador.nome)).toEqual(['A', 'B', 'C', 'D'])
    expect(ranking[0].vitorias).toBe(2)
    expect(ranking[0].derrotas).toBe(1)
    expect(ranking[1].vitorias).toBe(2)
    expect(ranking[1].derrotas).toBe(1)
    expect(ranking[3].vitorias).toBe(1)
  })

  it('usa a ordem de cadastro como desempate final', () => {
    const { evento, jogadores } = criarEventoComJogadores(['X', 'Y'])
    const [x, y] = jogadores
    registrar(evento, x, y, x)
    registrar(evento, y, x, y)
    const ranking = RankingService.gerar(evento.id)
    expect(ranking[0].jogador.id).toBe(x.id)
  })

  it('inclui jogadores sem partidas no final com 0 jogos', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B', 'C'])
    const [a, b] = jogadores
    registrar(evento, a, b, a)
    const ranking = RankingService.gerar(evento.id)
    const semJogos = ranking.find((r) => r.jogador.nome === 'C')
    expect(semJogos.jogos).toBe(0)
    expect(semJogos.posicao).toBe(3)
  })

  it('calcula aproveitamento percentual', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B'])
    const [a, b] = jogadores
    registrar(evento, a, b, a)
    const ranking = RankingService.gerar(evento.id)
    expect(ranking[0].aproveitamento).toBe(100)
    expect(ranking[1].aproveitamento).toBe(0)
  })

  it('isola o ranking entre eventos', () => {
    const e1 = EventoService.criar({ nome: 'E1', data_inicio: '2026-08-01', data_fim: '2026-08-02' })
    const e2 = EventoService.criar({ nome: 'E2', data_inicio: '2026-09-01', data_fim: '2026-09-02' })
    const a = JogadorService.criar({ evento_id: e1.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: e1.id, nome: 'B' })
    const c = JogadorService.criar({ evento_id: e2.id, nome: 'C' })
    registrar(e1, a, b, a)
    const rankingE1 = RankingService.gerar(e1.id)
    const rankingE2 = RankingService.gerar(e2.id)
    expect(rankingE1.some((r) => r.jogador.id === c.id)).toBe(false)
    expect(rankingE2[0].jogos).toBe(0)
  })
})

describe('Ranking na página do evento', () => {
  beforeEach(limparDb)

  it('GET /eventos/:id exibe o ranking', async () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B'])
    const [a, b] = jogadores
    registrar(evento, a, b, a)
    const res = await request(app).get(`/eventos/${evento.id}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Ranking')
    expect(res.text).toContain('Vitórias')
    expect(res.text).toContain('Aproveitamento')
  })
})
