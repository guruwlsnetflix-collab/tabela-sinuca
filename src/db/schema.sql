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

-- ============================================================
-- MÓDULO DE TORNEIOS (mata-mata com chave de 16 jogadores)
-- ============================================================

CREATE TABLE IF NOT EXISTS torneio_jogadores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  torneio_id INTEGER NOT NULL REFERENCES torneios (id) ON DELETE CASCADE,
  posicao    INTEGER,
  nome       TEXT    NOT NULL,
  apelido    TEXT,
  telefone   TEXT,
  criado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_torneio_jogadores_torneio ON torneio_jogadores (torneio_id);

CREATE TABLE IF NOT EXISTS torneios (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nome             TEXT    NOT NULL,
  local            TEXT,
  data_inicio      TEXT    NOT NULL,
  previsao_termino TEXT,
  modalidade       TEXT    NOT NULL DEFAULT 'par'
    CHECK (modalidade IN ('par', 'impar')),
  numero_mesas     INTEGER NOT NULL DEFAULT 1
    CHECK (numero_mesas >= 1),
  status           TEXT    NOT NULL DEFAULT 'cadastro_jogadores'
    CHECK (status IN ('planejado', 'cadastro_jogadores', 'sorteado', 'em_andamento', 'finalizado', 'cancelado')),
  vencedor_id      INTEGER REFERENCES torneio_jogadores (id) ON DELETE SET NULL,
  criado_em        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS torneio_confrontos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  torneio_id          INTEGER NOT NULL REFERENCES torneios (id) ON DELETE CASCADE,
  numero              INTEGER NOT NULL,
  fase                TEXT    NOT NULL
    CHECK (fase IN ('oitavas', 'quartas', 'semifinais', 'final')),
  jogador_a_id        INTEGER REFERENCES torneio_jogadores (id),
  jogador_b_id        INTEGER REFERENCES torneio_jogadores (id),
  vencedor_id         INTEGER REFERENCES torneio_jogadores (id),
  placar_a            INTEGER NOT NULL DEFAULT 0,
  placar_b            INTEGER NOT NULL DEFAULT 0,
  vitorias_necessarias INTEGER NOT NULL DEFAULT 2,
  status              TEXT    NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'em_andamento', 'finalizado')),
  criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_torneio_confronto_numero UNIQUE (torneio_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_torneio_confrontos_torneio ON torneio_confrontos (torneio_id);

CREATE TABLE IF NOT EXISTS torneio_partidas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  confronto_id  INTEGER NOT NULL REFERENCES torneio_confrontos (id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL,
  vencedor_id   INTEGER NOT NULL REFERENCES torneio_jogadores (id),
  registrada_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_torneio_partidas_confronto ON torneio_partidas (confronto_id);
