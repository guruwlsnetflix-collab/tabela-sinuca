PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL UNIQUE,
  data_inicio TEXT    NOT NULL,
  data_fim    TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'planejado'
    CHECK (status IN ('planejado', 'em_andamento', 'encerrado')),
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jogadores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id  INTEGER NOT NULL REFERENCES eventos (id) ON DELETE CASCADE,
  nome       TEXT    NOT NULL,
  apelido    TEXT,
  telefone   TEXT,
  ativo      INTEGER NOT NULL DEFAULT 1,
  criado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jogadores_evento ON jogadores (evento_id);

CREATE TABLE IF NOT EXISTS partidas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id     INTEGER NOT NULL REFERENCES eventos (id) ON DELETE CASCADE,
  jogador_a_id  INTEGER NOT NULL REFERENCES jogadores (id),
  jogador_b_id  INTEGER NOT NULL REFERENCES jogadores (id),
  vencedor_id   INTEGER NOT NULL REFERENCES jogadores (id),
  data_partida  TEXT    NOT NULL DEFAULT (datetime('now')),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (jogador_a_id <> jogador_b_id),
  CHECK (vencedor_id IN (jogador_a_id, jogador_b_id))
);

CREATE INDEX IF NOT EXISTS idx_partidas_evento ON partidas (evento_id);
CREATE INDEX IF NOT EXISTS idx_partidas_jogador_a ON partidas (jogador_a_id);
CREATE INDEX IF NOT EXISTS idx_partidas_jogador_b ON partidas (jogador_b_id);
