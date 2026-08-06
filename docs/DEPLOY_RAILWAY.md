# Deploy na Railway

Guia passo a passo para publicar o **tabela-sinuca** na [Railway](https://railway.com).

## Pré-requisitos

- Conta na Railway (o plano **Hobby** é suficiente para este projeto).
- Repositório do projeto publicado no GitHub
  (`https://github.com/guruwlsnetflix-collab/tabela-sinuca`).

> O projeto já vem com um `railway.toml` na raiz configurando build e deploy.
> O builder é **`DOCKERFILE`** (usa o `Dockerfile` na raiz, mais determinístico
> que o builder padrão — o Railpack — que pode falhar intermitentemente ao
> baixar/descompactar o snapshot do repositório). O aplicativo lê a variável
> `PORT` fornecida pela Railway e o banco SQLite é persistido em um **volume**.

## Passo 1 — Criar o projeto na Railway

1. Acesse https://railway.com e faça login.
2. Clique em **New Project** → **Deploy from GitHub repo**.
3. Autorize a conexão com a sua conta GitHub e selecione o repositório
   `guruwlsnetflix-collab/tabela-sinuca`.
4. A Railway detectará o `railway.toml` e fará o primeiro deploy automaticamente.

> Se o repositório estiver em uma **organização**, autorize o acesso da Railway
> à organização durante o fluxo de conexão do GitHub.

## Passo 2 — Criar o volume para persistir o SQLite

O filesystem de um serviço na Railway é **efêmero** (é apagado a cada novo
deploy). Para não perder os dados do banco, criamos um **volume** persistente:

1. No projeto, clique no **serviço** (o card do backend).
2. Abra a aba **Settings** → role até **Volumes**.
3. Clique em **Add Volume**.
4. Monte o volume no caminho **`/data`** (aplicações na Railway ficam em `/app`,
   então usamos um caminho absoluto fora de `/app`).
5. A Railway cria automaticamente o volume (nome sugerido: `sinuca-data`).

## Passo 3 — Configurar a variável de ambiente

1. No serviço, abra a aba **Variables**.
2. Adicione a variável:

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_PATH` | `/data/sinuca.db` |

   Esse caminho garante que o arquivo SQLite seja gravado **dentro do volume**
   montado em `/data`.

> `NODE_ENV=production` e `PORT` são configuradas automaticamente pela Railway.
> Não é preciso adicioná-las manualmente.

## Passo 4 — Redeploy

1. Com o volume montado e a variável configurada, faça um novo deploy
   (ou envie um novo commit/push para o branch `main` — o auto-deploy roda sozinho).
2. No deploy, o `railway.toml` executa:

   ```
   npm run db:init && npm start
   ```

   O `db:init` cria as tabelas no banco em `/data/sinuca.db` (idempotente).

## Passo 5 — Verificar o healthcheck

A Railway usa o **healthcheck path** `/health` (configurado no `railway.toml`)
para saber se a aplicação subiu corretamente:

- Enquanto `/health` não responder `200`, o deploy permanece como **building**.
- Depois de saudável, a Railway fornece um domínio público
  (ex.: `https://tabela-sinuca-production.up.railway.app`).

## Auto-deploy

A Railway faz deploy **automaticamente** a cada push no branch conectado.
Para desativar: **Settings** → **Deployments** → desative *Auto Deploy*.

## Troubleshooting

### O deploy falha ao compilar o `better-sqlite3`

`better-sqlite3` é um módulo nativo. Ele possui binários pré-compilados para
Linux x64 (padrão da Railway). O `Dockerfile` já instala `python3`, `make` e
`g++` como fallback de compilação. Se mesmo assim a compilação falhar, verifique
os **logs do build** para identificar o erro exato do `node-gyp`.

### O banco "some" após um novo deploy

Isso acontece quando `DATABASE_PATH` não aponta para dentro do volume.
Confirme que:

1. O volume está montado em `/data`.
2. `DATABASE_PATH=/data/sinuca.db` está definido nas variables.
3. O arquivo `data/sinuca.db` **não** foi criado localmente e enviado para o
   repositório (o diretório `data/` está no `.gitignore`).

### O deploy fica em *building* para sempre

O healthcheck pode estar falhando. Veja os logs do serviço e teste a rota
`/health` manualmente no domínio gerado.

## Atualizações futuras

Para atualizar a aplicação em produção basta fazer `git push` no branch `main`.
A Railway detecta o novo commit, roda o build, executa o `db:init` (que mantém
os dados existentes, pois apenas garante que as tabelas existem) e reinicia o
serviço sem perder o volume.
