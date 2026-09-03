import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const app = require('../src/app')
const db = require('../src/db')
const TorneioService = require('../src/services/torneioService')
const TorneioRepository = require('../src/repositories/torneioRepository')
const ConfrontoRepository = require('../src/repositories/confrontoRepository')

const NOMES = Array.from({ length: 16 }, (_, i) => `Jogador ${String(i + 1).padStart(2, '0')}`)

function limparDb() {
  db.exec('DELETE FROM torneios;')
}

function criarTorneio() {
  return TorneioService.criar({
    nome: 'Torneio Teste',
    local: 'Bar do Zé',
    data_inicio: '2026-09-01',
    previsao_termino: '2026-09-02',
    modalidade: 'par'
  })
}

function criarTorneioComMesas(numeroMesas) {
  return TorneioService.criar({
    nome: 'Torneio Mesas',
    local: 'Bar do Zé',
    data_inicio: '2026-09-01',
    previsao_termino: '2026-09-02',
    modalidade: 'par',
    numero_mesas: numeroMesas
  })
}

function cadastrar16(torneioId) {
  return NOMES.map((nome) => TorneioService.cadastrarJogador({ torneio_id: torneioId, nome }))
}

function jogosCompletos(torneioId) {
  return ConfrontoRepository.listarPorTorneio(torneioId)
}

describe('TorneioService — cadastro e regras gerais', () => {
  beforeEach(limparDb)

  it('cria torneio com status inicial de cadastro de jogadores', () => {
    const torneio = criarTorneio()
    expect(torneio.status).toBe('cadastro_jogadores')
    expect(torneio.nome).toBe('Torneio Teste')
    expect(torneio.modalidade).toBe('par')
  })

  it('permite cadastrar até 16 jogadores e bloqueia o 17º', () => {
    const torneio = criarTorneio()
    const jogadores = cadastrar16(torneio.id)
    expect(jogadores).toHaveLength(16)
    expect(TorneioService.contarJogadores(torneio.id)).toBe(16)
    expect(() =>
      TorneioService.cadastrarJogador({ torneio_id: torneio.id, nome: 'Jogador Extra' })
    ).toThrow('já possui os 16 jogadores')
  })

  it('não permite editar o torneio após o sorteio', () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    expect(() =>
      TorneioService.atualizar(torneio.id, { nome: 'Novo nome' })
    ).toThrow('após o sorteio')
  })

  it('não permite alterar/excluir jogadores após o sorteio', () => {
    const torneio = criarTorneio()
    const jogadores = cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    expect(() =>
      TorneioService.atualizarJogador(jogadores[0].id, { nome: 'X' })
    ).toThrow('após o sorteio')
    expect(() => TorneioService.excluirJogador(jogadores[0].id)).toThrow('após o sorteio')
  })

  it('não exclui torneio que já possui partidas', () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)
    const c1 = ConfrontoRepository.obterPorNumero(torneio.id, 1)
    TorneioService.registrarPartida(torneio.id, c1.id, c1.jogador_a_id)
    expect(() => TorneioService.excluir(torneio.id)).toThrow('partidas registradas')
  })
})

describe('TorneioService — sorteio e chave', () => {
  beforeEach(limparDb)

  it('não sorteia sem os 16 jogadores', () => {
    const torneio = criarTorneio()
    TorneioService.cadastrarJogador({ torneio_id: torneio.id, nome: 'Só um' })
    expect(() => TorneioService.sortear(torneio.id)).toThrow('16 jogadores')
  })

  it('distribui cada jogador em uma posição única e forma as oitavas corretamente', () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    expect(torneio.status === 'sorteado' || true).toBe(true)
    expect(TorneioService.obter(torneio.id).status).toBe('sorteado')

    const jogadores = TorneioRepository.listarJogadores(torneio.id)
    const posicoes = jogadores.map((j) => j.posicao).sort((a, b) => a - b)
    expect(posicoes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])

    const porPosicao = new Map(jogadores.map((j) => [j.posicao, j]))
    const oitavas = ConfrontoRepository.listarPorTorneio(torneio.id)
    expect(oitavas).toHaveLength(15)

    for (let n = 1; n <= 8; n += 1) {
      const c = oitavas[n - 1]
      expect(c.numero).toBe(n)
      expect(c.fase).toBe('oitavas')
      expect(c.jogador_a_id).toBe(porPosicao.get(n * 2 - 1).id)
      expect(c.jogador_b_id).toBe(porPosicao.get(n * 2).id)
    }

    const quartas = oitavas.slice(8, 12)
    quartas.forEach((c) => {
      expect(c.jogador_a_id).toBeNull()
      expect(c.jogador_b_id).toBeNull()
    })
    const final = oitavas[14]
    expect(final.fase).toBe('final')
    expect(final.vitorias_necessarias).toBe(3)
  })

  it('não refaz o sorteio depois que há partidas', () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)
    const c1 = ConfrontoRepository.obterPorNumero(torneio.id, 1)
    TorneioService.registrarPartida(torneio.id, c1.id, c1.jogador_a_id)
    expect(() => TorneioService.sortear(torneio.id)).toThrow('após o início')
  })

  it('não inicia torneio sem sorteio', () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    expect(() => TorneioService.iniciar(torneio.id)).toThrow('sorteio')
  })
})

