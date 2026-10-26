const db = require('../db')

const PartidaRepository = {
  listarPorEvento(eventoId) {
    return db
      .prepare(`
        SELECT p.id, p.evento_id, p.jogador_a_id, p.jogador_b_id, p.vencedor_id, p.data_partida, p.valor_aposta, p.pago,
               pa.nome AS jogador_a, pb.nome AS jogador_b, pv.nome AS vencedor
        FROM partidas p
        JOIN jogadores pa ON pa.id = p.jogador_a_id
        JOIN jogadores pb ON pb.id = p.jogador_b_id
        JOIN jogadores pv ON pv.id = p.vencedor_id
        WHERE p.evento_id = ?
        ORDER BY p.data_partida DESC, p.id DESC
      `)
      .all(eventoId)
  },

  obterPorId(id) {
    return db
      .prepare(`
        SELECT p.id, p.evento_id, p.jogador_a_id, p.jogador_b_id, p.vencedor_id, p.data_partida, p.valor_aposta, p.pago,
               pa.nome AS jogador_a, pb.nome AS jogador_b, pv.nome AS vencedor
        FROM partidas p
        JOIN jogadores pa ON pa.id = p.jogador_a_id
        JOIN jogadores pb ON pb.id = p.jogador_b_id
        JOIN jogadores pv ON pv.id = p.vencedor_id
        WHERE p.id = ?
      `)
      .get(id)
  },

  criar({ evento_id, jogador_a_id, jogador_b_id, vencedor_id, data_partida, valor_aposta = 0, pago = 0 }) {
    const info = db
      .prepare(`
        INSERT INTO partidas (evento_id, jogador_a_id, jogador_b_id, vencedor_id, data_partida, valor_aposta, pago)
        VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?)
      `)
      .run(evento_id, jogador_a_id, jogador_b_id, vencedor_id, data_partida || null, valor_aposta, pago ? 1 : 0)
    return this.obterPorId(info.lastInsertRowid)
  },

  atualizar(id, { jogador_a_id, jogador_b_id, vencedor_id, data_partida, valor_aposta, pago = 0 }) {
    db.prepare(`
      UPDATE partidas
      SET jogador_a_id = ?, jogador_b_id = ?, vencedor_id = ?,
          data_partida = COALESCE(?, data_partida), valor_aposta = ?, pago = ?
      WHERE id = ?
    `).run(jogador_a_id, jogador_b_id, vencedor_id, data_partida || null, valor_aposta, pago ? 1 : 0, id)
    return this.obterPorId(id)
  },

  alternarPago(id) {
    db.prepare('UPDATE partidas SET pago = CASE WHEN pago = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
    return this.obterPorId(id)
  },

  excluir(id) {
    db.prepare('DELETE FROM partidas WHERE id = ?').run(id)
  }
}

module.exports = PartidaRepository
