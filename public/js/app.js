/* =========================================================
   PREMIUM JS — microinterações da interface mobile
   ---------------------------------------------------------
   Camada de apresentação apenas. Não altera regras de negócio.
   ========================================================= */

;(() => {
  'use strict'

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------- Scroll spy: bottom nav + FAB contextual ---------- */
  function initScrollSpy() {
    const sections = document.querySelectorAll('[data-nav-target]')
    const navItems = document.querySelectorAll('.p-bottomnav__item[data-nav-key]')
    const fab = document.getElementById('fab-contextual')
    if (!sections.length) return

    // Configuração do FAB por seção
    const fabConfig = {
      dashboard: fab ? { href: fab.dataset.fabDashboardHref, label: fab.dataset.fabDashboardLabel } : null,
      ranking: fab ? { href: fab.dataset.fabRankingHref, label: fab.dataset.fabRankingLabel } : null,
      jogadores: fab ? { href: fab.dataset.fabJogadoresHref, label: fab.dataset.fabJogadoresLabel } : null,
      partidas: fab ? { href: fab.dataset.fabPartidasHref, label: fab.dataset.fabPartidasLabel } : null,
      financeiro: fab ? { href: fab.dataset.fabPartidasHref, label: fab.dataset.fabPartidasLabel } : null
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const key = entry.target.dataset.navTarget
          navItems.forEach((item) => {
            const ativo = item.dataset.navKey === key
            item.classList.toggle('is-active', ativo)
            if (ativo) {
              item.setAttribute('aria-current', 'page')
            } else {
              item.removeAttribute('aria-current')
            }
          })
          if (fab && fabConfig[key]) {
            const cfg = fabConfig[key]
            fab.setAttribute('href', cfg.href)
            fab.setAttribute('aria-label', cfg.label)
            const label = fab.querySelector('.p-fab__label')
            if (label) label.textContent = cfg.label
            fab.classList.remove('p-fab--hidden')
          }
        })
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    )

    sections.forEach((section) => observer.observe(section))
  }

  /* ---------- Animações das barras de progresso ---------- */
  function initBars() {
    const bars = document.querySelectorAll('.p-bar__fill[data-width]')
    if (!bars.length) return

    const animate = (bar) => {
      const width = bar.dataset.width || '0'
      // pequeno delay para a transição aparecer
      requestAnimationFrame(() => {
        setTimeout(() => {
          bar.style.width = width + '%'
        }, 80)
      })
    }

    if ('IntersectionObserver' in window && !prefersReduced) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animate(entry.target)
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.2 }
      )
      bars.forEach((bar) => observer.observe(bar))
    } else {
      bars.forEach((bar) => {
        bar.style.width = bar.dataset.width + '%'
      })
    }
  }

  /* ---------- Ripple (feedback tátil) ---------- */
  function initRipple() {
    if (prefersReduced) return
    const alvos = document.querySelectorAll('.p-btn, .p-action-btn, .p-fab, .p-icon-btn')

    alvos.forEach((alvo) => {
      alvo.addEventListener('pointerdown', (e) => {
        const rect = alvo.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const ripple = document.createElement('span')
        ripple.className = 'p-ripple'
        ripple.style.width = ripple.style.height = size + 'px'
        ripple.style.left = e.clientX - rect.left - size / 2 + 'px'
        ripple.style.top = e.clientY - rect.top - size / 2 + 'px'
        alvo.appendChild(ripple)
        setTimeout(() => ripple.remove(), 650)
      })
    })
  }

  /* ---------- Confirmação de exclusão em formulários pequenos ---------- */
  function initConfirmForms() {
    document.querySelectorAll('form[data-confirm]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        const msg = form.dataset.confirm || 'Tem certeza que deseja excluir?'
        if (!window.confirm(msg)) {
          e.preventDefault()
          e.stopPropagation()
        }
      })
    })
  }

  /* ---------- Mostrar/ocultar senha ---------- */
  function initToggleSenha() {
    document.querySelectorAll('[data-toggle-senha]').forEach((botao) => {
      const campo = document.getElementById(botao.dataset.toggleSenha)
      if (!campo) return
      botao.addEventListener('click', () => {
        const visivel = campo.type === 'password'
        campo.type = visivel ? 'text' : 'password'
        botao.setAttribute('aria-pressed', String(visivel))
        botao.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha')
        campo.focus()
      })
    })
  }

  /* ---------- Botão "Voltar" ---------- */
  function initVoltar() {
    document.querySelectorAll('[data-voltar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        if (window.history.length > 1) window.history.back()
        else window.location.href = '/'
      })
    })
  }

  /* ---------- Aviso flutuante ---------- */
  function mostrarAviso(texto) {
    let aviso = document.querySelector('.p-toast')
    if (!aviso) {
      aviso = document.createElement('div')
      aviso.className = 'p-toast'
      aviso.setAttribute('role', 'status')
      document.body.appendChild(aviso)
    }
    aviso.textContent = texto
    aviso.classList.add('is-visible')
    clearTimeout(mostrarAviso.timer)
    mostrarAviso.timer = setTimeout(() => aviso.classList.remove('is-visible'), 2400)
  }

  /* ---------- Busca e filtro por situação nas listagens ---------- */
  function initFiltros() {
    document.querySelectorAll('[data-filtro]').forEach((barra) => {
      const lista = document.getElementById(barra.dataset.filtro)
      if (!lista) return
      const busca = barra.querySelector('[data-filtro-busca]')
      const chips = barra.querySelectorAll('[data-filtro-status]')
      const vazio = document.querySelector(`[data-filtro-vazio="${barra.dataset.filtro}"]`)
      let status = ''

      const normalizar = (s) =>
        String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')

      const aplicar = () => {
        const termo = normalizar(busca ? busca.value.trim() : '')
        let visiveis = 0
        lista.querySelectorAll('[data-busca]').forEach((item) => {
          const ok =
            (!termo || normalizar(item.dataset.busca).includes(termo)) &&
            (!status || item.dataset.status === status)
          item.hidden = !ok
          if (ok) visiveis += 1
        })
        if (vazio) vazio.classList.toggle('d-none', visiveis > 0)
      }

      if (busca) busca.addEventListener('input', aplicar)
      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          status = chip.dataset.filtroStatus
          chips.forEach((c) => c.classList.toggle('is-active', c === chip))
          aplicar()
        })
      })
    })
  }

  /* ---------- Compartilhar link (WhatsApp, etc.) ---------- */
  function initCompartilhar() {
    document.querySelectorAll('[data-compartilhar]').forEach((botao) => {
      botao.addEventListener('click', async () => {
        const url = window.location.origin + window.location.pathname
        const titulo = botao.dataset.titulo || document.title
        try {
          if (navigator.share) {
            await navigator.share({ title: titulo, text: `Acompanhe ${titulo} ao vivo`, url })
            return
          }
          await navigator.clipboard.writeText(url)
          mostrarAviso('Link copiado! Cole no WhatsApp para a galera acompanhar.')
        } catch (err) {
          if (err && err.name === 'AbortError') return
          window.prompt('Copie o link:', url)
        }
      })
    })
  }

  /* ---------- Vistos recentemente (guardado só neste navegador) ---------- */
  const CHAVE_RECENTES = 'sinuca-recentes'

  function lerRecentes() {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]')
      return Array.isArray(lista) ? lista : []
    } catch (_err) {
      return []
    }
  }

  function initRecentes() {
    const atual = document.querySelector('[data-recente]')
    if (atual) {
      try {
        const item = JSON.parse(atual.dataset.recente)
        const lista = lerRecentes().filter((r) => !(r.tipo === item.tipo && r.id === item.id))
        lista.unshift(item)
        localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista.slice(0, 8)))
      } catch (_err) {
        // Armazenamento indisponível (aba anônima, etc.): apenas não registra
      }
    }

    const secao = document.getElementById('recentes')
    const alvo = document.getElementById('recentes-lista')
    if (!secao || !alvo) return
    const recentes = lerRecentes().filter(
      (r) => r && ['eventos', 'torneios'].includes(r.tipo) && Number.isInteger(r.id)
    )
    if (!recentes.length) return
    recentes.forEach((r) => {
      const link = document.createElement('a')
      link.className = 'p-chip'
      link.href = `/${r.tipo}/${r.id}`
      link.textContent = `${r.tipo === 'eventos' ? '🎱' : '🏆'} ${r.nome}`
      alvo.appendChild(link)
    })
    secao.classList.remove('d-none')
  }

  /* ---------- Inicialização ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initScrollSpy()
    initBars()
    initRipple()
    initConfirmForms()
    initToggleSenha()
    initVoltar()
    initFiltros()
    initCompartilhar()
    initRecentes()
  })
})()
