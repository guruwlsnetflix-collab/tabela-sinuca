(() => {
  const STORAGE_KEY = 'sinuca-tema'
  const root = document.documentElement

  function aplicarTema(tema) {
    root.setAttribute('data-bs-theme', tema)
    const btn = document.getElementById('theme-toggle')
    const icon = document.getElementById('theme-icon')
    if (btn) {
      btn.setAttribute('aria-label', tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro')
      btn.setAttribute('title', tema === 'dark' ? 'Tema claro' : 'Tema escuro')
    }
    if (icon) {
      icon.textContent = tema === 'dark' ? '☀️' : '🌙'
    }
  }

  function temaInicial() {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo === 'dark' || salvo === 'light') {
      return salvo
    }
    // Mobile: tema escuro como padrão (identidade premium);
    // Desktop: respeita a preferência do sistema.
    const mobile = window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches
    if (mobile) {
      return 'dark'
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  aplicarTema(temaInicial())

  const btn = document.getElementById('theme-toggle')
  if (btn) {
    btn.addEventListener('click', () => {
      const novo = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, novo)
      aplicarTema(novo)
    })
  }
})()
