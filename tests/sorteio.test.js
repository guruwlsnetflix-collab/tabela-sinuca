import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const PartidaService = require('../src/services/partidaService')
const SorteioService = require('../src/services/sorteioService')

function limparDb() {
  db.exec('DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarEventoComJogadores(nomes) {
  const evento = EventoService.criar({
    nome: 'Evento do sorteio',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02'
  })
  const jogadores = nomes.map((nome) => JogadorService.criar({ evento_id: evento.id, nome }))
  return { evento, jogadores }
}

describe('SorteioService', () => {
  beforeEach(limparDb)

  it('nunca sorteia o próprio vencedor', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B', 'C', 'D'])
    const vencedor = jogadores[0]
    for (let i = 0; i < 50; i += 1) {
      const { sugestao } = SorteioService.sugerirProximoAdversario(evento.id, vencedor.id)
      expect(sugestao.id).not.toBe(vencedor.id)
    }
  })

  it('evita repetir o último adversário enquanto houver opções', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B', 'C'])
    const [a, b, c] = jogadores
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    const { sugestao, ultimoAdversario } = SorteioService.sugerirProximoAdversario(evento.id, a.id)
    expect(ultimoAdversario).toBe(b.id)
    expect(sugestao.id).toBe(c.id)
  })

  it('permite sortear o último adversário quando não há outras opções', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B'])
    const [a, b] = jogadores
    PartidaService.registrar({
      evento_id: evento.id,
      jogador_a_id: a.id,
      jogador_b_id: b.id,
      vencedor_id: a.id
    })
    const { sugestao } = SorteioService.sugerirProximoAdversario(evento.id, a.id)
    expect(sugestao.id).toBe(b.id)
  })

  it('retorna semOponente quando não há adversários', () => {
    const evento = EventoService.criar({
      nome: 'Evento vazio',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'Só eu' })
    const { sugestao, semOponente } = SorteioService.sugerirProximoAdversario(evento.id, a.id)
    expect(semOponente).toBe(true)
    expect(sugestao).toBeNull()
  })

  it('lança erro para vencedor de outro evento', () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B'])
    const outro = EventoService.criar({
      nome: 'Outro',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    const intruso = JogadorService.criar({ evento_id: outro.id, nome: 'Intruso' })
    expect(() => SorteioService.sugerirProximoAdversario(evento.id, intruso.id)).toThrow()
  })
})

describe('Rota de sorteio', () => {
  beforeEach(limparDb)

  it('GET /eventos/:id/sorteio sugere um adversário', async () => {
    const { evento, jogadores } = criarEventoComJogadores(['A', 'B', 'C'])
    const res = await request(app).get(`/eventos/${evento.id}/sorteio?vencedor_id=${jogadores[0].id}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Próximo confronto sugerido')
  })

  it('GET /eventos/:id/sorteio redireciona com erro para vencedor inválido', async () => {
    const { evento } = criarEventoComJogadores(['A', 'B'])
    const res = await request(app).get(`/eventos/${evento.id}/sorteio?vencedor_id=9999`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('erro=')
  })
})
