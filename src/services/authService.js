const crypto = require('crypto')

const config = require('../config')
const EventoRepository = require('../repositories/eventoRepository')
const TorneioRepository = require('../repositories/torneioRepository')

const NOME_COOKIE = 'sinuca_sessao'

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function verificarSenha(senha, armazenado) {
  if (!armazenado) return false
  const partes = String(armazenado).split(':')
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false
  const [, salt, hash] = partes
  if (!salt || !hash) return false
  const candidato = crypto.scryptSync(String(senha), salt, 64)
  const esperado = Buffer.from(hash, 'hex')
  return candidato.length === esperado.length && crypto.timingSafeEqual(candidato, esperado)
}

function comparacaoSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function ehSenhaMaestra(senha) {
  if (!config.senhaMaestra || !senha) return false
  return comparacaoSegura(senha, config.senhaMaestra)
}

function buscarEventoPorSenha(senha) {
  const eventos = EventoRepository.listarComSenha()
  for (const evento of eventos) {
    if (verificarSenha(senha, evento.senha_hash)) {
      return evento
    }
  }
  return null
}

function buscarTorneioPorSenha(senha) {
  const torneios = TorneioRepository.listarComSenha()
  for (const torneio of torneios) {
    if (verificarSenha(senha, torneio.senha_hash)) {
      return torneio
    }
  }
  return null
}

function autenticar(senha) {
  if (ehSenhaMaestra(senha)) return { nivel: 'mestre' }
  const evento = buscarEventoPorSenha(senha)
  if (evento) return { nivel: 'evento', eventos: [evento.id] }
  const torneio = buscarTorneioPorSenha(senha)
  if (torneio) return { nivel: 'torneio', torneios: [torneio.id] }
  return null
}

function assinar(corpo) {
  return crypto.createHmac('sha256', config.segredoSessao).update(corpo).digest('base64url')
}

function criarToken(payload) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${corpo}.${assinar(corpo)}`
}

function lerToken(token) {
  if (!token || typeof token !== 'string') return null
  const i = token.indexOf('.')
  if (i === -1) return null
  const corpo = token.slice(0, i)
  const assinatura = token.slice(i + 1)
  if (!corpo || !assinatura) return null
  const esperada = assinar(corpo)
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch (_err) {
    return null
  }
}

function definirSessao(res, payload) {
  const token = criarToken({ ...payload, exp: Date.now() + config.duracaoSessaoMs })
  res.cookie(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: config.duracaoSessaoMs
  })
}

function limparSessao(res) {
  res.clearCookie(NOME_COOKIE)
}

function lerSessao(req) {
  if (!req.headers.cookie) return null
  let token = null
  req.headers.cookie.split(';').forEach((parte) => {
    const i = parte.indexOf('=')
    if (i === -1) return
    const nome = parte.slice(0, i).trim()
    if (nome === NOME_COOKIE) {
      token = decodeURIComponent(parte.slice(i + 1).trim())
    }
  })
  return lerToken(token)
}

const AuthService = {
  NOME_COOKIE,
  hashSenha,
  verificarSenha,
  ehSenhaMaestra,
  autenticar,
  definirSessao,
  limparSessao,
  lerSessao
}

module.exports = AuthService