describe('TorneioService — partidas, placares e avanço automático', () => {
  beforeEach(limparDb)

  function prepararTorneio() {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)
    return torneio.id
  }

  it('não registra partida com torneio ainda não iniciado', () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    const c1 = ConfrontoRepository.obterPorNumero(torneio.id, 1)
    expect(() =>
      TorneioService.registrarPartida(torneio.id, c1.id, c1.jogador_a_id)
    ).toThrow('em andamento')
  })

  it('não registra vencedor que não participa do confronto', () => {
    const torneioId = prepararTorneio()
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const intruso = TorneioRepository.listarJogadores(torneioId).find(
      (j) => j.id !== c1.jogador_a_id && j.id !== c1.jogador_b_id
    )
    expect(() => TorneioService.registrarPartida(torneioId, c1.id, intruso.id)).toThrow(
      'não participa'
    )
  })

  it('encerra confronto com 2×0 (melhor de 3) e bloqueia a terceira partida', () => {
    const torneioId = prepararTorneio()
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    const atualizado = ConfrontoRepository.obterPorId(c1.id)
    expect(atualizado.status).toBe('finalizado')
    expect(atualizado.vencedor_id).toBe(c1.jogador_a_id)
    expect(atualizado.placar_a).toBe(2)
    expect(atualizado.placar_b).toBe(0)
    expect(() =>
      TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    ).toThrow('finalizado')
  })

  it('encerra confronto com 2×1 quando necessário', () => {
    const torneioId = prepararTorneio()
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const a = c1.jogador_a_id
    const b = c1.jogador_b_id
    TorneioService.registrarPartida(torneioId, c1.id, a)
    TorneioService.registrarPartida(torneioId, c1.id, b)
    TorneioService.registrarPartida(torneioId, c1.id, a)
    const atualizado = ConfrontoRepository.obterPorId(c1.id)
    expect(atualizado.status).toBe('finalizado')
    expect(atualizado.placar_a).toBe(2)
    expect(atualizado.placar_b).toBe(1)
    expect(atualizado.vencedor_id).toBe(a)
  })

  it('avança o vencedor automaticamente para a posição correta da próxima fase', () => {
    const torneioId = prepararTorneio()
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const c2 = ConfrontoRepository.obterPorNumero(torneioId, 2)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c2.id, c2.jogador_b_id)
    TorneioService.registrarPartida(torneioId, c2.id, c2.jogador_b_id)

    const c9 = ConfrontoRepository.obterPorNumero(torneioId, 9)
    expect(c9.jogador_a_id).toBe(c1.jogador_a_id)
    expect(c9.jogador_b_id).toBe(c2.jogador_b_id)
  })

  it('não permite registrar partida em confronto sem os dois jogadores', () => {
    const torneioId = prepararTorneio()
    const c9 = ConfrontoRepository.obterPorNumero(torneioId, 9)
    expect(c9.jogador_a_id).toBeNull()
    expect(() =>
      TorneioService.registrarPartida(torneioId, c9.id, c9.jogador_a_id)
    ).toThrow('dois jogadores definidos')
  })

  it('desfaz a última partida e remove o avanço do classificado', () => {
    const torneioId = prepararTorneio()
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)

    let c9 = ConfrontoRepository.obterPorNumero(torneioId, 9)
    expect(c9.jogador_a_id).toBe(c1.jogador_a_id)

    TorneioService.desfazerUltimaPartida(torneioId, c1.id)
    let atualizado = ConfrontoRepository.obterPorId(c1.id)
    expect(atualizado.status).toBe('em_andamento')
    expect(atualizado.vencedor_id).toBeNull()
    expect(atualizado.placar_a).toBe(1)
    c9 = ConfrontoRepository.obterPorNumero(torneioId, 9)
    expect(c9.jogador_a_id).toBeNull()

    TorneioService.desfazerUltimaPartida(torneioId, c1.id)
    atualizado = ConfrontoRepository.obterPorId(c1.id)
    expect(atualizado.status).toBe('aguardando')
    expect(atualizado.placar_a).toBe(0)
  })

  it('bloqueia desfazer quando o confronto seguinte já tem partidas', () => {
    const torneioId = prepararTorneio()
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const c2 = ConfrontoRepository.obterPorNumero(torneioId, 2)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c2.id, c2.jogador_b_id)
    TorneioService.registrarPartida(torneioId, c2.id, c2.jogador_b_id)

    const c9 = ConfrontoRepository.obterPorNumero(torneioId, 9)
    TorneioService.registrarPartida(torneioId, c9.id, c9.jogador_a_id)

    expect(() => TorneioService.desfazerUltimaPartida(torneioId, c1.id)).toThrow(
      'confronto seguinte'
    )
  })
})

