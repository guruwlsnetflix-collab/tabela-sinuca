const express = require('express')
const { validationResult } = require('express-validator')

const router = express.Router()

const TorneioService = require('../services/torneioService')
const torneioValidators = require('../validators/torneioValidator')
const { exigirTorneio } = require('../middleware/auth')
const { renderErro } = require('../middleware/erros')

function alvoConfronto(torneioId, confrontoId) {
  try {
    const estado = TorneioService.obterEstado(Number(torneioId))
    const lista = []
    estado.fases.forEach((f) => f.confrontos.forEach((c) => lista.push(c)))
    const idx = lista.findIndex((c) => c.id === Number(confrontoId))
    if (idx === -1) return Number(confrontoId)
    if (lista[idx].status !== 'finalizado') return Number(confrontoId)
    const proximo = lista.find((c) => c.status !== 'finalizado')
    return proximo ? proximo.id : Number(confrontoId)
  } catch (_err) {
    return Number(confrontoId)
  }
}

function renderForm(res, { torneio, erros, modoEdicao }) {
  const status = erros ? 400 : 200
  res.status(status).render('pages/torneios/form', {
    title: modoEdicao ? 'Editar torneio' : 'Novo torneio',
    torneio: torneio || {
      nome: '',
      local: '',
      data_inicio: '',
      previsao_termino: '',
      modalidade: 'par',
      numero_mesas: 1
    },
    modalidadeLabel: TorneioService.MODALIDADE_LABEL,
    erros,
    modoEdicao
  })
}

function renderJogadorForm(res, { torneio, jogador, erros }) {
  const editando = Boolean(jogador && jogador.id)
  const status = erros ? 400 : 200
  res.status(status).render('pages/torneios/jogadorForm', {
    title: editando ? 'Editar jogador' : 'Novo jogador',
    torneio,
    jogador: jogador || { nome: '', apelido: '', telefone: '' },
    erros
  })
}

function mapaDeErros(req) {
  const mapa = {}
  validationResult(req)
    .array()
    .forEach((e) => {
      mapa[e.path] = e.msg
    })
  return mapa
}

function renderDetalhe(res, torneioId, extra) {
  const estado = TorneioService.obterEstado(Number(torneioId))
  res.render('pages/torneios/detalhe', {
    title: estado.torneio.nome,
    estado,
    statusLabel: TorneioService.STATUS_LABEL,
    modalidadeLabel: TorneioService.MODALIDADE_LABEL,
    confrontoStatusLabel: TorneioService.CONFRONTO_STATUS_LABEL,
    tamanhoChave: TorneioService.TAMANHO_CHAVE,
    ...extra
  })
}

// ---------------- Listagem e formulários do torneio ----------------

router.get('/torneios', (req, res) => {
  const torneios = TorneioService.listar()
  res.render('pages/torneios/index', {
    title: 'Torneios',
    torneios,
    statusLabel: TorneioService.STATUS_LABEL,
    msg: req.query.msg || null,
    erro: req.query.erro || null
  })
})

router.get('/torneios/novo', (req, res) => {
  renderForm(res, { torneio: null, erros: null, modoEdicao: false })
})

router.post('/torneios', torneioValidators.criar, (req, res) => {
  const erros = mapaDeErros(req)
  if (Object.keys(erros).length > 0) {
    return renderForm(res, { torneio: req.body, erros, modoEdicao: false })
  }
  try {
    const torneio = TorneioService.criar({
      ...req.body,
      modalidade: req.body.modalidade || 'par',
      numero_mesas: Number(req.body.numero_mesas) || 1
    })
    res.redirect(
      `/torneios/${torneio.id}?msg=${encodeURIComponent('Torneio criado. Informe a senha definida para editar os dados.')}`
    )
  } catch (err) {
    renderForm(res, {
      torneio: req.body,
      erros: { geral: err.message },
      modoEdicao: false
    })
  }
})

// ---------------- Detalhe / painel administrativo ----------------

router.get('/torneios/:id', (req, res) => {
  try {
    renderDetalhe(res, req.params.id, {
      msg: req.query.msg || null,
      erro: req.query.erro || null
    })
  } catch (err) {
    renderErro(res, err)
  }
})

