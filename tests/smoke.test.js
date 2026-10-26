import { describe, it, expect } from 'vitest'
import request from 'supertest'

const app = require('../src/app')

describe('Smoke tests', () => {
  it('GET / responde 200 com a página de eventos', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Tabela de Sinuca')
  })

  it('GET /health responde ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
  })

  it('GET /pagina-inexistente responde 404', async () => {
    const res = await request(app).get('/pagina-inexistente')
    expect(res.status).toBe(404)
  })
})
