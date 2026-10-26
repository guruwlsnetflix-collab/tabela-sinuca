import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const { agenteMestre } = require('./authHelper')

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

  it('permite cadastrar jogador após o evento ter iniciado (em andamento)', () => {
    const evento = criarEventoAtivo()
    EventoService.mudarStatus(evento.id, 'em_andamento')
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'Chegou depois' })
    expect(jogador.id).toBeTruthy()
    expect(jogador.evento_id).toBe(evento.id)
  })

  it('permite editar jogador após o evento ter iniciado (em andamento)', () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'Antes' })
    EventoService.mudarStatus(evento.id, 'em_andamento')
    JogadorService.atualizar(jogador.id, { nome: 'Depois', apelido: '', telefone: '', ativo: true })
    expect(JogadorService.obter(jogador.id).nome).toBe('Depois')
  })

  it('marca jogador como desistente (inativo)', () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'Vai embora' })
    const desistente = JogadorService.desistir(jogador.id)
    expect(desistente.ativo).toBe(0)
  })

  it('bloqueia desistência de jogador em evento encerrado', () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'X' })
    EventoService.mudarStatus(evento.id, 'encerrado')
    expect(() => JogadorService.desistir(jogador.id)).toThrow('evento encerrado')
  })

  it('bloqueia desistência repetida', () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'X' })
    JogadorService.desistir(jogador.id)
    expect(() => JogadorService.desistir(jogador.id)).toThrow('já está marcado')
  })

  it('exclui desistentes do ranking', () => {
    const evento = criarEventoAtivo()
    const a = JogadorService.criar({ evento_id: evento.id, nome: 'A' })
    const b = JogadorService.criar({ evento_id: evento.id, nome: 'B' })
    db.prepare(
      'INSERT INTO partidas (evento_id, jogador_a_id, jogador_b_id, vencedor_id, valor_aposta) VALUES (?, ?, ?, ?, 0)'
    ).run(evento.id, a.id, b.id, a.id)

    JogadorService.desistir(b.id)

    const RankingService = require('../src/services/rankingService')
    const ranking = RankingService.gerar(evento.id)
    expect(ranking).toHaveLength(1)
    expect(ranking[0].jogador.id).toBe(a.id)
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
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/jogadores`)
      .type('form')
      .send({ nome: 'Maria', apelido: 'Mari', telefone: '11999999999' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`/eventos/${evento.id}?msg=Jogador%20cadastrado%20com%20sucesso.`)
  })

  it('POST /eventos/:id/jogadores rejeita nome vazio', async () => {
    const evento = criarEventoAtivo()
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/jogadores`)
      .type('form')
      .send({ nome: '', apelido: '', telefone: '' })
    expect(res.status).toBe(400)
    expect(res.text).toContain('obrigatório')
  })

  it('POST /eventos/:id/jogadores cadastra mesmo com evento em andamento', async () => {
    const evento = criarEventoAtivo()
    EventoService.mudarStatus(evento.id, 'em_andamento')
    const agente = await agenteMestre(app)
    const res = await agente
      .post(`/eventos/${evento.id}/jogadores`)
      .type('form')
      .send({ nome: 'Mariano', apelido: '', telefone: '' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`/eventos/${evento.id}?msg=Jogador%20cadastrado%20com%20sucesso.`)
  })

  it('POST /eventos/:id/jogadores/:id/desistir marca e informa o acerto de saída', async () => {
    const evento = criarEventoAtivo()
    const joao = JogadorService.criar({ evento_id: evento.id, nome: 'João' })
    const maria = JogadorService.criar({ evento_id: evento.id, nome: 'Maria' })
    db.prepare(
      'INSERT INTO partidas (evento_id, jogador_a_id, jogador_b_id, vencedor_id, valor_aposta) VALUES (?, ?, ?, ?, 10)'
    ).run(evento.id, joao.id, maria.id, maria.id)

    const agente = await agenteMestre(app)
    const res = await agente.post(`/eventos/${evento.id}/jogadores/${joao.id}/desistir`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('msg=')
    expect(JogadorService.obter(joao.id).ativo).toBe(0)
    expect(decodeURIComponent(res.headers.location)).toContain('Acerto de saída')
  })

  it('GET /eventos/:id/jogadores/:id/editar exibe o formulário', async () => {
    const evento = criarEventoAtivo()
    const jogador = JogadorService.criar({ evento_id: evento.id, nome: 'Carlos' })
    const agente = await agenteMestre(app)
    const res = await agente.get(`/eventos/${evento.id}/jogadores/${jogador.id}/editar`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Editar jogador')
    expect(res.text).toContain('Carlos')
  })
})
