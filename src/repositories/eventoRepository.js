const db = require('../db')

const EventoRepository = {
  listar() {
    return db
      .prepare(
        `
        SELECT id, nome, data_inicio, data_fim, status, valor_aposta_padrao
        FROM eventos
        ORDER BY data_inicio DESC, id DESC
      `
      )
      .all()
  },

  obterPorId(id) {
    return db
      .prepare(
        `
        SELECT id, nome, data_inicio, data_fim, status, valor_aposta_padrao, criado_em
        FROM eventos
        WHERE id = ?
      `
      )
      .get(id)
  },

  obterPorNome(nome, ignorarId = null) {
    if (ignorarId === null) {
      return db.prepare('SELECT id FROM eventos WHERE nome = ?').get(nome)
    }
    return db.prepare('SELECT id FROM eventos WHERE nome = ? AND id <> ?').get(nome, ignorarId)
  },

  criar({ nome, data_inicio, data_fim, valor_aposta_padrao = 0, senha_hash = null }) {
    const info = db
      .prepare(
        'INSERT INTO eventos (nome, data_inicio, data_fim, status, valor_aposta_padrao, senha_hash) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(nome, data_inicio, data_fim, 'planejado', valor_aposta_padrao, senha_hash)
    return this.obterPorId(info.lastInsertRowid)
  },

  listarComSenha() {
    return db.prepare('SELECT id, nome, senha_hash FROM eventos WHERE senha_hash IS NOT NULL').all()
  },

  obterSenha(id) {
    return db.prepare('SELECT id, senha_hash FROM eventos WHERE id = ? AND senha_hash IS NOT NULL').get(id)
  },

  atualizarSenha(id, senha_hash) {
    db.prepare('UPDATE eventos SET senha_hash = ? WHERE id = ?').run(senha_hash, id)
    return this.obterPorId(id)
  },

  atualizar(id, { nome, data_inicio, data_fim, valor_aposta_padrao }) {
    db.prepare(
      'UPDATE eventos SET nome = ?, data_inicio = ?, data_fim = ?, valor_aposta_padrao = ? WHERE id = ?'
    ).run(nome, data_inicio, data_fim, valor_aposta_padrao, id)
    return this.obterPorId(id)
  },

  atualizarStatus(id, status) {
    db.prepare('UPDATE eventos SET status = ? WHERE id = ?').run(status, id)
    return this.obterPorId(id)
  },

  contarPartidas(id) {
    return db.prepare('SELECT COUNT(*) AS total FROM partidas WHERE evento_id = ?').get(id).total
  },

  excluir(id) {
    db.prepare('DELETE FROM eventos WHERE id = ?').run(id)
  }
}

module.exports = EventoRepository
