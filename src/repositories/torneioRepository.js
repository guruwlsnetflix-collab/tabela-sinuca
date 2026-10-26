const db = require('../db')

const TAMANHO_CHAVE = 16

const TorneioRepository = {
  listar() {
    return db
      .prepare(
        `
        SELECT t.id, t.nome, t.local, t.data_inicio, t.previsao_termino,
               t.modalidade, t.numero_mesas, t.status, t.criado_em,
               tj.nome AS vencedor_nome
        FROM torneios t
        LEFT JOIN torneio_jogadores tj ON tj.id = t.vencedor_id
        ORDER BY t.id DESC
      `
      )
      .all()
  },

  obterPorId(id) {
    return db
      .prepare(
        `
        SELECT t.id, t.nome, t.local, t.data_inicio, t.previsao_termino,
               t.modalidade, t.numero_mesas, t.status, t.vencedor_id, t.criado_em,
               tj.nome AS vencedor_nome
        FROM torneios t
        LEFT JOIN torneio_jogadores tj ON tj.id = t.vencedor_id
        WHERE t.id = ?
      `
      )
      .get(id)
  },

  criar({ nome, local, data_inicio, previsao_termino, modalidade, numero_mesas, senha_hash = null }) {
    const info = db
      .prepare(
        `
        INSERT INTO torneios (nome, local, data_inicio, previsao_termino, modalidade, numero_mesas, senha_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        nome,
        local || null,
        data_inicio,
        previsao_termino || null,
        modalidade || 'par',
        numero_mesas || 1,
        senha_hash
      )
    return this.obterPorId(info.lastInsertRowid)
  },

  listarComSenha() {
    return db.prepare('SELECT id, nome, senha_hash FROM torneios WHERE senha_hash IS NOT NULL').all()
  },

  atualizarSenha(id, senha_hash) {
    db.prepare('UPDATE torneios SET senha_hash = ? WHERE id = ?').run(senha_hash, id)
    return this.obterPorId(id)
  },

  atualizar(id, { nome, local, data_inicio, previsao_termino, modalidade, numero_mesas }) {
    db.prepare(
      `
      UPDATE torneios
      SET nome = ?, local = ?, data_inicio = ?, previsao_termino = ?, modalidade = ?, numero_mesas = ?
      WHERE id = ?
    `
    ).run(
      nome,
      local || null,
      data_inicio,
      previsao_termino || null,
      modalidade || 'par',
      numero_mesas || 1,
      id
    )
    return this.obterPorId(id)
  },

  atualizarStatus(id, status) {
    db.prepare('UPDATE torneios SET status = ? WHERE id = ?').run(status, id)
    return this.obterPorId(id)
  },

  limparVencedor(id) {
    db.prepare('UPDATE torneios SET vencedor_id = NULL, status = ? WHERE id = ?').run('em_andamento', id)
    return this.obterPorId(id)
  },

  definirVencedor(id, jogadorId) {
    db.prepare('UPDATE torneios SET vencedor_id = ?, status = ? WHERE id = ?').run(
      jogadorId,
      'finalizado',
      id
    )
    return this.obterPorId(id)
  },

  contarPartidasRealizadas(id) {
    return db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM torneio_partidas tp
        JOIN torneio_confrontos tc ON tc.id = tp.confronto_id
        WHERE tc.torneio_id = ?
      `
      )
      .get(id).total
  },

  excluir(id) {
    db.prepare('DELETE FROM torneios WHERE id = ?').run(id)
  },

  // ---------------- Jogadores do torneio ----------------

  listarJogadores(torneioId) {
    return db
      .prepare(
        `
        SELECT id, torneio_id, posicao, nome, apelido, telefone, criado_em
        FROM torneio_jogadores
        WHERE torneio_id = ?
        ORDER BY posicao IS NULL, posicao, nome
      `
      )
      .all(torneioId)
  },

  contarJogadores(torneioId) {
    return db.prepare('SELECT COUNT(*) AS total FROM torneio_jogadores WHERE torneio_id = ?').get(torneioId)
      .total
  },

  obterJogador(id) {
    return db
      .prepare(
        `
        SELECT id, torneio_id, posicao, nome, apelido, telefone, criado_em
        FROM torneio_jogadores
        WHERE id = ?
      `
      )
      .get(id)
  },

  criarJogador({ torneio_id, nome, apelido, telefone }) {
    const info = db
      .prepare(
        `
        INSERT INTO torneio_jogadores (torneio_id, nome, apelido, telefone)
        VALUES (?, ?, ?, ?)
      `
      )
      .run(torneio_id, nome, apelido || null, telefone || null)
    return this.obterJogador(info.lastInsertRowid)
  },

  atualizarJogador(id, { nome, apelido, telefone }) {
    db.prepare(
      `
      UPDATE torneio_jogadores
      SET nome = ?, apelido = ?, telefone = ?
      WHERE id = ?
    `
    ).run(nome, apelido || null, telefone || null, id)
    return this.obterJogador(id)
  },

  excluirJogador(id) {
    db.prepare('DELETE FROM torneio_jogadores WHERE id = ?').run(id)
  },

  limparPosicoes(torneioId) {
    db.prepare('UPDATE torneio_jogadores SET posicao = NULL WHERE torneio_id = ?').run(torneioId)
  },

  atribuirPosicoes(torneioId, ordenados) {
    const stmt = db.prepare('UPDATE torneio_jogadores SET posicao = ? WHERE id = ?')
    const transacao = db.transaction((pares) => {
      pares.forEach(([posicao, jogadorId]) => {
        stmt.run(posicao, jogadorId)
      })
    })
    transacao(ordenados)
  }
}

module.exports = TorneioRepository
module.exports.TAMANHO_CHAVE = TAMANHO_CHAVE
