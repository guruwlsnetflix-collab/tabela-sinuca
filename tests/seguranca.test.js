import { describe, it, expect } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const config = require('../src/config')
const { SENHA_MESTRA, agenteMestre } = require('./authHelper')

describe('Segurança', () => {
  it('envia cabeçalhos de segurança e esconde o X-Powered-By', async () => {
    const res = await request(app).get('/')
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
  })

  it('cookie de sessão funciona em http:// (rede local) e é HttpOnly', async () => {
    const res = await request(app).post('/login').type('form').send({ senha: SENHA_MESTRA })
    const cookie = res.headers['set-cookie'].join(';')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain('Secure')
  })

  it('após o login redireciona para o destino interno informado no formulário', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ senha: SENHA_MESTRA, next: '/torneios' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/torneios')
  })

  it.each(['//site-malicioso.com', '/\\site-malicioso.com', 'https://site-malicioso.com'])(
    'não redireciona para fora do site (next=%s)',
    async (next) => {
      const res = await request(app).post('/login').type('form').send({ senha: SENHA_MESTRA, next })
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe('/')
    }
  )

  it('bloqueia POST vindo de outro site (CSRF)', async () => {
    const agente = await agenteMestre(app)
    const res = await agente
      .post('/eventos')
      .set('Origin', 'https://site-malicioso.com')
      .type('form')
      .send({ nome: 'Evento forjado', data_inicio: '2026-08-01', data_fim: '2026-08-02' })
    expect(res.status).toBe(403)
    expect(res.text).toContain('origem não autorizada')
  })

  it('aceita POST vindo do próprio site', async () => {
    const res = await request(app)
      .post('/login')
      .set('Host', 'sinuca.local')
      .set('Origin', 'http://sinuca.local')
      .type('form')
      .send({ senha: SENHA_MESTRA })
    expect(res.status).toBe(302)
  })

  it('limita tentativas de senha errada por IP', async () => {
    for (let i = 0; i < config.loginMaxTentativas; i++) {
      const res = await request(app).post('/login').type('form').send({ senha: 'errada' })
      expect(res.status).toBe(400)
    }
    const bloqueado = await request(app).post('/login').type('form').send({ senha: SENHA_MESTRA })
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.text).toContain('Muitas tentativas')
  })
})