describe('TorneioService — final melhor de 5', () => {
  beforeEach(limparDb)

  function chegarAFinal(resultadoOitavas) {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)

    const fechar = (numero, vencedorLado) => {
      const c = ConfrontoRepository.obterPorNumero(torneio.id, numero)
      const vencedor = vencedorLado === 'a' ? c.jogador_a_id : c.jogador_b_id
      TorneioService.registrarPartida(torneio.id, c.id, vencedor)
      TorneioService.registrarPartida(torneio.id, c.id, vencedor)
    }

    for (let n = 1; n <= 8; n += 1) {
      fechar(n, resultadoOitavas[n - 1])
    }
    for (const n of [9, 10, 11, 12]) {
      fechar(n, resultadoOitavas[n - 1])
    }
    fechar(13, 'a')
    fechar(14, 'a')
    return torneio.id
  }

  it('final disputada em melhor de 5 termina 3×0 e declara campeão', () => {
    const torneioId = chegarAFinal('a'.repeat(12).split(''))
    const final = ConfrontoRepository.obterPorNumero(torneioId, 15)
    expect(final.vitorias_necessarias).toBe(3)

    for (let i = 0; i < 3; i += 1) {
      TorneioService.registrarPartida(torneioId, final.id, final.jogador_a_id)
    }

    const atualizado = ConfrontoRepository.obterPorId(final.id)
    expect(atualizado.status).toBe('finalizado')
    expect(atualizado.placar_a).toBe(3)
    expect(atualizado.placar_b).toBe(0)

    const torneio = TorneioService.obter(torneioId)
    expect(torneio.status).toBe('finalizado')
    expect(torneio.vencedor_id).toBe(final.jogador_a_id)

    expect(() =>
      TorneioService.registrarPartida(torneioId, final.id, final.jogador_a_id)
    ).toThrow()
  })

  it('final termina 3×1', () => {
    const torneioId = chegarAFinal('a'.repeat(12).split(''))
    const final = ConfrontoRepository.obterPorNumero(torneioId, 15)
    const a = final.jogador_a_id
    const b = final.jogador_b_id
    ;[a, b, a, a].forEach((v) => TorneioService.registrarPartida(torneioId, final.id, v))
    const atualizado = ConfrontoRepository.obterPorId(final.id)
    expect(atualizado.placar_a).toBe(3)
    expect(atualizado.placar_b).toBe(1)
    expect(TorneioService.obter(torneioId).status).toBe('finalizado')
  })

  it('final termina 3×2', () => {
    const torneioId = chegarAFinal('a'.repeat(12).split(''))
    const final = ConfrontoRepository.obterPorNumero(torneioId, 15)
    const a = final.jogador_a_id
    const b = final.jogador_b_id
    ;[a, b, a, b, a].forEach((v) => TorneioService.registrarPartida(torneioId, final.id, v))
    const atualizado = ConfrontoRepository.obterPorId(final.id)
    expect(atualizado.placar_a).toBe(3)
    expect(atualizado.placar_b).toBe(2)
    expect(TorneioService.obter(torneioId).status).toBe('finalizado')
  })

  it('desfazer partida da final recoloca o torneio em andamento', () => {
    const torneioId = chegarAFinal('a'.repeat(12).split(''))
    const final = ConfrontoRepository.obterPorNumero(torneioId, 15)
    const a = final.jogador_a_id
    const b = final.jogador_b_id
    ;[a, b, a, b, a].forEach((v) => TorneioService.registrarPartida(torneioId, final.id, v))
    expect(TorneioService.obter(torneioId).status).toBe('finalizado')

    TorneioService.desfazerUltimaPartida(torneioId, final.id)
    expect(TorneioService.obter(torneioId).status).toBe('em_andamento')
    const atualizado = ConfrontoRepository.obterPorId(final.id)
    expect(atualizado.status).toBe('em_andamento')
    expect(atualizado.placar_a).toBe(2)
    expect(atualizado.placar_b).toBe(2)
  })
})

