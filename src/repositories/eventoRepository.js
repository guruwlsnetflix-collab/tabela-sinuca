const db = require('../db')

const EventoRepository = {
  listar() {
    return db
      .prepare(`
        SELECT id, nome, data_inicio, data_fim, status
        FROM eventos
        ORDER BY data_inicio DESC, id DESC
      `)
      .all()
  },

  obterPorId(id) {
    return db
      .prepare(`
        SELECT id, nome, data_inicio, data_fim, status, criado_em
        FROM eventos
        WHERE id = ?
      `)
      .get(id)
  },

  obterPorNome(nome, ignorarId = null) {
    if (ignorarId === null) {
      return db.prepare('SELECT id FROM eventos WHERE nome = ?').get(nome)
    }
    return db.prepare('SELECT id FROM eventos WHERE nome = ? AND id <> ?').get(nome, ignorarId)
  },

  criar({ nome, data_inicio, data_fim }) {
    const info = db
      .prepare('INSERT INTO eventos (nome, data_inicio, data_fim, status) VALUES (?, ?, ?, ?)')
      .run(nome, data_inicio, data_fim, 'planejado')
    return this.obterPorId(info.lastInsertRowid)
  },

  atualizar(id, { nome, data_inicio, data_fim }) {
    db.prepare('UPDATE eventos SET nome = ?, data_inicio = ?, data_fim = ? WHERE id = ?').run(
      nome,
      data_inicio,
      data_fim,
      id
    )
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
