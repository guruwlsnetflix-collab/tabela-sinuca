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

  desativar(id) {
    db.prepare('UPDATE jogadores SET ativo = 0 WHERE id = ?').run(id)
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

  listarPartidas(id) {
    return db
      .prepare(`
        SELECT p.id, p.jogador_a_id, p.jogador_b_id, p.vencedor_id, p.data_partida,
               pa.nome AS jogador_a, pb.nome AS jogador_b, pv.nome AS vencedor
        FROM partidas p
        JOIN jogadores pa ON pa.id = p.jogador_a_id
        JOIN jogadores pb ON pb.id = p.jogador_b_id
        JOIN jogadores pv ON pv.id = p.vencedor_id
        WHERE p.jogador_a_id = ? OR p.jogador_b_id = ?
        ORDER BY p.data_partida DESC, p.id DESC
      `)
      .all(id, id)
  },

  excluir(id) {
    db.prepare('DELETE FROM jogadores WHERE id = ?').run(id)
  }
}

module.exports = JogadorRepository
