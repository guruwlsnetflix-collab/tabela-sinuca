const db = require('../db')
const TorneioRepository = require('../repositories/torneioRepository')
const ConfrontoRepository = require('../repositories/confrontoRepository')
const AuthService = require('./authService')

const TAMANHO_CHAVE = 16

const STATUS_LABEL = {
  planejado: 'Planejado',
  cadastro_jogadores: 'Cadastro de jogadores',
  sorteado: 'Sorteio realizado',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado'
}

// Modalidade única exibida: valores antigos ('par'/'impar') continuam válidos no banco
const MODALIDADE_LABEL = {
  par: 'Par ou Ímpar',
  impar: 'Par ou Ímpar'
}

const CONFRONTO_STATUS_LABEL = {
  aguardando: 'Aguardando',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado'
}

const FASES = [
  { key: 'oitavas', label: 'Oitavas de final', numeros: [1, 2, 3, 4, 5, 6, 7, 8] },
  { key: 'quartas', label: 'Quartas de final', numeros: [9, 10, 11, 12] },
  { key: 'semifinais', label: 'Semifinais', numeros: [13, 14] },
  { key: 'final', label: 'Final', numeros: [15] }
]

function faseDoNumero(numero) {
  if (numero <= 8) return 'oitavas'
  if (numero <= 12) return 'quartas'
  if (numero <= 14) return 'semifinais'
  return 'final'
}

function faseLabel(key) {
  const fase = FASES.find((f) => f.key === key)
  return fase ? fase.label : key
}

// Confronto vencedor → onde entra na fase seguinte (chave fixa)
const AVANCO_CHAVE = {
  1: { proximo: 9, lado: 'a' },
  2: { proximo: 9, lado: 'b' },
  3: { proximo: 10, lado: 'a' },
  4: { proximo: 10, lado: 'b' },
  5: { proximo: 11, lado: 'a' },
  6: { proximo: 11, lado: 'b' },
  7: { proximo: 12, lado: 'a' },
  8: { proximo: 12, lado: 'b' },
  9: { proximo: 13, lado: 'a' },
  10: { proximo: 13, lado: 'b' },
  11: { proximo: 14, lado: 'a' },
  12: { proximo: 14, lado: 'b' },
  13: { proximo: 15, lado: 'a' },
  14: { proximo: 15, lado: 'b' }
}

function vitoriasNecessarias(numero) {
  return numero === 15 ? 3 : 2
}