describe('Torneio — fluxo HTTP completo', () => {
  beforeEach(limparDb)

  it('cria torneio, cadastra 16, sorteia, registra tudo e exibe painel com campeão', async () => {
    const criar = await request(app).post('/torneios').send({
      nome: 'Torneio HTTP',
      local: 'Clube',
      data_inicio: '2026-09-01',
      previsao_termino: '2026-09-03',
      modalidade: 'par'
    })
    expect(criar.status).toBe(302)
    const loc = criar.headers.location
    const torneioId = Number(loc.match(/\/torneios\/(\d+)/)[1])

    for (let i = 1; i <= 16; i += 1) {
      const nome = `Jogador ${String(i).padStart(2, '0')}`
      const r = await request(app).post(`/torneios/${torneioId}/jogadores`).send({ nome })
      expect(r.status).toBe(302)
    }

    expect(TorneioService.contarJogadores(torneioId)).toBe(16)

    const detalhe = await request(app).get(`/torneios/${torneioId}`)
    expect(detalhe.status).toBe(200)
    expect(detalhe.text).toContain('16/16')

    await request(app).post(`/torneios/${torneioId}/sortear`).send({})
    expect(TorneioService.obter(torneioId).status).toBe('sorteado')

    await request(app).post(`/torneios/${torneioId}/iniciar`).send({})
    expect(TorneioService.obter(torneioId).status).toBe('em_andamento')

    const fecharVencedorA = (numero) => {
      const c = ConfrontoRepository.obterPorNumero(torneioId, numero)
      TorneioService.registrarPartida(torneioId, c.id, c.jogador_a_id)
      TorneioService.registrarPartida(torneioId, c.id, c.jogador_a_id)
    }
    const vencedorEsquerda = (numero) => {
      const c = ConfrontoRepository.obterPorNumero(torneioId, numero)
      return c.jogador_a_id
    }
    const vencedorDireita = (numero) => {
      const c = ConfrontoRepository.obterPorNumero(torneioId, numero)
      return c.jogador_b_id
    }

    for (let n = 1; n <= 8; n += 1) fecharVencedorA(n)
    for (const n of [9, 10, 11, 12]) fecharVencedorA(n)
    fecharVencedorA(13)
    const c14 = ConfrontoRepository.obterPorNumero(torneioId, 14)
    TorneioService.registrarPartida(torneioId, c14.id, c14.jogador_b_id)
    TorneioService.registrarPartida(torneioId, c14.id, c14.jogador_b_id)

    const final = ConfrontoRepository.obterPorNumero(torneioId, 15)
    const campeao = vencedorEsquerda(13)
    const adversario = vencedorDireita(14)
    expect([campeao, adversario].sort()).toEqual(
      [final.jogador_a_id, final.jogador_b_id].sort()
    )

    await request(app)
      .post(`/torneios/${torneioId}/confrontos/${final.id}/partidas`)
      .send({ vencedor_id: campeao })
    await request(app)
      .post(`/torneios/${torneioId}/confrontos/${final.id}/partidas`)
      .send({ vencedor_id: adversario })
    await request(app)
      .post(`/torneios/${torneioId}/confrontos/${final.id}/partidas`)
      .send({ vencedor_id: campeao })
    await request(app)
      .post(`/torneios/${torneioId}/confrontos/${final.id}/partidas`)
      .send({ vencedor_id: campeao })

    const torneio = TorneioService.obter(torneioId)
    expect(torneio.status).toBe('finalizado')
    expect(torneio.vencedor_id).toBe(campeao)

    const vencedorNome = TorneioRepository.obterJogador(campeao).nome
    const painel = await request(app).get(`/torneios/${torneioId}/painel`)
    expect(painel.status).toBe(200)
    expect(painel.text).toContain('CAMPEÃO')
    expect(painel.text).toContain(vencedorNome)
    expect(painel.text).toContain('atualizarPainel')
  })

  it('variante painel-tv (Fire Stick) força o layout de telão', async () => {
    const criar = await request(app).post('/torneios').send({
      nome: 'Torneio TV',
      data_inicio: '2026-09-01'
    })
    const torneioId = Number(criar.headers.location.match(/\/torneios\/(\d+)/)[1])
    for (let i = 1; i <= 16; i += 1) {
      await request(app).post(`/torneios/${torneioId}/jogadores`).send({ nome: `Jogador ${i}` })
    }
    await request(app).post(`/torneios/${torneioId}/sortear`).send({})

    const tv = await request(app).get(`/torneios/${torneioId}/painel-tv`)
    expect(tv.status).toBe(200)
    expect(tv.text).toContain('painel--telao')
    expect(tv.text).toContain('width=1600')
    expect(tv.text).toContain('atualizarPainel')
    expect(tv.text).not.toContain('http-equiv="refresh"')
    expect(tv.headers['cache-control']).toBe('no-store')

    const original = await request(app).get(`/torneios/${torneioId}/painel`)
    expect(original.status).toBe(200)
    expect(original.text).not.toContain('painel--telao')
    expect(original.text).toContain('width=device-width')
  })

  it('não permite sorteio com menos de 16 jogadores (valida na rota)', async () => {
    const criar = await request(app).post('/torneios').send({
      nome: 'Torneio Incompleto',
      data_inicio: '2026-09-01'
    })
    const torneioId = Number(criar.headers.location.match(/\/torneios\/(\d+)/)[1])
    for (let i = 1; i <= 10; i += 1) {
      await request(app).post(`/torneios/${torneioId}/jogadores`).send({ nome: `Jogador ${i}` })
    }
    const res = await request(app).post(`/torneios/${torneioId}/sortear`).send({})
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('erro=')
    expect(TorneioService.obter(torneioId).status).toBe('cadastro_jogadores')
  })

  it('página de listagem responde 200', async () => {
    const res = await request(app).get('/torneios')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Torneios')
  })

  it('página de novo torneio responde 200', async () => {
    const res = await request(app).get('/torneios/novo')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Nome do torneio')
  })

  it('valida criação sem nome/data', async () => {
    const res = await request(app).post('/torneios').send({})
    expect(res.status).toBe(400)
    const idx = await request(app).get('/torneios')
    expect(idx.text).not.toContain('undefined')
  })
})

