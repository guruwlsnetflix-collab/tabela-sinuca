#!/usr/bin/env bash
# Publica a versão da branch main no servidor (VM) via SSH.
#
#   npm run publicar            # publica o que está na main do GitHub
#   npm run publicar -- status  # só mostra versão, processo e saúde do app
#
# Passos: backup do banco -> git pull -> npm ci -> pm2 restart -> /health.
# Se o app não responder após o reinício, volta para a versão anterior.
#
# Configuração (variáveis de ambiente, opcionais):
#   SINUCA_SSH      destino SSH            (padrão: ubuntu@guru-sinuca.duckdns.org)
#   SINUCA_SSH_KEY  chave privada          (padrão: ~/.ssh/oracle.key)
#   SINUCA_DIR      pasta do app na VM     (padrão: /home/ubuntu/sinuca)
#   SINUCA_DB       banco SQLite na VM     (padrão: /home/ubuntu/sinuca-data/sinuca.db)
#   SINUCA_PM2      nome do processo pm2   (padrão: sinuca)
#   SINUCA_PORTA    porta local do app     (padrão: 5000)
set -euo pipefail

SSH_DESTINO="${SINUCA_SSH:-ubuntu@guru-sinuca.duckdns.org}"
SSH_CHAVE="${SINUCA_SSH_KEY:-$HOME/.ssh/oracle.key}"
DIR="${SINUCA_DIR:-/home/ubuntu/sinuca}"
DB="${SINUCA_DB:-/home/ubuntu/sinuca-data/sinuca.db}"
PM2_NOME="${SINUCA_PM2:-sinuca}"
PORTA="${SINUCA_PORTA:-5000}"
ACAO="${1:-publicar}"

remoto() {
  ssh -i "$SSH_CHAVE" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "$SSH_DESTINO" \
    "DIR='$DIR' DB='$DB' PM2_NOME='$PM2_NOME' PORTA='$PORTA' bash -s"
}

if [ "$ACAO" = "status" ]; then
  remoto <<'REMOTO'
set -e
cd "$DIR"
echo "Versão no servidor: $(git log --oneline -1)"
pm2 describe "$PM2_NOME" | grep -E "status|uptime|restarts" | head -3
echo "Saúde: $(curl -s -m 5 "http://127.0.0.1:$PORTA/health" || echo 'sem resposta')"
REMOTO
  exit 0
fi

if [ "$ACAO" != "publicar" ]; then
  echo "Uso: npm run publicar [-- status]" >&2
  exit 2
fi

echo "==> Publicando a main em $SSH_DESTINO"
remoto <<'REMOTO'
set -euo pipefail
cd "$DIR"

saudavel() {
  for _ in $(seq 1 15); do
    if curl -sf -m 3 "http://127.0.0.1:$PORTA/health" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

ANTES=$(git rev-parse HEAD)
git fetch -q origin main
DEPOIS=$(git rev-parse origin/main)
if [ "$ANTES" = "$DEPOIS" ]; then
  echo "Servidor já está na versão mais recente ($(git log --oneline -1))."
  exit 0
fi

echo "==> Backup do banco"
DATABASE_PATH="$DB" NODE_ENV=production node src/db/backup.js

echo "==> Atualizando código: $(git log --oneline -1 "$ANTES") -> $(git log --oneline -1 "$DEPOIS")"
git merge -q --ff-only origin/main
npm ci --omit=dev --no-audit --no-fund --loglevel=error

echo "==> Reiniciando o app"
pm2 restart "$PM2_NOME" >/dev/null

if saudavel; then
  echo "==> OK: app respondendo na versão $(git log --oneline -1)"
  exit 0
fi

echo "!!> App não respondeu. Voltando para a versão anterior..." >&2
git reset -q --hard "$ANTES"
npm ci --omit=dev --no-audit --no-fund --loglevel=error
pm2 restart "$PM2_NOME" >/dev/null
saudavel && echo "!!> Versão anterior restaurada e respondendo." >&2
echo "!!> Veja o erro com: pm2 logs $PM2_NOME --lines 50" >&2
exit 1
REMOTO
