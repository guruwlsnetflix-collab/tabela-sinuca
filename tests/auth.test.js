import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const EventoService = require('../src/services/eventoService')
const TorneioService = require('../src/services/torneioService')
const { SENHA_MESTRA, SENHA_EVENTO, SENHA_TORNEIO, agenteMestre, agenteEvento, agenteTorneio } = require('./authHelper')

function limparDb() {
  db.exec('DELETE FROM torneios; DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarEventoComSenha() {
  return EventoService.criar({
    nome: 'Evento com senha',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-02',
    senha: SENHA_EVENTO
  })
}

describe('Autenticação', () => {
  beforeEach(limparDb)

  it('GET /login responde 200 e informa sobre as senhas', async () => {
    const res = await request(app).get('/login')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Entrar')
    expect(res.text).toContain('senha mestra')
  })

  it('POST /login com senha incorreta rejeita com 400', async () => {
    const res = await request(app).post('/login').type('form').send({ senha: 'senha-errada' })
    expect(res.status).toBe(400)
    expect(res.text).toContain('Senha incorreta.')
  })

  it('POST /login com senha mestra cria a sessão e redireciona', async () => {
    const res = await request(app).post('/login').type('form').send({ senha: SENHA_MESTRA })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/')
    const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'].find((c) => c.startsWith('sinuca_sessao=')) : null
    expect(cookie).toBeTruthy()
    expect(cookie).toContain('HttpOnly')
  })

  it('POST /login?next=... redireciona para o destino após logar', async () => {
    const res = await request(app)
      .post('/login?next=/eventos/9')
      .type('form')
      .send({ senha: SENHA_MESTRA })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/eventos/9')
  })

  it('visita sem login consegue criar evento (criação livre de senha)', async () => {
    const res = await request(app).post('/eventos').type('form').send({
      nome: 'Sem login',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02',
      senha: SENHA_EVENTO
    })
    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(/^\/eventos\/\d+/)
  })

  it('visita sem login não consegue editar dados do evento (redireciona para /login)', async () => {
    const evento = criarEventoComSenha()
    const res = await request(app)
      .post(`/eventos/${evento.id}/status`)
      .type('form')
      .send({ status: 'em_andamento' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('/login')
    expect(EventoService.obter(evento.id).status).toBe('planejado')
  })

  it('visitante visualiza o detalhe do evento em modo somente leitura', async () => {
    const evento = criarEventoComSenha()
    const res = await request(app).get(`/eventos/${evento.id}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Evento com senha')
    expect(res.text).not.toContain(`/eventos/${evento.id}/editar`)
    expect(res.text).not.toContain(`/eventos/${evento.id}/partidas/novo`)
  })

  it('login com a senha do evento libera a edição apenas daquele evento', async () => {
    const evento = criarEventoComSenha()
    const outro = EventoService.criar({
      nome: 'Outro evento',
      data_inicio: '2026-09-01',
      data_fim: '2026-09-02',
      senha: 'outra-senha'
    })

    const agente = await agenteEvento(app)

    const proprio = await agente
      .post(`/eventos/${evento.id}/status`)
      .type('form')
      .send({ status: 'em_andamento' })
    expect(proprio.status).toBe(302)
    expect(EventoService.obter(evento.id).status).toBe('em_andamento')

    const alheio = await agente
      .post(`/eventos/${outro.id}/status`)
      .type('form')
      .send({ status: 'em_andamento' })
    expect(alheio.status).toBe(302)
    expect(alheio.headers.location).toContain('/login')
    expect(EventoService.obter(outro.id).status).toBe('planejado')
  })

  it('evento encerrado mostra opção de reabrir e volta a liberar edição', async () => {
    const evento = criarEventoComSenha()
    EventoService.mudarStatus(evento.id, 'encerrado')

    const visitante = await request(app).get(`/eventos/${evento.id}`)
    expect(visitante.text).not.toContain('Reabrir evento')

    const agente = await agenteEvento(app)
    const detalhe = await agente.get(`/eventos/${evento.id}`)
    expect(detalhe.text).toContain('Reabrir evento')

    const reaberto = await agente
      .post(`/eventos/${evento.id}/status`)
      .type('form')
      .send({ status: 'em_andamento' })
    expect(reaberto.status).toBe(302)
    expect(EventoService.obter(evento.id).status).toBe('em_andamento')
  })

  it('qualquer visita consegue criar evento mesmo sem ser mestre', async () => {
    criarEventoComSenha()
    const res = await request(app).post('/eventos').type('form').send({
      nome: 'Novo pelo evento',
      data_inicio: '2026-10-01',
      data_fim: '2026-10-02',
      senha: SENHA_EVENTO
    })
    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(/^\/eventos\/\d+/)
  })

  it('mestre consegue criar evento com senha (hash não exposto)', async () => {
    const agente = await agenteMestre(app)
    const res = await agente.post('/eventos').type('form').send({
      nome: 'Evento mestre',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02',
      senha: SENHA_EVENTO
    })
    expect(res.status).toBe(302)
    const id = Number(res.headers.location.match(/\/eventos\/(\d+)/)[1])
    const evento = EventoService.obter(id)
    expect(evento).toHaveProperty('nome', 'Evento mestre')
    expect(evento).not.toHaveProperty('senha_hash')
  })

  it('criação de torneios é livre e a edição exige a senha do torneio ou mestre', async () => {
    const semLogin = await request(app).post('/torneios').type('form').send({
      nome: 'X',
      data_inicio: '2026-09-01',
      senha: SENHA_TORNEIO
    })
    expect(semLogin.status).toBe(302)
    expect(semLogin.headers.location).toMatch(/^\/torneios\/\d+/)
    const id = Number(semLogin.headers.location.match(/\/torneios\/(\d+)/)[1])

    const semSenha = await request(app).post('/torneios').type('form').send({
      nome: 'Sem senha',
      data_inicio: '2026-09-01'
    })
    expect(semSenha.status).toBe(400)
    expect(semSenha.text).toContain('A senha deve ter entre 6 e 60 caracteres.')

    const visitante = await request(app)
      .post(`/torneios/${id}/jogadores`)
      .type('form')
      .send({ nome: 'Jogador' })
    expect(visitante.status).toBe(302)
    expect(visitante.headers.location).toContain('/login')

    criarEventoComSenha()
    const agente = await agenteEvento(app)
    const comoEvento = await agente
      .post(`/torneios/${id}/jogadores`)
      .type('form')
      .send({ nome: 'Jogador' })
    expect(comoEvento.status).toBe(302)
    expect(comoEvento.headers.location).toContain('/login')

    const form = await request(app).get('/torneios/novo')
    expect(form.status).toBe(200)

    const mestre = await agenteMestre(app)
    const ok = await mestre
      .post(`/torneios/${id}/jogadores`)
      .type('form')
      .send({ nome: 'Jogador Mestre' })
    expect(ok.status).toBe(302)
    expect(ok.headers.location).toMatch(new RegExp(`/torneios/${id}`))

    const leitura = await request(app).get('/torneios')
    expect(leitura.status).toBe(200)
  })

  it('login com a senha do torneio libera a edição apenas daquele torneio', async () => {
    const doMeu = TorneioService.criar({
      nome: 'Meu torneio',
      data_inicio: '2026-09-01',
      senha: SENHA_TORNEIO
    })
    const alheio = TorneioService.criar({
      nome: 'Outro torneio',
      data_inicio: '2026-10-01',
      senha: 'outra-senha'
    })

    const agente = await agenteTorneio(app)

    const proprio = await agente
      .post(`/torneios/${doMeu.id}/jogadores`)
      .type('form')
      .send({ nome: 'Jogador' })
    expect(proprio.status).toBe(302)
    expect(TorneioService.listarJogadores(doMeu.id)).toHaveLength(1)

    const alheioRes = await agente
      .post(`/torneios/${alheio.id}/jogadores`)
      .type('form')
      .send({ nome: 'Jogador' })
    expect(alheioRes.status).toBe(302)
    expect(alheioRes.headers.location).toContain('/login')
    expect(TorneioService.listarJogadores(alheio.id)).toHaveLength(0)
  })

  it('logout limpa a sessão e volta a bloquear a edição de dados', async () => {
    const agente = await agenteMestre(app)
    const sair = await agente.post('/logout')
    expect(sair.status).toBe(302)

    const res = await agente
      .post(`/eventos/${criarEventoComSenha().id}/status`)
      .type('form')
      .send({ status: 'em_andamento' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('/login')
  })
})