describe('TorneioService — número de mesas (jogos simultâneos)', () => {
  beforeEach(limparDb)

  function prepararTorneio(numeroMesas) {
    const torneio = numeroMesas ? criarTorneioComMesas(numeroMesas) : criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)
    return torneio.id
  }

  it('usa 1 mesa por padrão quando não informado', () => {
    const torneio = criarTorneio()
    expect(torneio.numero_mesas).toBe(1)
  })

  it('armazena o número de mesas informado na criação', () => {
    const torneio = criarTorneioComMesas(3)
    expect(torneio.numero_mesas).toBe(3)
  })

  it('permite iniciar confrontos até o limite de mesas e bloqueia o seguinte', () => {
    const torneioId = prepararTorneio(2)
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const c2 = ConfrontoRepository.obterPorNumero(torneioId, 2)
    const c3 = ConfrontoRepository.obterPorNumero(torneioId, 3)

    expect(TorneioService.iniciarConfronto(torneioId, c1.id).status).toBe('em_andamento')
    expect(TorneioService.iniciarConfronto(torneioId, c2.id).status).toBe('em_andamento')

    expect(() => TorneioService.iniciarConfronto(torneioId, c3.id)).toThrow('mesa')
  })

  it('com 1 mesa não permite dois confrontos simultâneos', () => {
    const torneioId = prepararTorneio(1)
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const c2 = ConfrontoRepository.obterPorNumero(torneioId, 2)

    TorneioService.iniciarConfronto(torneioId, c1.id)
    expect(() => TorneioService.iniciarConfronto(torneioId, c2.id)).toThrow('mesa')
  })

  it('libera mesa ao finalizar um confronto', () => {
    const torneioId = prepararTorneio(1)
    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    const c2 = ConfrontoRepository.obterPorNumero(torneioId, 2)

    TorneioService.iniciarConfronto(torneioId, c1.id)
    expect(() => TorneioService.iniciarConfronto(torneioId, c2.id)).toThrow('mesa')

    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)
    TorneioService.registrarPartida(torneioId, c1.id, c1.jogador_a_id)

    expect(TorneioService.iniciarConfronto(torneioId, c2.id).status).toBe('em_andamento')
  })

  it('obterEstado informa mesas ocupadas e disponíveis', () => {
    const torneioId = prepararTorneio(2)
    let estado = TorneioService.obterEstado(torneioId)
    expect(estado.torneio.numero_mesas).toBe(2)
    expect(estado.mesasOcupadas).toBe(0)
    expect(estado.mesasDisponiveis).toBe(2)

    const c1 = ConfrontoRepository.obterPorNumero(torneioId, 1)
    TorneioService.iniciarConfronto(torneioId, c1.id)

    estado = TorneioService.obterEstado(torneioId)
    expect(estado.mesasOcupadas).toBe(1)
    expect(estado.mesasDisponiveis).toBe(1)
  })

  it('valida criação com número de mesas inválido (via rota)', async () => {
    const res = await request(app).post('/torneios').send({
      nome: 'Torneio Sem Mesa',
      data_inicio: '2026-09-01',
      numero_mesas: 0
    })
    expect(res.status).toBe(400)
  })
})

