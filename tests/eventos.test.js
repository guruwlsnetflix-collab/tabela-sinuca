import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')

function limparDb() {
  db.exec('DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

describe('EventoService', () => {
  beforeEach(limparDb)

  it('cria um evento com status planejado', () => {
    const evento = EventoService.criar({
      nome: 'Torneio de Sexta',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    expect(evento.id).toBeTruthy()
    expect(evento.status).toBe('planejado')
  })

  it('rejeita nome duplicado', () => {
    EventoService.criar({ nome: 'Campeonato', data_inicio: '2026-08-01', data_fim: '2026-08-02' })
    expect(() =>
      EventoService.criar({ nome: 'Campeonato', data_inicio: '2026-09-01', data_fim: '2026-09-02' })
    ).toThrow('Já existe um evento com este nome.')
  })

  it('lança erro ao obter evento inexistente', () => {
    expect(() => EventoService.obter(999)).toThrow('Evento não encontrado.')
  })

  it('muda o status do evento', () => {
    const evento = EventoService.criar({
      nome: 'Torneio',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    EventoService.mudarStatus(evento.id, 'em_andamento')
    expect(EventoService.obter(evento.id).status).toBe('em_andamento')
  })

  it('bloqueia exclusão de evento com partidas', () => {
    const evento = EventoService.criar({
      nome: 'Com partidas',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const jogadorA = db
      .prepare('INSERT INTO jogadores (evento_id, nome) VALUES (?, ?)')
      .run(evento.id, 'João')
    const jogadorB = db
      .prepare('INSERT INTO jogadores (evento_id, nome) VALUES (?, ?)')
      .run(evento.id, 'Maria')
    db.prepare(
      'INSERT INTO partidas (evento_id, jogador_a_id, jogador_b_id, vencedor_id) VALUES (?, ?, ?, ?)'
    ).run(evento.id, jogadorA.lastInsertRowid, jogadorB.lastInsertRowid, jogadorA.lastInsertRowid)

    expect(() => EventoService.excluir(evento.id)).toThrow('Não é possível excluir')
  })

  it('exclui evento sem partidas', () => {
    const evento = EventoService.criar({
      nome: 'Sem partidas',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    EventoService.excluir(evento.id)
    expect(() => EventoService.obter(evento.id)).toThrow('Evento não encontrado.')
  })
})

describe('Rotas de eventos', () => {
  beforeEach(limparDb)

  it('POST /eventos cria um evento e redireciona', async () => {
    const res = await request(app)
      .post('/eventos')
      .type('form')
      .send({ nome: 'Torneio de Domingo', data_inicio: '2026-08-09', data_fim: '2026-08-09' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(/^\/eventos\/\d+/)
  })

  it('POST /eventos rejeita nome duplicado', async () => {
    await request(app).post('/eventos').type('form').send({
      nome: 'Único',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const res = await request(app).post('/eventos').type('form').send({
      nome: 'Único',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02'
    })
    expect(res.status).toBe(400)
    expect(res.text).toContain('Já existe um evento com este nome.')
  })

  it('POST /eventos rejeita data de fim menor que início', async () => {
    const res = await request(app).post('/eventos').type('form').send({
      nome: 'Datas inválidas',
      data_inicio: '2026-08-10',
      data_fim: '2026-08-01'
    })
    expect(res.status).toBe(400)
    expect(res.text).toContain('data de fim')
  })

  it('GET /eventos/:id exibe detalhes', async () => {
    const evento = EventoService.criar({
      nome: 'Detalhe',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const res = await request(app).get(`/eventos/${evento.id}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Detalhe')
  })

  it('GET /eventos/:id/relatorio exibe o relatório com as seções', async () => {
    const evento = EventoService.criar({
      nome: 'Torneio Relatório',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02'
    })
    const a = db
      .prepare('INSERT INTO jogadores (evento_id, nome) VALUES (?, ?)')
      .run(evento.id, 'João')
    const b = db
      .prepare('INSERT INTO jogadores (evento_id, nome) VALUES (?, ?)')
      .run(evento.id, 'Maria')
    db.prepare(
      'INSERT INTO partidas (evento_id, jogador_a_id, jogador_b_id, vencedor_id) VALUES (?, ?, ?, ?)'
    ).run(evento.id, a.lastInsertRowid, b.lastInsertRowid, a.lastInsertRowid)

    const res = await request(app).get(`/eventos/${evento.id}/relatorio`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Torneio Relatório')
    expect(res.text).toContain('Resumo do Evento')
    expect(res.text).toContain('Jogadores Cadastrados')
    expect(res.text).toContain('Ranking')
    expect(res.text).toContain('Partidas por Jogador')
    expect(res.text).toContain('Imprimir')
    expect(res.text).toContain('Salvar em PDF')
    expect(res.text).toContain('Compartilhar')
    expect(res.text).toContain('Fechar')
  })

  it('GET /eventos/:id inexistente responde 404', async () => {
    const res = await request(app).get('/eventos/9999')
    expect(res.status).toBe(404)
  })
})
