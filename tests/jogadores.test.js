import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')

function limparDb() {
  db.exec('DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarEventoAtivo() {
  return EventoService.criar({
    nome: 'Evento de teste',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02'
  })
}

describe('JogadorService', () => {
  beforeEach(limparDb)

  it('cadastra jogador em um evento', () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'João da Sinuca' })
    expect(jogador.id).toBeTruthy()
    expect(jogador.evento_id).toBe(evento.id)
  })

  it('lança erro ao cadastrar jogador em evento inexistente', () => {
    expect(() => JogadorService.criar({ evento_id: 999, nome: 'X' })).toThrow('Evento não encontrado.')
  })

  it('bloqueia cadastro de jogador em evento encerrado', () => {
    const evento = criarEventoAtivo()
    EventoService.mudarStatus(evento.id, 'encerrado')
    expect(() => JogadorService.criar({ evento_id: evento.id, nome: 'X' })).toThrow(
      'evento encerrado'
    )
  })

  it('bloqueia exclusão de jogador com partidas', () => {
    const evento = criarEventoAtivo()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    db.prepare(
      'INSERT INTO partidas (evento_id, jogador_a_id, jogador_b_id, vencedor_id) VALUES (?, ?, ?, ?)'
    ).run(evento.id, a.id, b.id, a.id)
    expect(() => JogadorService.excluir(a.id)).toThrow('partidas registradas')
  })

  it('exclui jogador sem partidas', () => {
    const evento = criarEventoAtivo()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    JogadorService.excluir(a.id)
    expect(() => JogadorService.obter(a.id)).toThrow('Jogador não encontrado.')
  })

  it('isola jogadores entre eventos', () => {
    const e1 = criarEventoAtivo()
    const e2 = EventoService.criar({
      nome: 'Segundo evento',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    JogadorService.criar({ evento_id: e1.id, nome: 'Só do evento 1' })
    JogadorService.criar({ evento_id: e2.id, nome: 'Só do evento 2' })
    expect(JogadorService.listarPorEvento(e1.id)).toHaveLength(1)
    expect(JogadorService.listarPorEvento(e2.id)).toHaveLength(1)
  })
})

describe('Rotas de jogadores', () => {
  beforeEach(limparDb)

  it('POST /eventos/:id/jogadores cadastra e redireciona', async () => {
    const evento = criarEventoAtivo()
    const res = await request(app)
      .post(`/eventos/${evento.id}/jogadores`)
      .type('form')
      .send({ nome: 'Maria', apelido: 'Mari', telefone: '11999999999' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`/eventos/${evento.id}?msg=Jogador%20cadastrado%20com%20sucesso.`)
  })

  it('POST /eventos/:id/jogadores rejeita nome vazio', async () => {
    const evento = criarEventoAtivo()
    const res = await request(app)
      .post(`/eventos/${evento.id}/jogadores`)
      .type('form')
      .send({ nome: '', apelido: '', telefone: '' })
    expect(res.status).toBe(400)
    expect(res.text).toContain('obrigatório')
  })

  it('GET /eventos/:id/jogadores/:id/editar exibe o formulário', async () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'Carlos' })
    const res = await request(app).get(`/eventos/${evento.id}/jogadores/${jogador.id}/editar`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Editar jogador')
    expect(res.text).toContain('Carlos')
  })
})
