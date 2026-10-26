/* =========================================================
   PREMIUM JS — microinterações da interface mobile
   ---------------------------------------------------------
   Camada de apresentação apenas. Não altera regras de negócio.
   ========================================================= */

(() => {
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

  /* ---------- Inicialização ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initScrollSpy()
    initBars()
    initRipple()
    initConfirmForms()
    initToggleSenha()
    initVoltar()
  })
})()