router.get('/torneios/:id/editar', exigirTorneio, (req, res) => {
  try {
    const torneio = TorneioService.obter(Number(req.params.id))
    res.status(200).render('pages/torneios/form', {
      title: 'Editar torneio',
      torneio,
      modalidadeLabel: TorneioService.MODALIDADE_LABEL,
      erros: null,
      modoEdicao: true
    })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/torneios/:id', exigirTorneio, torneioValidators.atualizar, (req, res) => {
  const id = Number(req.params.id)
  const erros = mapaDeErros(req)
  if (Object.keys(erros).length > 0) {
    return renderForm(res, { torneio: { ...req.body, id }, erros, modoEdicao: true })
  }
  try {
    TorneioService.atualizar(id, {
      ...req.body,
      modalidade: req.body.modalidade || 'par',
      numero_mesas: Number(req.body.numero_mesas) || 1
    })
    res.redirect(`/torneios/${id}?msg=Torneio atualizado com sucesso.`)
  } catch (err) {
    renderForm(res, { torneio: { ...req.body, id }, erros: { geral: err.message }, modoEdicao: true })
  }
})

router.post('/torneios/:id/cancelar', exigirTorneio, (req, res) => {
  try {
    TorneioService.cancelar(Number(req.params.id))
    res.redirect(`/torneios/${req.params.id}?msg=Torneio cancelado.`)
  } catch (err) {
    res.redirect(`/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}`)
  }
})

router.post('/torneios/:id/excluir', exigirTorneio, (req, res) => {
  try {
    TorneioService.excluir(Number(req.params.id))
    res.redirect('/torneios?msg=Torneio excluído.')
  } catch (err) {
    res.redirect(`/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}`)
  }
})

// ---------------- Sorteio e início ----------------

router.post('/torneios/:id/sortear', exigirTorneio, (req, res) => {
  try {
    TorneioService.sortear(Number(req.params.id))
    res.redirect(`/torneios/${req.params.id}?msg=Sorteio realizado. A chave foi formada.`)
  } catch (err) {
    res.redirect(`/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}`)
  }
})

router.post('/torneios/:id/iniciar', exigirTorneio, (req, res) => {
  try {
    TorneioService.iniciar(Number(req.params.id))
    res.redirect(`/torneios/${req.params.id}?msg=Torneio em andamento!`)
  } catch (err) {
    res.redirect(`/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}`)
  }
})

// ---------------- Jogadores ----------------

router.get('/torneios/:id/jogadores/novo', exigirTorneio, (req, res) => {
  try {
    const torneio = TorneioService.obter(Number(req.params.id))
    renderJogadorForm(res, { torneio, jogador: null, erros: null })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/torneios/:id/jogadores', exigirTorneio, torneioValidators.jogador, (req, res) => {
  const torneioId = Number(req.params.id)
  const torneio = TorneioService.obter(torneioId)
  const erros = mapaDeErros(req)
  if (Object.keys(erros).length > 0) {
    return renderJogadorForm(res, { torneio, jogador: req.body, erros })
  }
  try {
    TorneioService.cadastrarJogador({ ...req.body, torneio_id: torneioId })
    res.redirect(`/torneios/${torneioId}?msg=Jogador cadastrado com sucesso.`)
  } catch (err) {
    renderJogadorForm(res, { torneio, jogador: req.body, erros: { geral: err.message } })
  }
})

router.get('/torneios/:id/jogadores/:jogadorId/editar', exigirTorneio, (req, res) => {
  try {
    const torneio = TorneioService.obter(Number(req.params.id))
    const jogador = TorneioService.listarJogadores(torneio.id).find(
      (j) => j.id === Number(req.params.jogadorId)
    )
    if (!jogador) {
      throw Object.assign(new Error('Jogador não encontrado.'), { status: 404 })
    }
    renderJogadorForm(res, { torneio, jogador, erros: null })
  } catch (err) {
    renderErro(res, err)
  }
})

router.post('/torneios/:id/jogadores/:jogadorId', exigirTorneio, torneioValidators.jogador, (req, res) => {
  const torneioId = Number(req.params.id)
  const jogadorId = Number(req.params.jogadorId)
  const torneio = TorneioService.obter(torneioId)
  const erros = mapaDeErros(req)
  if (Object.keys(erros).length > 0) {
    return renderJogadorForm(res, {
      torneio,
      jogador: { ...req.body, id: jogadorId },
      erros
    })
  }
  try {
    TorneioService.atualizarJogador(jogadorId, req.body)
    res.redirect(`/torneios/${torneioId}?msg=Jogador atualizado com sucesso.`)
  } catch (err) {
    renderJogadorForm(res, {
      torneio,
      jogador: { ...req.body, id: jogadorId },
      erros: { geral: err.message }
    })
  }
})

router.post('/torneios/:id/jogadores/:jogadorId/excluir', exigirTorneio, (req, res) => {
  const torneioId = Number(req.params.id)
  try {
    TorneioService.excluirJogador(Number(req.params.jogadorId))
    res.redirect(`/torneios/${torneioId}?msg=Jogador excluído.`)
  } catch (err) {
    res.redirect(`/torneios/${torneioId}?erro=${encodeURIComponent(err.message)}`)
  }
})

// ---------------- Confrontos e partidas ----------------

router.post('/torneios/:id/confrontos/:confrontoId/iniciar', exigirTorneio, (req, res) => {
  try {
    TorneioService.iniciarConfronto(Number(req.params.id), Number(req.params.confrontoId))
    res.redirect(`/torneios/${req.params.id}?msg=Confronto em andamento.#confronto-${req.params.confrontoId}`)
  } catch (err) {
    res.redirect(
      `/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}#confronto-${req.params.confrontoId}`
    )
  }
})

router.post('/torneios/:id/confrontos/:confrontoId/partidas', exigirTorneio, (req, res) => {
  const vencedorId = Number(req.body.vencedor_id)
  if (!vencedorId) {
    return res.redirect(
      `/torneios/${req.params.id}?erro=${encodeURIComponent('Selecione o vencedor da partida.')}#confronto-${req.params.confrontoId}`
    )
  }
  try {
    TorneioService.registrarPartida(Number(req.params.id), Number(req.params.confrontoId), vencedorId)
    const alvo = alvoConfronto(req.params.id, req.params.confrontoId)
    res.redirect(`/torneios/${req.params.id}?msg=Partida registrada.#confronto-${alvo}`)
  } catch (err) {
    res.redirect(
      `/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}#confronto-${req.params.confrontoId}`
    )
  }
})

router.post('/torneios/:id/confrontos/:confrontoId/desfazer', exigirTorneio, (req, res) => {
  try {
    TorneioService.desfazerUltimaPartida(Number(req.params.id), Number(req.params.confrontoId))
    res.redirect(
      `/torneios/${req.params.id}?msg=Última partida do confronto desfeita.#confronto-${req.params.confrontoId}`
    )
  } catch (err) {
    res.redirect(
      `/torneios/${req.params.id}?erro=${encodeURIComponent(err.message)}#confronto-${req.params.confrontoId}`
    )
  }
})

// ---------------- Painel público (TV) ----------------

function renderizarPainel(res, torneioId, opcoes = {}) {
  const estado = TorneioService.obterEstado(Number(torneioId))
  res.set('Cache-Control', 'no-store')
  res.render('pages/torneios/painel', {
    estado,
    statusLabel: TorneioService.STATUS_LABEL,
    modalidadeLabel: TorneioService.MODALIDADE_LABEL,
    telaFirestick: Boolean(opcoes.telaFirestick)
  })
}

router.get('/torneios/:id/painel', (req, res) => {
  try {
    renderizarPainel(res, req.params.id)
  } catch (err) {
    renderErro(res, err)
  }
})

// Variante forçada para TV (Fire Stick / navegadores com viewport pequeno):
// ignora os media queries de mobile e exibe sempre o layout de telão.
router.get('/torneios/:id/painel-tv', (req, res) => {
  try {
    renderizarPainel(res, req.params.id, { telaFirestick: true })
  } catch (err) {
    renderErro(res, err)
  }
})

module.exports = router