describe('API JSON de torneios', () => {
  beforeEach(limparDb)

  it('GET /api/torneios lista torneios', async () => {
    const criado = criarTorneio()
    const res = await request(app).get('/api/torneios')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.torneios[0].id).toBe(criado.id)
    expect(res.body.torneios[0].status).toBe('cadastro_jogadores')
  })

  it('GET /api/torneios/:id devolve estado serializado', async () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    const res = await request(app).get(`/api/torneios/${torneio.id}`)
    expect(res.status).toBe(200)
    expect(res.body.torneio.nome).toBe('Torneio Teste')
    expect(res.body.total_jogadores).toBe(16)
    expect(res.body.fases).toHaveLength(4)
    expect(res.body.fases[0].label).toBe('Oitavas de final')
    expect(res.body.fases[0].confrontos).toHaveLength(8)
    expect(res.body.fases[0].confrontos[0].numero).toBe(1)
  })

  it('GET /api/torneios/999 devolve 404', async () => {
    const res = await request(app).get('/api/torneios/999')
    expect(res.status).toBe(404)
    expect(res.body.erro).toContain('não encontrado')
  })

  it('GET /api/torneios/:id/painel acompanha o estado em andamento', async () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)
    const c1 = ConfrontoRepository.obterPorNumero(torneio.id, 1)
    TorneioService.registrarPartida(torneio.id, c1.id, c1.jogador_a_id)

    const res = await request(app).get(`/api/torneios/${torneio.id}/painel`)
    expect(res.status).toBe(200)
    expect(res.body.torneio.status).toBe('em_andamento')
    expect(res.body.fases[0].confrontos[0].placar_a).toBe(1)
    expect(res.body.fase_atual.confronto.numero).toBe(1)
  })

  it('redireciona com âncora para o confronto após registrar partida', async () => {
    const torneio = criarTorneio()
    cadastrar16(torneio.id)
    TorneioService.sortear(torneio.id)
    TorneioService.iniciar(torneio.id)
    const c1 = ConfrontoRepository.obterPorNumero(torneio.id, 1)

    const parcial = await request(app)
      .post(`/torneios/${torneio.id}/confrontos/${c1.id}/partidas`)
      .send({ vencedor_id: c1.jogador_a_id })
    expect(parcial.status).toBe(302)
    expect(parcial.headers.location).toContain(`#confronto-${c1.id}`)

    const fechado = await request(app)
      .post(`/torneios/${torneio.id}/confrontos/${c1.id}/partidas`)
      .send({ vencedor_id: c1.jogador_a_id })
    const c2 = ConfrontoRepository.obterPorNumero(torneio.id, 2)
    expect(fechado.status).toBe(302)
    expect(fechado.headers.location).toContain(`#confronto-${c2.id}`)
  })
})