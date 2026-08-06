# 🎱 Tabela de Sinuca

Sistema web para controle de jogos de sinuca em eventos. Cada evento tem seus
próprios jogadores e partidas, com ranking calculado automaticamente pela
campanha de cada jogador (regra "vencedor permanece na mesa").

## Funcionalidades (v1)

- CRUD de **eventos** (torneio com `data_inicio`, `data_fim` e `status`).
- Cadastro de **jogadores por evento**.
- Registro de **partidas** (jogador A × jogador B + vencedor) com edição/exclusão.
- **Sorteio automático** do próximo adversário (vencedor permanece na mesa).
- **Ranking por evento** (Vitórias → Derrotas → ordem de cadastro).

## Stack

- Node.js (>= 20) + Express
- SQLite (better-sqlite3)
- EJS + Bootstrap 5
- Vitest + Supertest (testes)

## Como executar localmente

```bash
npm install
npm run db:init   # cria o banco e as tabelas
npm run dev       # servidor em http://localhost:3000
```

Testes:

```bash
npm test
```

## Deploy na Railway

Instruções completas em [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md).

## Estrutura

```
src/
  server.js        # entrada do servidor
  app.js           # configuração do Express
  config.js        # variáveis de ambiente
  db/              # conexão, schema e inicialização
  routes/          # rotas
  views/           # templates EJS
  public/          # arquivos estáticos
tests/             # testes automatizados
docs/              # documentação e plano de desenvolvimento
```
