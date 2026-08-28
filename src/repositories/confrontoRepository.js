const db = require('../db')

const ConfrontoRepository = {
  listarPorTorneio(torneioId) {
    return db
      .prepare(`
        SELECT tc.id, tc.torneio_id, tc.numero, tc.fase,
               tc.jogador_a_id, tc.jogador_b_id, tc.vencedor_id,
               tc.placar_a, tc.placar_b, tc.vitorias_necessarias, tc.status,
               ja.nome AS jogador_a_nome, jb.nome AS jogador_b_nome,
               jv.nome AS vencedor_nome
        FROM torneio_confrontos tc
        LEFT JOIN torneio_jogadores ja ON ja.id = tc.jogador_a_id
        LEFT JOIN torneio_jogadores jb ON jb.id = tc.jogador_b_id
        LEFT JOIN torneio_jogadores jv ON jv.id = tc.vencedor_id
        WHERE tc.torneio_id = ?
        ORDER BY tc.numero
      `)
      .all(torneioId)
  },

  obterPorId(id) {
    return db
      .prepare(`
        SELECT tc.id, tc.torneio_id, tc.numero, tc.fase,
               tc.jogador_a_id, tc.jogador_b_id, tc.vencedor_id,
               tc.placar_a, tc.placar_b, tc.vitorias_necessarias, tc.status,
               ja.nome AS jogador_a_nome, jb.nome AS jogador_b_nome,
               jv.nome AS vencedor_nome
        FROM torneio_confrontos tc
        LEFT JOIN torneio_jogadores ja ON ja.id = tc.jogador_a_id
        LEFT JOIN torneio_jogadores jb ON jb.id = tc.jogador_b_id
        LEFT JOIN torneio_jogadores jv ON jv.id = tc.vencedor_id
        WHERE tc.id = ?
      `)
      .get(id)
  },

  obterPorNumero(torneioId, numero) {
    return db
      .prepare(`
        SELECT tc.id, tc.torneio_id, tc.numero, tc.fase,
               tc.jogador_a_id, tc.jogador_b_id, tc.vencedor_id,
               tc.placar_a, tc.placar_b, tc.vitorias_necessarias, tc.status,
               ja.nome AS jogador_a_nome, jb.nome AS jogador_b_nome,
               jv.nome AS vencedor_nome
        FROM torneio_confrontos tc
        LEFT JOIN torneio_jogadores ja ON ja.id = tc.jogador_a_id
        LEFT JOIN torneio_jogadores jb ON jb.id = tc.jogador_b_id
        LEFT JOIN torneio_jogadores jv ON jv.id = tc.vencedor_id
        WHERE tc.torneio_id = ? AND tc.numero = ?
      `)
      .get(torneioId, numero)
  },

  criar(torneioId, numeros) {
    const stmt = db.prepare(`
      INSERT INTO torneio_confrontos
        (torneio_id, numero, fase, vitorias_necessarias)
      VALUES (?, ?, ?, ?)
    `)
    const transacao = db.transaction((lista) => {
      lista.forEach(({ numero, fase, vitorias }) => {
        stmt.run(torneioId, numero, fase, vitorias)
      })
    })
    transacao(numeros)
  },

  excluirTodosDoTorneio(torneioId) {
    db.exec('PRAGMA foreign_keys = ON')
    db.prepare('DELETE FROM torneio_confrontos WHERE torneio_id = ?').run(torneioId)
  },

  preencherJogador(id, campo, jogadorId) {
    db.prepare(`UPDATE torneio_confrontos SET ${campo} = ? WHERE id = ?`).run(jogadorId || null, id)
  },

  iniciar(id) {
    db.prepare("UPDATE torneio_confrontos SET status = 'em_andamento' WHERE id = ?").run(id)
  },

  finalizar(id, vencedorId, placarA, placarB) {
    db.prepare(`
      UPDATE torneio_confrontos
      SET status = 'finalizado', vencedor_id = ?, placar_a = ?, placar_b = ?
      WHERE id = ?
    `).run(vencedorId, placarA, placarB, id)
  },

  somarPlacar(id, campo) {
    db.prepare(`UPDATE torneio_confrontos SET ${campo} = ${campo} + 1 WHERE id = ?`).run(id)
  },

  subtrairPlacar(id, campo) {
    db.prepare(
      `UPDATE torneio_confrontos SET ${campo} = MAX(0, ${campo} - 1) WHERE id = ?`
    ).run(id)
  },

  reabrir(id, placarA, placarB) {
    db.prepare(`
      UPDATE torneio_confrontos
      SET status = 'em_andamento', vencedor_id = NULL, placar_a = ?, placar_b = ?
      WHERE id = ?
    `).run(placarA, placarB, id)
  },

  setStatus(id, status) {
    db.prepare('UPDATE torneio_confrontos SET status = ? WHERE id = ?').run(status, id)
  },

  // ---------------- Partidas de confronto ----------------

  contarPartidas(confrontoId) {
    return db
      .prepare('SELECT COUNT(*) AS total FROM torneio_partidas WHERE confronto_id = ?')
      .get(confrontoId).total
  },

  criarPartida({ confronto_id, numero, vencedor_id }) {
    const info = db
      .prepare(`
        INSERT INTO torneio_partidas (confronto_id, numero, vencedor_id)
        VALUES (?, ?, ?)
      `)
      .run(confronto_id, numero, vencedor_id)
    return info.lastInsertRowid
  },

  ultimaPartida(confrontoId) {
    return db
      .prepare(`
        SELECT id, confronto_id, numero, vencedor_id, registrada_em
        FROM torneio_partidas
        WHERE confronto_id = ?
        ORDER BY numero DESC, id DESC
        LIMIT 1
      `)
      .get(confrontoId)
  },

  excluirPartida(partidaId) {
    db.prepare('DELETE FROM torneio_partidas WHERE id = ?').run(partidaId)
  },

  listarPartidas(confrontoId) {
    return db
      .prepare(`
        SELECT tp.id, tp.numero, tp.vencedor_id, tp.registrada_em,
               tj.nome AS vencedor_nome
        FROM torneio_partidas tp
        LEFT JOIN torneio_jogadores tj ON tj.id = tp.vencedor_id
        WHERE tp.confronto_id = ?
        ORDER BY tp.numero
      `)
      .all(confrontoId)
  }
}

module.exports = ConfrontoRepository