function embaralhar(lista, rng) {
  const aleatorio = rng || Math.random
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

class TorneioNaoEncontradoError extends Error {
  constructor() {
    super('Torneio não encontrado.')
    this.status = 404
  }
}

function negar(mensagem, status = 400) {
  const err = new Error(mensagem)
  err.status = status
  return err
}

const TorneioService = {
  STATUS_LABEL,
  MODALIDADE_LABEL,
  CONFRONTO_STATUS_LABEL,
  FASES,
  TAMANHO_CHAVE,

  listar() {
    return TorneioRepository.listar()
  },

  obter(id) {
    const torneio = TorneioRepository.obterPorId(id)
    if (!torneio) {
      throw new TorneioNaoEncontradoError()
    }
    return torneio
  },

  criar({ nome, local, data_inicio, previsao_termino, modalidade, numero_mesas, senha }) {
    return TorneioRepository.criar({
      nome,
      local,
      data_inicio,
      previsao_termino,
      modalidade,
      numero_mesas,
      senha_hash: senha && String(senha).trim() ? AuthService.hashSenha(senha) : null
    })
  },

  atualizar(id, dados) {
    const torneio = this.obter(id)
    if (!['planejado', 'cadastro_jogadores'].includes(torneio.status)) {
      throw negar('Não é possível editar o torneio após o sorteio.')
    }
    if (dados.senha && String(dados.senha).trim()) {
      TorneioRepository.atualizarSenha(id, AuthService.hashSenha(dados.senha))
    }
    return TorneioRepository.atualizar(id, dados)
  },

  cancelar(id) {
    const torneio = this.obter(id)
    if (torneio.status === 'finalizado') {
      throw negar('Torneio finalizado não pode ser cancelado.')
    }
    return TorneioRepository.atualizarStatus(id, 'cancelado')
  },

  excluir(id) {
    const torneio = this.obter(id)
    if (TorneioRepository.contarPartidasRealizadas(torneio.id) > 0) {
      throw negar('Não é possível excluir um torneio com partidas registradas.')
    }
    TorneioRepository.excluir(id)
  },

  // ---------------- Jogadores ----------------

  contarJogadores(torneioId) {
    return TorneioRepository.contarJogadores(torneioId)
  },

  listarJogadores(torneioId) {
    this.obter(torneioId)
    return TorneioRepository.listarJogadores(torneioId)
  },

  // Garante que o jogador pertence ao torneio da URL
  obterJogador(torneioId, jogadorId) {
    const jogador = TorneioRepository.obterJogador(jogadorId)
    if (!jogador || jogador.torneio_id !== Number(torneioId)) {
      throw negar('Jogador não encontrado.', 404)
    }
    return jogador
  },

  _bloquearAlteracaoDeJogador(torneio) {
    if (!['planejado', 'cadastro_jogadores'].includes(torneio.status)) {
      throw negar('Não é possível alterar jogadores após o sorteio do torneio.')
    }
  },

  cadastrarJogador({ torneio_id, nome, apelido, telefone }) {
    const torneio = this.obter(torneio_id)
    this._bloquearAlteracaoDeJogador(torneio)
    if (TorneioRepository.contarJogadores(torneio.id) >= TAMANHO_CHAVE) {
      throw negar(`O torneio já possui os ${TAMANHO_CHAVE} jogadores cadastrados.`)
    }
    return TorneioRepository.criarJogador({ torneio_id, nome, apelido, telefone })
  },

  atualizarJogador(id, dados) {
    const jogador = TorneioRepository.obterJogador(id)
    if (!jogador) {
      throw new Error('Jogador não encontrado.')
    }
    const torneio = this.obter(jogador.torneio_id)
    this._bloquearAlteracaoDeJogador(torneio)
    return TorneioRepository.atualizarJogador(id, dados)
  },

  excluirJogador(id) {
    const jogador = TorneioRepository.obterJogador(id)
    if (!jogador) {
      throw new Error('Jogador não encontrado.')
    }
    const torneio = this.obter(jogador.torneio_id)
    this._bloquearAlteracaoDeJogador(torneio)
    TorneioRepository.excluirJogador(id)
  },

  // ---------------- Sorteio ----------------

  sortear(torneioId, rng) {
    const torneio = this.obter(torneioId)
    if (torneio.status !== 'cadastro_jogadores' && torneio.status !== 'sorteado') {
      throw negar('Não é possível refazer o sorteio após o início do torneio.')
    }

    const jogadores = TorneioRepository.listarJogadores(torneio.id)
    if (jogadores.length !== TAMANHO_CHAVE) {
      throw negar(
        `O sorteio só pode ser realizado com os ${TAMANHO_CHAVE} jogadores cadastrados (atualmente: ${jogadores.length}).`
      )
    }

    const jaSorteado = confrontosExistem(torneio.id)
    if (jaSorteado) {
      if (TorneioRepository.contarPartidasRealizadas(torneio.id) > 0) {
        throw negar('Não é possível refazer o sorteio após o início do torneio.')
      }
      ConfrontoRepository.excluirTodosDoTorneio(torneio.id)
    }

    const embaralhados = embaralhar(jogadores, rng)
    TorneioRepository.atribuirPosicoes(
      torneio.id,
      embaralhados.map((j, indice) => [indice + 1, j.id])
    )

    this._gerarConfrontos(torneio.id)
    return TorneioRepository.atualizarStatus(torneio.id, 'sorteado')
  },

  _gerarConfrontos(torneioId) {
    const numeros = []
    for (let numero = 1; numero <= 15; numero += 1) {
      numeros.push({
        numero,
        fase: faseDoNumero(numero),
        vitorias: vitoriasNecessarias(numero)
      })
    }
    ConfrontoRepository.criar(torneioId, numeros)

    const jogadores = TorneioRepository.listarJogadores(torneioId)
    const porPosicao = new Map(jogadores.map((j) => [j.posicao, j]))
    for (let conf = 1; conf <= 8; conf += 1) {
      const a = porPosicao.get(conf * 2 - 1)
      const b = porPosicao.get(conf * 2)
      if (!a || !b) {
        throw negar('Falha ao montar a chave: posições do sorteio incompletas.')
      }
      const confronto = ConfrontoRepository.obterPorNumero(torneioId, conf)
      ConfrontoRepository.preencherJogador(confronto.id, 'jogador_a_id', a.id)
      ConfrontoRepository.preencherJogador(confronto.id, 'jogador_b_id', b.id)
    }
  },

  // ---------------- Início ----------------

  iniciar(torneioId) {
    const torneio = this.obter(torneioId)
    if (torneio.status !== 'sorteado') {
      throw negar('O torneio deve ter o sorteio realizado antes de ser iniciado.')
    }
    if (this.contarJogadores(torneio.id) !== TAMANHO_CHAVE) {
      throw negar(`São necessários ${TAMANHO_CHAVE} jogadores para iniciar o torneio.`)
    }
    const oitavas = ConfrontoRepository.listarPorTorneio(torneio.id).slice(0, 8)
    const incompletas = oitavas.some((c) => !c.jogador_a_id || !c.jogador_b_id)
    if (incompletas) {
      throw negar('A chave de oitavas está incompleta. Realize o sorteio novamente.')
    }
    return TorneioRepository.atualizarStatus(torneio.id, 'em_andamento')
  },

  // ---------------- Confrontos ----------------

  iniciarConfronto(torneioId, confrontoId) {
    const torneio = this.obter(torneioId)
    if (torneio.status !== 'em_andamento') {
      throw negar('O torneio precisa estar em andamento.')
    }
    const confronto = ConfrontoRepository.obterPorId(confrontoId)
    if (!confronto || confronto.torneio_id !== torneio.id) {
      throw new TorneioNaoEncontradoError()
    }
    if (confronto.status === 'finalizado') {
      throw negar('Este confronto já foi finalizado.')
    }
    if (!confronto.jogador_a_id || !confronto.jogador_b_id) {
      throw negar('O confronto ainda não possui os dois jogadores definidos.')
    }
    const mesas = this._mesasOcupadas(torneio.id)
    if (mesas >= torneio.numero_mesas) {
      throw negar(
        `Todas as ${torneio.numero_mesas} mesa(s) estão ocupadas (${mesas} jogo(s) em andamento). Aguarde um confronto terminar.`
      )
    }
    ConfrontoRepository.iniciar(confronto.id)
    return ConfrontoRepository.obterPorId(confronto.id)
  },

  registrarPartida(torneioId, confrontoId, vencedorJogadorId) {
    const torneio = this.obter(torneioId)
    if (torneio.status !== 'em_andamento') {
      throw negar('Registro de partidas é permitido apenas com o torneio em andamento.')
    }

    const confronto = ConfrontoRepository.obterPorId(confrontoId)
    if (!confronto || confronto.torneio_id !== torneio.id) {
      throw new TorneioNaoEncontradoError()
    }
    if (confronto.status === 'finalizado') {
      throw negar('Este confronto já foi finalizado.')
    }
    if (!confronto.jogador_a_id || !confronto.jogador_b_id) {
      throw negar('O confronto ainda não possui os dois jogadores definidos.')
    }
    const vencedorId = Number(vencedorJogadorId)
    if (![confronto.jogador_a_id, confronto.jogador_b_id].includes(vencedorId)) {
      throw negar('O vencedor indicado não participa deste confronto.')
    }
    if (
      confronto.placar_a >= confronto.vitorias_necessarias ||
      confronto.placar_b >= confronto.vitorias_necessarias
    ) {
      throw negar('O confronto já possui um vencedor.')
    }

    const executar = db.transaction(() => {
      const numeroPartida = ConfrontoRepository.contarPartidas(confronto.id) + 1
      ConfrontoRepository.criarPartida({
        confronto_id: confronto.id,
        numero: numeroPartida,
        vencedor_id: vencedorId
      })

      const campoVencedor = vencedorId === confronto.jogador_a_id ? 'placar_a' : 'placar_b'
      ConfrontoRepository.somarPlacar(confronto.id, campoVencedor)

      const atualizado = ConfrontoRepository.obterPorId(confronto.id)
      const placarVencedor =
        vencedorId === atualizado.jogador_a_id ? atualizado.placar_a : atualizado.placar_b

      if (placarVencedor >= atualizado.vitorias_necessarias) {
        ConfrontoRepository.finalizar(atualizado.id, vencedorId, atualizado.placar_a, atualizado.placar_b)
        this._avancarVencedor(torneio.id, atualizado, vencedorId)
        return ConfrontoRepository.obterPorId(atualizado.id)
      }

      ConfrontoRepository.setStatus(atualizado.id, 'em_andamento')
      return ConfrontoRepository.obterPorId(atualizado.id)
    })

    return executar()
  },

  _avancarVencedor(torneioId, confronto, vencedorId) {
    if (confronto.numero === 15) {
      TorneioRepository.definirVencedor(torneioId, vencedorId)
      return
    }
    const destino = AVANCO_CHAVE[confronto.numero]
    if (!destino) return
    const proximo = ConfrontoRepository.obterPorNumero(torneioId, destino.proximo)
    if (!proximo) return
    const campo = destino.lado === 'a' ? 'jogador_a_id' : 'jogador_b_id'
    ConfrontoRepository.preencherJogador(proximo.id, campo, vencedorId)
  },

  // ---------------- Correção administrativa ----------------

  desfazerUltimaPartida(torneioId, confrontoId) {
    const torneio = this.obter(torneioId)
    if (!['em_andamento', 'finalizado'].includes(torneio.status)) {
      throw negar('Não há resultados para corrigir nesta fase do torneio.')
    }

    const confronto = ConfrontoRepository.obterPorId(confrontoId)
    if (!confronto || confronto.torneio_id !== torneio.id) {
      throw new TorneioNaoEncontradoError()
    }

    const ultima = ConfrontoRepository.ultimaPartida(confronto.id)
    if (!ultima) {
      throw negar('Não há partidas registradas neste confronto para desfazer.')
    }

    if (confronto.numero < 15) {
      const destino = AVANCO_CHAVE[confronto.numero]
      const proximo = destino ? ConfrontoRepository.obterPorNumero(torneio.id, destino.proximo) : null
      if (proximo && ConfrontoRepository.contarPartidas(proximo.id) > 0) {
        throw negar('Desfaça antes os resultados do confronto seguinte.')
      }
    }

    const executar = db.transaction(() => {
      const campoVencedor = ultima.vencedor_id === confronto.jogador_a_id ? 'placar_a' : 'placar_b'
      ConfrontoRepository.subtrairPlacar(confronto.id, campoVencedor)
      ConfrontoRepository.excluirPartida(ultima.id)

      const atualizado = ConfrontoRepository.obterPorId(confronto.id)
      const totalPartidas = ConfrontoRepository.contarPartidas(atualizado.id)

      if (atualizado.status === 'finalizado') {
        if (confronto.numero === 15) {
          TorneioRepository.limparVencedor(torneio.id)
        } else {
          TorneioRepository.atualizarStatus(torneio.id, 'em_andamento')
          const destino = AVANCO_CHAVE[confronto.numero]
          const proximo = destino ? ConfrontoRepository.obterPorNumero(torneio.id, destino.proximo) : null
          if (proximo) {
            const campo = destino && destino.lado === 'a' ? 'jogador_a_id' : 'jogador_b_id'
            if (campo === 'jogador_a_id') {
              ConfrontoRepository.preencherJogador(proximo.id, 'jogador_a_id', null)
            } else {
              ConfrontoRepository.preencherJogador(proximo.id, 'jogador_b_id', null)
            }
          }
        }
        ConfrontoRepository.reabrir(atualizado.id, atualizado.placar_a, atualizado.placar_b)
        if (totalPartidas === 0) {
          ConfrontoRepository.setStatus(atualizado.id, 'aguardando')
        }
      } else {
        if (totalPartidas === 0) {
          ConfrontoRepository.setStatus(atualizado.id, 'aguardando')
        }
      }
      return ConfrontoRepository.obterPorId(atualizado.id)
    })

    return executar()
  },

  // ---------------- Estado para views ----------------

  _mesasOcupadas(torneioId) {
    return ConfrontoRepository.listarPorTorneio(torneioId).filter((c) => c.status === 'em_andamento').length
  },

  obterEstado(torneioId) {
    const torneio = this.obter(torneioId)
    const jogadores = TorneioRepository.listarJogadores(torneio.id)
    const confrontos = ConfrontoRepository.listarPorTorneio(torneio.id)

    const confCompletos = confrontos.map((c) => ({
      ...c,
      faseLabel: faseLabel(c.fase),
      statusLabel: CONFRONTO_STATUS_LABEL[c.status] || c.status,
      preparado: Boolean(c.jogador_a_id && c.jogador_b_id),
      partidasRealizadas: ConfrontoRepository.contarPartidas(c.id),
      proximaPartida: ConfrontoRepository.contarPartidas(c.id) + 1,
      maximoPartidas: c.vitorias_necessarias * 2 - 1
    }))

    const fases = FASES.map((fase) => ({
      ...fase,
      confrontos: confCompletos.filter((c) => c.fase === fase.key)
    }))

    const mesasOcupadas = this._mesasOcupadas(torneio.id)

    return {
      torneio: {
        ...torneio,
        statusLabel: STATUS_LABEL[torneio.status] || torneio.status,
        modalidadeLabel: MODALIDADE_LABEL[torneio.modalidade] || torneio.modalidade
      },
      jogadores,
      totalJogadores: jogadores.length,
      mesasOcupadas,
      mesasDisponiveis: Math.max(0, torneio.numero_mesas - mesasOcupadas),
      confrontos: confCompletos,
      fases,
      faseAtual: calcularFaseAtual(torneio, confCompletos),
      classificados: confCompletos
        .filter((c) => c.status === 'finalizado' && c.vencedor_id)
        .map((c) => ({ numero: c.numero, vencedor: c.vencedor_nome })),
      proximosConfrontos: confCompletos.filter((c) => c.status === 'aguardando' && c.preparado)
    }
  },
  faseLabel
}

function confrontosExistem(torneioId) {
  return ConfrontoRepository.listarPorTorneio(torneioId).length > 0
}

function calcularFaseAtual(torneio, confrontos) {
  if (torneio.status === 'finalizado') {
    return { key: 'final', label: 'Final', concluido: true, fase: null, confronto: null }
  }
  if (torneio.status === 'cancelado') {
    return null
  }
  const emAndamento = confrontos.find((c) => c.status === 'em_andamento')
  if (emAndamento) {
    return {
      key: emAndamento.fase,
      label: emAndamento.faseLabel,
      fase: emAndamento.fase,
      confronto: emAndamento
    }
  }
  const proximo = confrontos.find((c) => c.status === 'aguardando' && c.preparado)
  if (proximo) {
    return { key: proximo.fase, label: proximo.faseLabel, fase: proximo.fase, confronto: proximo }
  }
  return null
}

module.exports = TorneioService
module.exports.Errors = {
  TorneioNaoEncontradoError
}
