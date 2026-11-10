const crypto = require('crypto')

const config = require('../config')
const EventoRepository = require('../repositories/eventoRepository')
const TorneioRepository = require('../repositories/torneioRepository')

const NOME_COOKIE = 'sinuca_sessao'
const MAX_ACESSOS = 40

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
  if (ehSenhaMaestra(senha)) return { mestre: true }
  const evento = buscarEventoPorSenha(senha)
  if (evento) return { eventos: [evento.id] }
  const torneio = buscarTorneioPorSenha(senha)
  if (torneio) return { torneios: [torneio.id] }
  return null
}

// Valida a senha de um evento específico (ou a senha mestra). Diferente de
// autenticar(), funciona mesmo que dois eventos usem a mesma senha.
function autenticarEvento(eventoId, senha) {
  if (ehSenhaMaestra(senha)) return { mestre: true }
  const evento = EventoRepository.obterSenha(Number(eventoId))
  if (evento && verificarSenha(senha, evento.senha_hash)) return { eventos: [evento.id] }
  return null
}

function autenticarTorneio(torneioId, senha) {
  if (ehSenhaMaestra(senha)) return { mestre: true }
  const torneio = TorneioRepository.obterSenha(Number(torneioId))
  if (torneio && verificarSenha(senha, torneio.senha_hash)) return { torneios: [torneio.id] }
  return null
}

// Sessão normalizada: { mestre, eventos: [ids], torneios: [ids] }. Um mesmo
// aparelho pode administrar vários eventos e torneios ao mesmo tempo.
// Aceita também o formato antigo ({ nivel, eventos | torneios }).
function normalizarSessao(payload) {
  if (!payload || typeof payload !== 'object') return null
  const ids = (lista) =>
    Array.isArray(lista) ? [...new Set(lista.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []
  const sessao = {
    mestre: payload.mestre === true || payload.nivel === 'mestre',
    eventos: ids(payload.eventos),
    torneios: ids(payload.torneios)
  }
  if (!sessao.mestre && sessao.eventos.length === 0 && sessao.torneios.length === 0) return null
  return sessao
}

// Soma o novo acesso ao que a sessão já tinha. Acima do limite, os acessos
// mais antigos são descartados para o cookie não crescer indefinidamente.
function mesclarSessao(atual, novo) {
  const vazia = { mestre: false, eventos: [], torneios: [] }
  const a = normalizarSessao(atual) || vazia
  const n = normalizarSessao(novo) || vazia
  const juntar = (x, y) => [...new Set([...x, ...y])].slice(-MAX_ACESSOS)
  return {
    mestre: a.mestre || n.mestre,
    eventos: juntar(a.eventos, n.eventos),
    torneios: juntar(a.torneios, n.torneios)
  }
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

function definirSessao(req, res, payload) {
  const sessao = mesclarSessao(req.sessao, payload)
  const token = criarToken({ ...sessao, exp: Date.now() + config.duracaoSessaoMs })
  res.cookie(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Só exige HTTPS quando a conexão é HTTPS: na rede local o acesso é http://
    secure: req.secure,
    maxAge: config.duracaoSessaoMs
  })
  req.sessao = sessao
  return sessao
}

function limparSessao(req, res) {
  res.clearCookie(NOME_COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure })
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
  return normalizarSessao(lerToken(token))
}

const AuthService = {
  NOME_COOKIE,
  hashSenha,
  verificarSenha,
  ehSenhaMaestra,
  autenticar,
  autenticarEvento,
  autenticarTorneio,
  normalizarSessao,
  mesclarSessao,
  definirSessao,
  limparSessao,
  lerSessao
}

module.exports = AuthService
