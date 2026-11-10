import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const AuthService = require('../src/services/authService')
const EventoService = require('../src/services/eventoService')
const JogadorService = require('../src/services/jogadorService')
const PartidaService = require('../src/services/partidaService')
const TorneioService = require('../src/services/torneioService')
const TorneioRepository = require('../src/repositories/torneioRepository')
const { SENHA_MESTRA, agenteEvento } = require('./authHelper')

function limparDb() {
  db.exec('DELETE FROM torneios; DELETE FROM partidas; DELETE FROM jogadores; DELETE FROM eventos;')
}

function criarEvento(nome, senha) {
  return EventoService.criar({ nome, data_inicio: '2026-08-01', data_fim: '2026-08-02', senha })
}

function criarEventoComPartida(nome, senha) {
  const evento = criarEvento(nome, senha)
  const a = JogadorService.criar({ evento_id: evento.id, nome: `${nome} A` })
  const b = JogadorService.criar({ evento_id: evento.id, nome: `${nome} B` })
  const partida = PartidaService.registrar({
    evento_id: evento.id,
    jogador_a_id: a.id,
    jogador_b_id: b.id,
    vencedor_id: a.id,
    data_partida: '2026-08-01T20:00'
  })
  return { evento, a, b, partida }
}

describe('Acesso por evento/torneio', () => {
  beforeEach(limparDb)

  it('tela de acesso mostra o nome do evento e pede a senha', async () => {
    const evento = criarEvento('Sexta no Bar', 'senha-sexta')
    const res = await request(app).get(`/eventos/${evento.id}/acesso`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Sexta no Bar')
    expect(res.text).toContain('Liberar edição')
  })

  it('senha errada na tela de acesso responde 400 e não libera nada', async () => {
    const evento = criarEvento('Evento X', 'senha-certa')
    const agente = request.agent(app)
    const res = await agente.post(`/eventos/${evento.id}/acesso`).type('form').send({ senha: 'errada' })
    expect(res.status).toBe(400)
    expect(res.text).toContain('Senha incorreta')
    const tentativa = await agente
      .post(`/eventos/${evento.id}/status`)
      .type('form')
      .send({ status: 'encerrado' })
    expect(tentativa.headers.location).toContain('/acesso')
    expect(EventoService.obter(evento.id).status).toBe('planejado')
  })

  it('senha correta libera a edição e volta ao destino pedido', async () => {
    const evento = criarEvento('Evento Y', 'senha-y-123')
    const agente = request.agent(app)
    const res = await agente
      .post(`/eventos/${evento.id}/acesso`)
      .type('form')
      .send({ senha: 'senha-y-123', next: `/eventos/${evento.id}/jogadores/novo` })
    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(new RegExp(`^/eventos/${evento.id}/jogadores/novo\\?msg=`))
    const ok = await agente.post(`/eventos/${evento.id}/status`).type('form').send({ status: 'em_andamento' })
    expect(ok.status).toBe(302)
    expect(EventoService.obter(evento.id).status).toBe('em_andamento')
  })

  it('funciona mesmo quando dois eventos usam a mesma senha', async () => {
    criarEvento('Primeiro', 'senha-repetida')
    const segundo = criarEvento('Segundo', 'senha-repetida')
    const agente = request.agent(app)
    await agente.post(`/eventos/${segundo.id}/acesso`).type('form').send({ senha: 'senha-repetida' })
    await agente.post(`/eventos/${segundo.id}/status`).type('form').send({ status: 'em_andamento' })
    expect(EventoService.obter(segundo.id).status).toBe('em_andamento')
  })

  it('aceita a senha mestra na tela de acesso de qualquer torneio', async () => {
    const torneio = TorneioService.criar({ nome: 'Copa', data_inicio: '2026-09-01', senha: 'senha-copa' })
    const agente = request.agent(app)
    const res = await agente.post(`/torneios/${torneio.id}/acesso`).type('form').send({ senha: SENHA_MESTRA })
    expect(res.status).toBe(302)
    const cadastro = await agente.post(`/torneios/${torneio.id}/jogadores`).type('form').send({ nome: 'Zé' })
    expect(cadastro.status).toBe(302)
    expect(TorneioService.listarJogadores(torneio.id)).toHaveLength(1)
  })

  it('ignora destino externo no parâmetro next (redirecionamento aberto)', async () => {
    const evento = criarEvento('Evento Z', 'senha-z-123')
    const res = await request(app)
      .post(`/eventos/${evento.id}/acesso`)
      .type('form')
      .send({ senha: 'senha-z-123', next: '//site-malicioso.com' })
    expect(res.headers.location).toMatch(new RegExp(`^/eventos/${evento.id}\\?msg=`))
  })

  it('acessos se acumulam: o mesmo aparelho administra vários eventos', async () => {
    const a = criarEvento('Evento A', 'senha-a-123')
    const b = criarEvento('Evento B', 'senha-b-123')
    const agente = request.agent(app)
    await agente.post(`/eventos/${a.id}/acesso`).type('form').send({ senha: 'senha-a-123' })
    await agente.post(`/eventos/${b.id}/acesso`).type('form').send({ senha: 'senha-b-123' })
    await agente.post(`/eventos/${a.id}/status`).type('form').send({ status: 'em_andamento' })
    await agente.post(`/eventos/${b.id}/status`).type('form').send({ status: 'em_andamento' })
    expect(EventoService.obter(a.id).status).toBe('em_andamento')
    expect(EventoService.obter(b.id).status).toBe('em_andamento')
  })

  it('quem cria o evento já sai administrando', async () => {
    const agente = request.agent(app)
    const criar = await agente.post('/eventos').type('form').send({
      nome: 'Criado agora',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-02',
      senha: 'senha-nova-1'
    })
    const id = Number(criar.headers.location.match(/\/eventos\/(\d+)/)[1])
    const detalhe = await agente.get(`/eventos/${id}`)
    expect(detalhe.text).toContain('Modo administrador')
    expect(detalhe.text).toContain(`/eventos/${id}/editar`)
  })

  it('quem cria o torneio já sai administrando', async () => {
    const agente = request.agent(app)
    const criar = await agente
      .post('/torneios')
      .type('form')
      .send({ nome: 'Copa nova', data_inicio: '2026-09-01', senha: 'senha-copa-1' })
    const id = Number(criar.headers.location.match(/\/torneios\/(\d+)/)[1])
    const cadastro = await agente.post(`/torneios/${id}/jogadores`).type('form').send({ nome: 'Primeiro' })
    expect(cadastro.status).toBe(302)
    expect(cadastro.headers.location).toContain(`/torneios/${id}/jogadores/novo`)
    expect(TorneioService.listarJogadores(id)).toHaveLength(1)
  })

  it('visitante vê o modo visitante e o botão Administrar', async () => {
    const evento = criarEvento('Aberto', 'senha-aberto')
    const res = await request(app).get(`/eventos/${evento.id}`)
    expect(res.text).toContain('Modo visitante')
    expect(res.text).toContain(`/eventos/${evento.id}/acesso`)
    expect(res.text).not.toContain(`/eventos/${evento.id}/editar`)
  })

  it('converte cookies no formato antigo ({ nivel })', () => {
    expect(AuthService.normalizarSessao({ nivel: 'mestre' })).toMatchObject({ mestre: true })
    expect(AuthService.normalizarSessao({ nivel: 'evento', eventos: [3] })).toEqual({
      mestre: false,
      eventos: [3],
      torneios: []
    })
    expect(AuthService.normalizarSessao({ nivel: 'evento', eventos: [] })).toBeNull()
  })
})

describe('Isolamento entre eventos/torneios (IDOR)', () => {
  beforeEach(limparDb)

  it('admin de um evento não exclui partida de outro evento pela própria URL', async () => {
    const meu = criarEventoComPartida('Meu', 'senha-evento-teste')
    const alheio = criarEventoComPartida('Alheio', 'outra-senha-1')
    const agente = await agenteEvento(app)

    const res = await agente.post(`/eventos/${meu.evento.id}/partidas/${alheio.partida.id}/excluir`)
    expect(res.status).toBe(404)
    expect(PartidaService.obter(alheio.partida.id)).toBeTruthy()
  })

  it('admin de um evento não altera jogador de outro evento pela própria URL', async () => {
    const meu = criarEventoComPartida('Meu', 'senha-evento-teste')
    const alheio = criarEventoComPartida('Alheio', 'outra-senha-1')
    const agente = await agenteEvento(app)

    const editar = await agente
      .post(`/eventos/${meu.evento.id}/jogadores/${alheio.a.id}`)
      .type('form')
      .send({ nome: 'Hackeado' })
    expect(editar.status).toBe(404)
    expect(JogadorService.obter(alheio.a.id).nome).toBe('Alheio A')

    const desistir = await agente.post(`/eventos/${meu.evento.id}/jogadores/${alheio.b.id}/desistir`)
    expect(desistir.status).toBe(404)
    expect(JogadorService.obter(alheio.b.id).ativo).toBe(1)

    const pago = await agente.post(`/eventos/${meu.evento.id}/partidas/${alheio.partida.id}/pago`)
    expect(pago.status).toBe(404)
  })

  it('admin de um torneio não altera jogador de outro torneio pela própria URL', async () => {
    const meu = TorneioService.criar({ nome: 'Meu', data_inicio: '2026-09-01', senha: 'senha-torneio-teste' })
    const alheio = TorneioService.criar({ nome: 'Alheio', data_inicio: '2026-09-01', senha: 'outra-senha-1' })
    const jogador = TorneioService.cadastrarJogador({ torneio_id: alheio.id, nome: 'Original' })
    const agente = request.agent(app)
    await agente.post(`/torneios/${meu.id}/acesso`).type('form').send({ senha: 'senha-torneio-teste' })

    const editar = await agente
      .post(`/torneios/${meu.id}/jogadores/${jogador.id}`)
      .type('form')
      .send({ nome: 'Hackeado' })
    expect(editar.status).toBe(404)
    const excluir = await agente.post(`/torneios/${meu.id}/jogadores/${jogador.id}/excluir`)
    expect(excluir.status).toBe(404)
    expect(TorneioService.listarJogadores(alheio.id)[0].nome).toBe('Original')
  })
})

describe('Páginas públicas', () => {
  beforeEach(limparDb)

  it('página inicial apresenta o sistema e lista eventos e torneios', async () => {
    criarEvento('Evento da home', 'senha-home-1')
    TorneioService.criar({ nome: 'Torneio da home', data_inicio: '2026-09-01', senha: 'senha-home-2' })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Criar evento')
    expect(res.text).toContain('Evento da home')
    expect(res.text).toContain('Torneio da home')
  })

  it('GET /eventos lista os eventos com busca', async () => {
    criarEvento('Listado', 'senha-lista')
    const res = await request(app).get('/eventos')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Listado')
    expect(res.text).toContain('data-filtro-busca')
  })

  it('campeão do torneio aparece formatado (sem HTML escapado)', async () => {
    const torneio = TorneioService.criar({ nome: 'Final', data_inicio: '2026-09-01', senha: 'senha-final' })
    const jogador = TorneioService.cadastrarJogador({ torneio_id: torneio.id, nome: 'Campeão Zé' })
    TorneioRepository.definirVencedor(torneio.id, jogador.id)
    const res = await request(app).get(`/torneios/${torneio.id}`)
    expect(res.text).toContain('Campeão Zé')
    expect(res.text).toContain('class="p-campeao')
    expect(res.text).not.toContain('&lt;div')
  })

  it('painel da TV escapa o nome do campeão (sem injeção de HTML)', async () => {
    const torneio = TorneioService.criar({ nome: 'TV', data_inicio: '2026-09-01', senha: 'senha-tv-1' })
    const jogador = TorneioService.cadastrarJogador({
      torneio_id: torneio.id,
      nome: '<img src=x onerror=alert(1)>'
    })
    TorneioRepository.definirVencedor(torneio.id, jogador.id)
    const res = await request(app).get(`/torneios/${torneio.id}/painel`)
    expect(res.status).toBe(200)
    expect(res.text).not.toContain('<img src=x')
    expect(res.text).toContain('&lt;img src=x')
    expect(res.text).toContain('TORNEIO ENCERRADO')
  })
})
