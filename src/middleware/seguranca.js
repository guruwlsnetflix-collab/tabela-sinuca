const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const config = require('../config')
const { renderErro } = require('./erros')

// Cabeçalhos de segurança. As views usam scripts inline (tema, painéis) e
// bibliotecas de CDN (Bootstrap, html2canvas, jsPDF), então a CSP as libera
// explicitamente em vez de desligar a proteção.
const cabecalhos = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'", 'https://cdn.jsdelivr.net'],
      // Desligado para o sistema funcionar por http:// na rede local (ex.: TV do bar)
      'upgrade-insecure-requests': null
    }
  },
  // Permite que o painel seja aberto em navegadores de TV sem restrições extras
  crossOriginEmbedderPolicy: false,
  // Navegadores só respeitam HSTS em conexões HTTPS; em http:// é ignorado
  hsts: config.env === 'production'
})

function hostDaUrl(valor) {
  try {
    const url = new URL(valor)
    return { host: url.host, hostname: url.hostname }
  } catch (_err) {
    return null
  }
}

function hostDaReq(req) {
  let hostHeader = req.get('host') || ''
  // Quando atrás de proxy reverso confiável, prioriza o host encaminhado
  if (config.trustProxy) {
    hostHeader = req.get('x-forwarded-host') || hostHeader
  }
  if (!hostHeader) return { host: '', hostname: '' }
  // Remove porta se presente (exceto colchetes IPv6)
  const hostSemPorta = hostHeader.replace(/:\d+$/, '')
  return { host: hostHeader, hostname: hostSemPorta }
}

// Proteção contra CSRF: requisições que alteram dados precisam vir do próprio
// site. Navegadores sempre enviam Origin (ou Referer) em POSTs de formulário
// entre sites; clientes sem esses cabeçalhos (curl, testes) não carregam o
// cookie da vítima, então não representam risco de CSRF.
function verificarOrigem(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origem = req.get('origin') || req.get('referer')
  if (!origem) return next()

  const origemInfo = hostDaUrl(origem)
  const reqInfo = hostDaReq(req)

  if (!origemInfo) return next()

  // Comparação exata por host (com porta)
  if (origemInfo.host === reqInfo.host) return next()

  // Comparação por hostname (ignora porta)
  if (origemInfo.hostname && reqInfo.hostname && origemInfo.hostname === reqInfo.hostname) {
    return next()
  }

  // Aceita equivalentes localhost
  const locais = ['localhost', '127.0.0.1', '::1']
  if (
    origemInfo.hostname &&
    reqInfo.hostname &&
    locais.includes(origemInfo.hostname) &&
    locais.includes(reqInfo.hostname)
  ) {
    return next()
  }

  renderErro(res, { status: 403, message: 'Requisição bloqueada: origem não autorizada.' })
}

// Limita tentativas de senha erradas por IP para impedir força bruta. O mesmo
// contador vale para o login geral e para o acesso a cada evento/torneio.
// Rotas com tela própria definem req.renderLimite para exibir o aviso nela.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginMaxTentativas,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    const mensagem = 'Muitas tentativas de senha. Aguarde 15 minutos e tente novamente.'
    if (typeof req.renderLimite === 'function') return req.renderLimite(mensagem)
    res.status(429).render('pages/auth/login', {
      title: 'Entrar',
      erro: mensagem,
      next: '/'
    })
  }
})

module.exports = { cabecalhos, verificarOrigem, limiteLogin }
