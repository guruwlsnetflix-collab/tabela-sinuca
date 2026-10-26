const request = require('supertest')

const SENHA_MESTRA = 'senha-mestre-teste'
const SENHA_EVENTO = 'senha-evento-teste'
const SENHA_TORNEIO = 'senha-torneio-teste'

async function agenteMestre(app) {
  const agente = request.agent(app)
  const res = await agente.post('/login').type('form').send({ senha: SENHA_MESTRA })
  if (res.status !== 302) {
    throw new Error(`Falha ao autenticar como mestre (status ${res.status})`)
  }
  return agente
}

async function agenteEvento(app, senha = SENHA_EVENTO) {
  const agente = request.agent(app)
  const res = await agente.post('/login').type('form').send({ senha })
  if (res.status !== 302) {
    throw new Error(`Falha ao autenticar como evento (status ${res.status})`)
  }
  return agente
}

async function agenteTorneio(app, senha = SENHA_TORNEIO) {
  const agente = request.agent(app)
  const res = await agente.post('/login').type('form').send({ senha })
  if (res.status !== 302) {
    throw new Error(`Falha ao autenticar como torneio (status ${res.status})`)
  }
  return agente
}

module.exports = { SENHA_MESTRA, SENHA_EVENTO, SENHA_TORNEIO, agenteMestre, agenteEvento, agenteTorneio }
