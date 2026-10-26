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
    return new URL(valor).host
  } catch (_err) {
    return null
  }
}

// Proteção contra CSRF: requisições que alteram dados precisam vir do próprio
// site. Navegadores sempre enviam Origin (ou Referer) em POSTs de formulário
// entre sites; clientes sem esses cabeçalhos (curl, testes) não carregam o
// cookie da vítima, então não representam risco de CSRF.
function verificarOrigem(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origem = req.get('origin') || req.get('referer')
  if (!origem) return next()
  if (hostDaUrl(origem) === req.get('host')) return next()
  renderErro(res, { status: 403, message: 'Requisição bloqueada: origem não autorizada.' })
}

// Limita tentativas de senha erradas por IP para impedir força bruta.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginMaxTentativas,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('pages/auth/login', {
      title: 'Entrar',
      erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
      next: '/'
    })
  }
})

module.exports = { cabecalhos, verificarOrigem, limiteLogin }
