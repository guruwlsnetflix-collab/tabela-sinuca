const db = require('../db')

const JogadorRepository = {
  listarPorEvento(eventoId) {
    return db
      .prepare(`
        SELECT id, evento_id, nome, apelido, telefone, ativo
        FROM jogadores
        WHERE evento_id = ?
        ORDER BY nome
      `)
      .all(eventoId)
  },

  obterPorId(id) {
    return db
      .prepare(`
        SELECT id, evento_id, nome, apelido, telefone, ativo, criado_em
        FROM jogadores
        WHERE id = ?
      `)
      .get(id)
  },

  criar({ evento_id, nome, apelido, telefone }) {
    const info = db
      .prepare('INSERT INTO jogadores (evento_id, nome, apelido, telefone) VALUES (?, ?, ?, ?)')
      .run(evento_id, nome, apelido || null, telefone || null)
    return this.obterPorId(info.lastInsertRowid)
  },

  atualizar(id, { nome, apelido, telefone, ativo }) {
    db.prepare('UPDATE jogadores SET nome = ?, apelido = ?, telefone = ?, ativo = ? WHERE id = ?').run(
      nome,
      apelido || null,
      telefone || null,
      ativo ? 1 : 0,
      id
    )
    return this.obterPorId(id)
  },

  contarPartidas(id) {
    return db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM partidas
        WHERE jogador_a_id = ? OR jogador_b_id = ?
      `)
      .get(id, id).total
  },

  excluir(id) {
    db.prepare('DELETE FROM jogadores WHERE id = ?').run(id)
  }
}

module.exports = JogadorRepository
