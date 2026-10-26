// Helpers de apresentação disponíveis em todas as views (app.locals)

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/

// "2026-09-24" → "24/09/2026". Valores fora do formato são devolvidos como vieram.
function formatarData(valor) {
  if (!valor) return ''
  const m = DATA_ISO.exec(String(valor))
  if (!m) return String(valor)
  return `${m[3]}/${m[2]}/${m[1]}`
}

// Período legível: "24/09/2026" quando é um dia só, "24/09 – 26/09/2026"
// no mesmo ano e "30/12/2026 – 02/01/2027" entre anos.
function formatarPeriodo(inicio, fim) {
  const a = formatarData(inicio)
  const b = formatarData(fim)
  if (!b || a === b) return a
  if (!a) return b
  const anoA = a.slice(-4)
  const anoB = b.slice(-4)
  if (DATA_ISO.test(inicio) && anoA === anoB) return `${a.slice(0, 5)} – ${b}`
  return `${a} – ${b}`
}

module.exports = { formatarData, formatarPeriodo }
