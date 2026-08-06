# Plano de Desenvolvimento — Controle de Jogos de Sinuca (BAR-CONTROL-NODE)

> Documento gerado pela liderança técnica do projeto. Serve como guia de análise,
> arquitetura e execução para a equipe de desenvolvimento. As questões em aberto
> foram respondidas pelo usuário (ver seção 11) e o plano está pronto para a
> execução, começando pela Fase 0.

---

## 1. Resumo Executivo

O objetivo é construir um sistema web para controlar partidas de sinuca em um
ambiente social (bar/clube): o usuário cadastra **jogadores**, informa **partidas**
(jogador x adversário + vencedor) e o sistema gera automaticamente um **ranking**
da melhor para a pior campanha, controlando de quem cada jogador ganhou e para
quem perdeu.

Os jogos acontecem **periodicamente em eventos** (torneio com vários dias, com
`data_inicio` e `data_fim`) e, a cada evento, os participantes podem ser diferentes.
Por isso, o sistema organiza tudo por **eventos independentes**: cada evento tem seu
próprio cadastro de **jogadores**, suas **partidas** e seu **ranking**. A decisão
confirmada é o **cadastro por evento**: cada evento mantém sua própria lista de
jogadores (tabela `jogadores` com FK `evento_id`), sem cadastro global e sem
`evento_jogadores`. O futuro **ranking entre eventos** fica como evolução e
dependerá do **casamento de jogadores por nome** (caveat registrado — ver seção 7.4).

A mecânica central da regra de negócio é o **"vencedor permanece na mesa"**
(winner stays on): a cada partida o vencedor continua jogando e o perdedor é
substituído por outro jogador. Para apoiar essa mecânica, o sistema **sorteia e
sugere o próximo adversário** entre os demais jogadores do evento — funcionalidade
central da v1.

A solução será uma aplicação web simples, de escopo controlado, usando a stack
sugerida (Node.js + Express + SQLite + EJS + Bootstrap) com arquitetura em camadas
(Repository Pattern + Service Layer), o que garante baixo acoplamento, facilidade
de manutenção e boa base para testes.

---

## 2. Análise da Solicitação

### 2.1 Objetivo interpretado

1. Cadastrar **eventos independentes** (dia de jogos / rodada / torneio com vários
   dias) com nome, data de início/fim e status — CRUD básico.
2. Cadastrar **jogadores por evento** (cada evento tem sua própria lista de jogadores).
3. **Sortear automaticamente os confrontos**: ao informar o vencedor de uma partida,
   o sistema sugere o próximo adversário ("vencedor permanece na mesa").
4. Registrar partidas informando: **evento**, jogador A, jogador B (adversário) e o vencedor.
5. Controlar histórico de confrontos **dentro do evento**: de quem cada jogador ganhou e para quem perdeu.
6. Gerar **ranking por evento** com base na campanha (melhor → pior).
7. **(Futuro)** Ranking entre eventos — evolução que dependerá do **casamento de
   jogadores por nome** (caveat da modelagem por evento).

### 2.2 Regra operacional central

- Os jogadores jogam entre si dentro de um **evento** (dia de jogos / rodada /
  torneio com vários dias).
- Quem **ganha continua na mesa**; quem **perde é substituído** por outro jogador.
- Ao registrar o **vencedor** de uma partida, o sistema **sorteia e sugere o
  próximo adversário** entre os demais jogadores do evento (preferindo quem ainda
  não jogou com o vencedor ou está há mais tempo "na fila").
- O usuário pode aceitar a sugestão ou informar manualmente o confronto; o sistema
  sempre valida a partida antes de registrar.
- Cada evento tem **jogadores próprios** (cadastro por evento); as partidas e o
  ranking são sempre **por evento**.

### 2.3 Pontos de atenção / ambiguidades resolvidas

Todos os pontos abaixo foram **confirmados pelo usuário** (detalhes na seção 11 —
Decisões Confirmadas):

1. **Empate**: não existe empate — toda partida tem um vencedor.
2. **Desempate no ranking**: apenas **Vitórias → Derrotas**; não usar aproveitamento
   nem confronto direto. Desempate final restante: **ordem de cadastro** (nome).
3. **Jogadores que não jogaram**: aparecem no final do ranking com **0 jogos**.
4. **Sorteio de confrontos**: o sistema **sorteia e sugere** o próximo adversário
   ("vencedor permanece na mesa") — funcionalidade **central da v1**.
5. **Correção de partidas**: editar/excluir é permitido, **com confirmação**.
6. **Exclusão de jogador com histórico**: **bloqueada**.
7. **Múltiplas mesas**: não na v1 (uma única mesa por evento); evolução futura.
8. **Placar/pontos**: não na v1 (apenas vencedor); evolução futura.
9. **Período do ranking**: cumulativo dentro do evento; filtro por período como evolução.
10. **Eventos periódicos**: evento representa um **torneio com vários dias**, com
    `data_inicio` e `data_fim`; **nome e data obrigatórios**, nome único.
11. **Jogadores por evento**: **cadastro por evento** (cada evento tem sua própria
    lista de jogadores); adicionar jogador enquanto o evento estiver em andamento,
    remover apenas sem partidas no evento.
12. **Ranking entre eventos**: evolução futura; com o cadastro por evento, dependerá
    do **casamento de jogadores por nome** (caveat).

---

## 3. Requisitos Funcionais (RF)

Prioridades: **M** = Must (obrigatório), **S** = Should (recomendado), **C** = Could (opcional).

| ID | Requisito | Prioridade |
|----|-----------|-----------|
| RF-01 | Cadastrar jogador **dentro de um evento** (nome, apelido opcional, telefone opcional) — o jogador pertence a um único evento. | M |
| RF-02 | Listar jogadores de um evento. | M |
| RF-03 | Editar dados de um jogador. | S |
| RF-04 | Excluir jogador — **bloqueado** quando existirem partidas no evento; permitido apenas sem histórico. | S |
| RF-05 | Registrar partida vinculada a um evento: evento, jogador 1, jogador 2 (adversário), vencedor, data/hora. | M |
| RF-06 | Impedir partida de um jogador contra ele mesmo (validação). | M |
| RF-07 | Listar partidas registradas de um evento (com possibilidade de filtro por jogador/data). | M |
| RF-08 | Editar partida (trocar vencedor, corrigir participantes) — **com confirmação**. | S |
| RF-09 | Excluir partida registrada por engano — **com confirmação**. | S |
| RF-10 | **Sortear e sugerir o próximo adversário** após informar o vencedor ("vencedor permanece na mesa"), sorteando entre os jogadores do evento, preferindo quem ainda não tem partida com o vencedor / está "na fila". | M |
| RF-11 | Calcular e exibir ranking **por evento**: melhor campanha → pior campanha, com jogadores sem partidas no final (0 jogos). | M |
| RF-12 | Exibir estatísticas por jogador **dentro do evento**: jogos, vitórias, derrotas, aproveitamento, sequência. | M |
| RF-13 | Exibir detalhe do confronto direto entre dois jogadores de um evento (quem ganhou de quem). | S |
| RF-14 | Marcar/desmarcar jogador como "ativo/inativo" (para suspender sem excluir). | C |
| RF-15 | Registrar sessão de mesa (fila de espera, quem entrou, quem ficou) — evolução, por evento. | C |
| RF-16 | Filtro do ranking por período (hoje, mês, total), dentro do evento. | C |
| RF-17 | Cadastrar evento (nome **único**, `data_inicio`, `data_fim`, descrição opcional, status) — CRUD básico. | M |
| RF-18 | Listar eventos e abrir o detalhe de cada um (dashboard do evento). | M |
| RF-19 | Adicionar/remover jogador de um evento: **adicionar enquanto em andamento**; **remover apenas sem partidas** no evento. | M |
| RF-20 | Listar jogadores de um evento (participantes). | M |
| RF-21 | Impedir partida em evento com jogador que não pertence ao evento (validação). | M |
| RF-22 | Impedir registro de partidas em evento **encerrado** (status bloqueia). | M |
| RF-23 | Editar/excluir evento (exclusão **bloqueada** com partidas; status editável). | S |
| RF-24 | (Futuro) Ranking entre eventos — evolução, dependerá do **casamento de jogadores por nome**. | C |

---

## 4. Requisitos Não Funcionais (RNF)

| ID | Requisito | Descrição |
|----|-----------|-----------|
| RNF-01 | Performance | Resposta de páginas em < 300 ms em ambiente local (aplicação leve). |
| RNF-02 | Usabilidade | Interface simples, funcional em desktop e celular (Bootstrap responsivo). |
| RNF-03 | Integridade | Banco SQLite com constraints (chaves estrangeiras, unicidade) e transações para registro de partida. |
| RNF-04 | Manutenibilidade | Arquitetura em camadas (controller → service → repository); código em inglês, UI em português. |
| RNF-05 | Testabilidade | Cobertura dos serviços de ranking, sorteio e registro de partidas com testes unitários. |
| RNF-06 | Segurança | Validação de entrada no servidor (express-validator ou validação manual), prevenção de SQL injection (parâmetros preparados). |
| RNF-07 | Portabilidade | Rodar em qualquer SO com Node.js; banco em arquivo único (sem instalação de SGBD). |
| RNF-08 | Backup simples | Banco em arquivo `.db`, copiável para backup manual. |
| RNF-09 | Versionamento | Git desde o início; commits pequenos e descritivos. |

---

## 5. Regras de Negócio Propostas

### 5.1 Mecânica da mesa ("winner stays on")

- Cada partida tem exatamente **dois jogadores** e um **vencedor** (sem empate).
- O vencedor **permanece na mesa** para a próxima partida; o perdedor é substituído
  por outro jogador do evento.
- **Sorteio automático (central na v1)**: ao registrar o vencedor de uma partida, o
  sistema **sorteia e sugere o próximo adversário** entre os demais jogadores do
  evento, preferindo jogadores que **ainda não tenham partida registrada com o
  vencedor** (não repetir adversário recém-jogado quando possível) e que estejam há
  mais tempo "na fila" (sem jogar).
- O usuário pode aceitar a sugestão ou escolher manualmente o adversário; em ambos
  os casos as validações de partida são aplicadas.

### 5.2 Validações de partida

- O `evento_id` é obrigatório e o evento deve existir e **não estar encerrado**
  (status `planejado` ou `em andamento`; partidas **bloqueadas** quando `encerrado`
  — decisão Q15).
- `jogador_a != jogador_b` (não pode jogar contra si mesmo).
- Ambos os jogadores devem existir, estar **ativos** e pertencer ao **mesmo evento**
  da partida (FK `evento_id` em `jogadores` — validação na camada de serviço).
- Vencedor deve ser um dos dois jogadores da partida.
- Data da partida não pode ser futura (validação leve).

### 5.3 Cálculo de ranking

Campos calculados por jogador **dentro de um evento** (todos os jogadores do evento,
inclusive os sem partidas):

- **J** = jogos (total de partidas disputadas).
- **V** = vitórias.
- **D** = derrotas.
- **Aproveitamento (%)** = `V / J * 100` (quando J > 0) — **exibido, mas não usado
  como critério de desempate**.
- **Confrontos** = lista de "ganhou de X" e "perdeu para Y".

Ordenação (confirmada — Q2):

1. Maior número de vitórias (**V**).
2. Menor número de derrotas (**D**).
3. **Desempate final**: ordem de cadastro (jogadores criados antes ficam na frente);
   em empate absoluto, nome (ordem alfabética) como critério estável adicional.

> Não usar aproveitamento nem confronto direto como critério de desempate (decisão Q2).

### 5.4 Jogadores sem partidas

- **Confirmado (Q3)**: aparecem no ranking, no **final** da lista, com **0 jogos**.
- Exibição: J=0, V=0, D=0, com nota visual "sem jogos".

### 5.5 Correções

- Edição de partida recalcula automaticamente o ranking (o ranking é sempre
  derivado do histórico — nunca armazenado como campo desnormalizado).
- Exclusão de partida é permitida **apenas com confirmação** (Q5).
- **Exclusão de jogador com histórico é bloqueada** (Q6). A exclusão de jogador é
  permitida somente quando ele não possui partidas no evento.

### 5.6 Eventos, jogadores e participação

- Cada **evento** é um cadastro independente com nome **único**, `data_inicio`,
  `data_fim` e **status** (`planejado` / `em andamento` / `encerrado`).
- **Cadastro por evento (Q18)**: cada evento possui sua própria lista de jogadores
  (tabela `jogadores` com FK `evento_id`). Um jogador pertence a **um único evento**;
  não há jogadores globais nem tabela `evento_jogadores`.
- **Adicionar jogador (Q16)**: permitido enquanto o evento estiver `planejado` ou
  `em andamento`; bloqueado quando `encerrado`.
- **Remover jogador (Q16)**: permitido apenas se o jogador **não tiver partidas**
  no evento; com histórico, a remoção é bloqueada.
- **Excluir evento (Q17)**: **bloqueado** quando o evento possui partidas; sem
  partidas, permitido.
- **Partidas bloqueadas (Q9)**: eventos `encerrados` não aceitam novas partidas.
- Toda **partida pertence a exatamente um evento** e seus dois jogadores pertencem
  ao mesmo evento.
- O **ranking é calculado por evento** (todos os jogadores do evento são listados).
- A mecânica "vencedor permanece na mesa" é aplicada **dentro do evento**, com o
  **sorteio automático** do próximo adversário.
- **Evolução futura / caveat**: o ranking entre eventos dependerá do **casamento de
  jogadores por nome** entre eventos distintos — menos confiável que o modelo global,
  decisão consciente do usuário (ver seção 7.4).

---

## 6. Arquitetura da Solução

### 6.1 Visão geral

```
[Browser] → [Express (Controllers)] → [Services] → [Repositories] → [SQLite]
                 ↓                              ↓
             Views EJS                    Cálculo de ranking
           (Bootstrap)                   (regras de negócio)
```

- **Controllers enxutos**: recebem request/response, validam entrada e delegam.
- **Service Layer**: contém as regras de negócio (validações, cálculo de ranking,
  transações de partida).
- **Repository Pattern**: acesso a dados isolado (SQL puro ou query builder leve).
- **Views (EJS + Bootstrap)**: camada de apresentação; sem lógica de negócio.

### 6.2 Estrutura de pastas proposta

```
C:\repos\Sinuca\
├── docs\                       # Documentação (este plano)
├── src\
│   ├── app.js                  # Bootstrap da aplicação (Express)
│   ├── server.js               # Inicialização HTTP
│   ├── config\
│   │   └── database.js         # Conexão SQLite
│   ├── routes\
│   │   ├── eventos.routes.js
│   │   ├── jogadores.routes.js
│   │   └── partidas.routes.js
│   ├── controllers\
│   │   ├── eventos.controller.js
│   │   ├── jogadores.controller.js
│   │   └── partidas.controller.js
│   ├── services\
│   │   ├── evento.service.js
│   │   ├── jogador.service.js
│   │   ├── partida.service.js
│   │   ├── sorteio.service.js
│   │   └── ranking.service.js
│   ├── repositories\
│   │   ├── evento.repository.js
│   │   ├── jogador.repository.js
│   │   └── partida.repository.js
│   ├── models\
│   │   ├── evento.model.js
│   │   ├── jogador.model.js
│   │   └── partida.model.js
│   ├── views\
│   │   ├── partials\
│   │   ├── eventos\
│   │   │   ├── index.ejs
│   │   │   ├── form.ejs
│   │   │   └── detalhe.ejs
│   │   ├── jogadores\
│   │   │   ├── index.ejs
│   │   │   ├── form.ejs
│   │   ├── partidas\
│   │   │   ├── index.ejs
│   │   │   ├── form.ejs
│   │   └── ranking\
│   │       └── index.ejs
│   ├── middlewares\
│   │   └── errorHandler.js
│   └── validators\
│       ├── evento.validator.js
│       ├── jogador.validator.js
│       └── partida.validator.js
├── test\                       # Testes automatizados
│   ├── unit\
│   │   ├── evento.service.test.js
│   │   ├── jogador.service.test.js
│   │   ├── partida.service.test.js
│   │   ├── sorteio.service.test.js
│   │   └── ranking.service.test.js
│   └── integration\
│       ├── eventos.test.js
│       └── partidas.test.js
├── db\
│   └── sinuca.db               # Banco SQLite (gerado)
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### 6.3 Fluxos principais

1. **Criação de evento** → Controller valida → Service trata regra (nome obrigatório
   e único, `data_inicio`/`data_fim`, status) → Repository insere → Redirect para
   lista de eventos.
2. **Cadastro de jogador no evento** → Controller valida (evento existe e permite
   adição) → Service trata regra (nome obrigatório) → Repository insere jogador com
   `evento_id` → Redirect para lista de jogadores do evento.
3. **Sorteio de adversário** → ao registrar o vencedor de uma partida, `SorteioService`
   lê os jogadores do evento (Repository, filtro `evento_id`) → exclui o vencedor e,
   quando possível, jogadores com partida recente contra ele → sorteia o próximo
   adversário → View sugere o confronto.
4. **Registro de partida** → Controller valida (evento existe e não encerrado,
   jogadores existem, diferentes, são do mesmo evento, vencedor ∈ {jogador_a,
   jogador_b}) → Service abre transação, insere partida → Redirect para o ranking
   do evento (ou para novo sorteio).
5. **Ranking por evento** → Controller chama RankingService → Service lê partidas
   do evento (Repository, filtro `evento_id`) → calcula estatísticas para todos os
   jogadores do evento → ordena (V → D → desempate final) → View renderiza tabela.

---

## 7. Modelagem de Dados

### 7.1 Entidades e relacionamentos

- **eventos** (1) ──< (N) **jogadores** (cada jogador pertence a um único evento)
- **eventos** (1) ──< (N) **partidas** (toda partida pertence a um evento)
- **jogadores** (1) ──< (N) **partidas** como *jogador_a*
- **jogadores** (1) ──< (N) **partidas** como *jogador_b*
- **jogadores** (1) ──< (N) **partidas** como *vencedor*

> O vencedor é uma referência adicional ao jogador (FK), garantindo integridade.
> A partida é a entidade de ligação entre dois jogadores **dentro de um evento**.
> **Modelo confirmado (Q18)**: cadastro por evento — cada `jogador` tem FK
> `evento_id` e pertence a um único evento; não existe tabela `evento_jogadores`.
> Ver justificativa e caveat na seção 7.4.

### 7.2 Esquema sugerido (SQL)

```sql
CREATE TABLE eventos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL,                     -- nome único (Q8)
    data_inicio   TEXT NOT NULL,                     -- início do torneio (Q13/Q14)
    data_fim      TEXT,                              -- fim do torneio (vários dias)
    descricao     TEXT,
    status        TEXT NOT NULL DEFAULT 'planejado', -- planejado / em andamento / encerrado
    criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    atualizado_em TEXT
);

-- Nome único de evento (decisão Q8)
CREATE UNIQUE INDEX idx_eventos_nome ON eventos (nome COLLATE NOCASE);

CREATE TABLE jogadores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id   INTEGER NOT NULL,                    -- jogador pertence a um único evento (Q18)
    nome        TEXT NOT NULL,
    apelido     TEXT,
    telefone    TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,          -- 1 ativo / 0 inativo
    criado_em   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    atualizado_em TEXT,
    FOREIGN KEY (evento_id) REFERENCES eventos (id)
);

CREATE INDEX idx_jogadores_evento ON jogadores (evento_id);

CREATE TABLE partidas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id    INTEGER NOT NULL,
    jogador_a_id INTEGER NOT NULL,
    jogador_b_id INTEGER NOT NULL,
    vencedor_id  INTEGER NOT NULL,
    data_partida TEXT NOT NULL DEFAULT (date('now','localtime')),
    observacao   TEXT,
    criado_em    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (evento_id)    REFERENCES eventos (id),
    FOREIGN KEY (jogador_a_id) REFERENCES jogadores (id),
    FOREIGN KEY (jogador_b_id) REFERENCES jogadores (id),
    FOREIGN KEY (vencedor_id)  REFERENCES jogadores (id),
    CHECK (jogador_a_id <> jogador_b_id),               -- não pode jogar contra si
    CHECK (vencedor_id IN (jogador_a_id, jogador_b_id))
);

CREATE INDEX idx_partidas_evento ON partidas (evento_id);
CREATE INDEX idx_partidas_a     ON partidas (jogador_a_id);
CREATE INDEX idx_partidas_b     ON partidas (jogador_b_id);
CREATE INDEX idx_partidas_venc  ON partidas (vencedor_id);
CREATE INDEX idx_partidas_data  ON partidas (data_partida);
```

> Habilitar `PRAGMA foreign_keys = ON` na conexão.
> As constraints de `CHECK` e as FKs garantem integridade no nível do banco.
> A validação de "os dois jogadores da partida pertencem ao evento da partida" não é
> expressável como constraint simples no SQLite; deve ser feita na **camada de
> serviço** (RF-21).

### 7.3 Decisão sobre o ranking

- O ranking é **derivado** e **por evento**: calculado a partir das partidas de
  um `evento_id` específico a cada requisição. Para volumes pequenos (cenário de
  bar), o cálculo em memória é trivial e evita inconsistência de dados
  desnormalizados.
- Todos os **jogadores do evento** entram no ranking (inclusive com 0 jogos — Q3).
- Se no futuro o volume crescer, pode-se criar uma tabela `estatisticas_jogador`
  (por jogador + evento) ou cache, mas **não é necessário na v1**.

### 7.4 Decisão de modelagem: cadastro por evento (confirmado pelo usuário — Q18)

**Decisão adotada:** **cadastro por evento**. Cada evento possui sua própria lista de
jogadores; a tabela `jogadores` tem FK `evento_id` e cada jogador pertence a um
**único evento**. Não existe cadastro global nem tabela `evento_jogadores`.

**Por quê (motivação do usuário):**
1. **Simplicidade operacional**: quem organiza o bar/campeonato pensa em "jogadores
   daquele evento"; não há etapa de "associar jogador global a evento".
2. **Isolamento por evento**: cada evento é autossuficiente — sua lista de jogadores,
   partidas e ranking independem de qualquer outro evento.
3. **Menos telas e menos regras**: elimina a tela/regra de associação
   (`evento_jogadores`), reduzindo o escopo da v1.

**Caveat (registrado, decisão consciente do usuário):**
- Um mesmo jogador que participa de eventos diferentes será **cadastrado em cada
  evento** (duplicidade de registro por nome).
- O futuro **ranking entre eventos** será **menos confiável**: exigirá o **casamento
  de jogadores por nome** entre eventos distintos, o que pode gerar falsos positivos
  (homônimos) ou perdas de vínculo (nomes digitados diferentes).
- Essa limitação é **aceita pelo usuário**, priorizando a simplicidade da v1.

**Alternativa descartada (após reconfirmação do usuário):** jogadores globais +
tabela `evento_jogadores` (N:N). Facilitaria o ranking entre eventos, mas adiciona
complexidade de associação que o usuário preferiu não ter na v1.

---

## 8. Stack Tecnológica

### 8.1 Stack recomendada (confirmada)

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Runtime | **Node.js** (LTS) | Equipe familiarizada; ecossistema leve. |
| Framework HTTP | **Express** | Padrão de mercado, middleware, roteamento simples. |
| Banco de dados | **SQLite** (via **better-sqlite3**) | Arquivo único, sem instalação de SGBD; síncrono e rápido para baixo volume; suporte nativo a FKs e transações. |
| View Engine | **EJS** | Simples, server-side, combina bem com Bootstrap. |
| CSS/UI | **Bootstrap 5** (via CDN ou pacote local) | Responsivo sem esforço; componentes prontos (tabelas, forms, alerts). |
| Validação | **express-validator** | Validação de entrada padronizada no servidor. |
| Testes | **Vitest** (ou `node:test`) | Leve, rápido, integração simples; cobre serviços e rotas. |
| Controle de versão | **Git + GitHub** | Histórico, colaboração e revisão. |

### 8.2 Justificativa da stack

1. **SQLite** é ideal para este domínio: dados relacionais simples (jogadores,
   partidas), volume pequeno, necessidade de portabilidade e backup simples.
2. **EJS + Bootstrap** atendem à exigência de boa experiência do usuário com baixo
   custo de desenvolvimento — não há necessidade de SPA/framework front-end para
   uma aplicação operacional de poucas telas.
3. **better-sqlite3** é recomendado sobre `sqlite3` (callback) por sua API síncrona
   e segura, reduzindo complexidade de código.
4. **Camadas (controller/service/repository)** garantem manutenção simples e testes
   focados nas regras de negócio (ranking, validação de partidas).
5. **Vitest** foi escolhido por ser moderno, rápido e compatível com ESM/CJS sem
   configuração complexa — alternativa: `node:test` (sem dependência extra).

---

## 9. Plano de Desenvolvimento em Fases

Estimativa por tarefa em **horas** (orientação; ajustar conforme disponibilidade).
Prioridade: **A** = alta, **M** = média, **B** = baixa.
As questões em aberto foram respondidas (seção 11) — as fases abaixo já refletem as
decisões confirmadas.

### Fase 0 — Setup e infraestrutura

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 0.1 | `npm init`, instalar dependências (express, better-sqlite3, ejs, express-validator, bootstrap, vitest, nodemon, dotenv). | A | 1 h |
| 0.2 | Estrutura de pastas (src, controllers, services, repositories, views, test). | A | 0.5 h |
| 0.3 | `app.js` (Express) + `server.js` + error handler + rotas base (health check). | A | 1 h |
| 0.4 | Git init + .gitignore (node_modules, .env, db/*.db) + README básico. | A | 0.5 h |
| 0.5 | Criação do banco + PRAGMA foreign_keys + schema inicial via script/migration (eventos, jogadores com FK `evento_id`, partidas). | A | 1 h |

### Fase 1 — Eventos (CRUD + status)

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 1.1 | Repositório de eventos (listar, criar, buscar por id, atualizar, excluir). | A | 2 h |
| 1.2 | Serviço de eventos (validações: nome obrigatório/único, `data_inicio`/`data_fim`, transições de status, exclusão bloqueada com partidas). | A | 2 h |
| 1.3 | Controller + rotas de eventos (GET listar, GET detalhe, GET formulário, POST criar/editar/excluir). | A | 2 h |
| 1.4 | Views: listagem de eventos + formulário (Bootstrap), mensagens de sucesso/erro. | A | 3 h |
| 1.5 | View de detalhe do evento (dashboard: dados do evento, status, atalho para jogadores, partidas/sorteio e ranking). | A | 3 h |
| 1.6 | Validação de entrada (express-validator) para evento e transições de status. | M | 1 h |

### Fase 2 — Jogadores por evento

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 2.1 | Repositório de jogadores (listar por evento, criar, buscar por id, atualizar, excluir). | A | 2 h |
| 2.2 | Serviço de jogadores (validações, regra de adição por status do evento, exclusão bloqueada com partidas). | A | 2 h |
| 2.3 | Controller + rotas de jogadores do evento (GET listar, GET formulário, POST criar, POST editar, POST excluir). | A | 2 h |
| 2.4 | Views: listagem + formulário de jogadores do evento (Bootstrap), mensagens de sucesso/erro. | A | 3 h |
| 2.5 | Validação de entrada (express-validator) para jogador. | M | 1 h |

### Fase 3 — Partidas (registro e histórico, por evento)

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 3.1 | Repositório de partidas (listar por evento com join jogadores, buscar, inserir, atualizar, excluir). | A | 2 h |
| 3.2 | Serviço de partidas: validações (evento existe e não encerrado, jogadores existem, diferentes, do mesmo evento, vencedor ∈ {a, b}) + transação. | A | 4 h |
| 3.3 | Controller + rotas de partidas (lista por evento, formulário, criar, editar, excluir). | A | 2 h |
| 3.4 | Views: histórico de partidas do evento + formulário com selects de jogadores e vencedor. | A | 3 h |
| 3.5 | Confronto direto entre dois jogadores (visão detalhe, dentro do evento). | M | 2 h |

### Fase 4 — Sorteio automático de confrontos ("vencedor permanece na mesa")

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 4.1 | `SorteioService`: candidatos = jogadores do evento; priorizar quem ainda não tem partida registrada com o vencedor; excluir o vencedor; escolher aleatoriamente entre elegíveis. | A | 4 h |
| 4.2 | Regra de "fila": jogadores há mais tempo sem jogar têm prioridade; fallback quando todos já jogaram com o vencedor. | A | 2 h |
| 4.3 | Integração com o fluxo de registro de partida: após informar o vencedor, exibir a sugestão de próximo adversário (aceitar ou escolher manualmente). | A | 3 h |
| 4.4 | View/componente de sugestão de confronto (próxima partida) no dashboard do evento e no formulário de partidas. | A | 2 h |
| 4.5 | Validação: o sorteio nunca sugere o próprio vencedor e respeita apenas os jogadores do evento. | M | 1 h |

### Fase 5 — Ranking e estatísticas (por evento)

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 5.1 | `RankingService`: agregação por evento (filtro `evento_id`) de jogos/vitórias/derrotas, aproveitamento, confrontos; inclui todos os jogadores do evento (0 jogos). | A | 4 h |
| 5.2 | Regra de ordenação e desempate (V → D → desempate final por ordem de cadastro/nome). | A | 2 h |
| 5.3 | Controller + rota + view do ranking do evento (tabela com badges de posição e "sem jogos"). | A | 3 h |
| 5.4 | Detalhe por jogador no evento (campanha completa: de quem ganhou / para quem perdeu). | M | 3 h |

### Fase 6 — Interface, UX e polimento

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 6.1 | Layout base (navbar, container responsivo, partials EJS). | M | 2 h |
| 6.2 | Navegação entre telas (dashboard de eventos → evento → jogadores → partidas/sorteio → ranking). | M | 2 h |
| 6.3 | Ajustes de usabilidade mobile (ordem dos campos, toques de tela). | B | 2 h |
| 6.4 | Feedback ao usuário (toasts/alertas, confirmações de exclusão e edição de partidas). | M | 2 h |

### Fase 7 — Testes e validação

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 7.1 | Testes unitários do `RankingService` por evento (cenários: empate de vitórias, jogador sem jogos, desempate, isolamento entre eventos). | A | 4 h |
| 7.2 | Testes unitários do `PartidaService` (validações incl. jogadores do mesmo evento, transação, bloqueio em evento encerrado). | A | 3 h |
| 7.3 | Testes unitários do `SorteioService` (nunca sugere o vencedor, prioriza quem não jogou com o vencedor, randomização com seed, isolamento entre eventos). | A | 3 h |
| 7.4 | Testes unitários do `EventoService`/jogadores (CRUD, unicidade de nome, transições de status, exclusão bloqueada com partidas). | A | 2 h |
| 7.5 | Testes de integração das rotas (evento, jogador, partida e sorteio) com banco temporário. | M | 4 h |
| 7.6 | Verificação manual (checklist) das regras de negócio em todas as telas. | A | 2 h |

### Fase 8 — Evoluções (opcionais, após a v1)

| # | Tarefa | Prioridade | Estimativa |
|---|--------|-----------|-----------|
| 8.1 | **Ranking entre eventos** (comparação/agregação de campanhas; exigirá casamento de jogadores por nome). | B | 8 h |
| 8.2 | Múltiplas mesas (entidade mesas). | B | 5 h |
| 8.3 | Controle de sessão de mesa (quem está na mesa, fila de espera). | B | 4 h |
| 8.4 | Filtro de ranking por período (hoje, semana, mês, total). | B | 2 h |
| 8.5 | Registro de placar/pontos por partida. | B | 2 h |

### 9.1 Ordem de execução e dependências

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7
   ↑          ↑         ↑         ↑         ↑         ↑         ↑
   └──── dependências lineares (cada fase só inicia com a anterior estável)
Fase 8 (paralela/opcional após Fase 7)
```

- **Fase 0** é pré-requisito de tudo.
- **Fase 1** (eventos + status) cria o contexto de tudo: jogadores, partidas e
  ranking são por evento.
- **Fase 2** (jogadores por evento) depende de **Fase 1** (jogadores têm FK
  `evento_id`) e é pré-requisito das **Fases 3 e 4**.
- **Fase 3** (partidas) depende das **Fases 1 e 2**.
- **Fase 4** (sorteio) depende das **Fases 2 e 3** (usa os jogadores do evento e o
  histórico de partidas para sugerir o próximo adversário).
- **Fase 5** (ranking por evento) depende de **Fase 3** e pode ser parcialmente
  paralelizada com a Fase 4.
- **Fases 6 e 7** podem ser parcialmente paralelizadas com as fases anteriores.

### 9.2 Estimativa total

| Fase | Estimativa |
|------|-----------|
| F0 Setup | ~4 h |
| F1 Eventos (CRUD + status) | ~13 h |
| F2 Jogadores por evento | ~10 h |
| F3 Partidas + histórico | ~13 h |
| F4 Sorteio automático de confrontos | ~12 h |
| F5 Ranking por evento | ~12 h |
| F6 UX | ~8 h |
| F7 Testes | ~18 h |
| **Total (núcleo v1)** | **~90 h** |
| F8 Evoluções (opcional) | ~21 h |

> Estimativa aproximada para 1 desenvolvedor. Com testes, revisão e ajustes,
> planejar o núcleo em torno de 4 semanas (dedicação parcial).

---

## 10. Estratégia de Testes e Verificação

1. **Unitários (services)** — foco principal:
   - `EventoService`: CRUD de evento, unicidade de nome, validação de
     `data_inicio`/`data_fim`, transições de status, exclusão **bloqueada** com
     partidas.
   - `JogadorService`: adicionar/editar/excluir jogador **por evento**, bloqueio de
     exclusão com partidas, bloqueio de adição em evento encerrado.
   - `PartidaService`: rejeição de jogador contra si mesmo, vencedor fora da
     partida, jogador inexistente, **jogador de outro evento**, evento encerrado.
   - `SorteioService`: **nunca sugere o vencedor**, prioriza candidatos **sem
     partida registrada com o vencedor** quando possível (não repete o adversário
     recém-jogado), fallback quando todos já jogaram com o vencedor, randomização
     determinística com seed, **isolamento entre eventos** (só considera jogadores
     do evento do vencedor).
   - `RankingService`: ordenação correta (V → D → desempate final), jogador com
     0 jogos no final, aproveitamento percentual e **isolamento entre eventos**
     (partidas de um evento não afetam o ranking de outro).
2. **Integração (rotas + banco temporário)** — fluxo completo: criar evento →
   cadastrar jogadores no evento → registrar partida → obter sugestão de próximo
   adversário → consultar ranking do evento. Banco SQLite em memória (`:memory:`)
   ou arquivo temporário por suíte.
3. **Validação manual (checklist operacional)**:
   - Cadastrar 2 eventos com jogadores diferentes e confirmar **isolamento total**
     entre eles (listas, partidas, sorteio e ranking independentes).
   - Cadastrar 4+ jogadores em um evento e registrar partidas simulando "vencedor
     permanece na mesa", aceitando a sugestão do sorteio.
   - Conferir que o ranking lista jogadores sem partidas com 0 jogos no final.
   - Testar o bloqueio de partidas em evento **encerrado** e o bloqueio de exclusão
     de jogador/evento com histórico.
   - Testar mobile (tela pequena).
4. **Verificação de integridade**: `PRAGMA foreign_keys`, testes de exclusão de
   jogador/evento com histórico (deve bloquear), CHECK de `jogador_a ≠ jogador_b`
   e `vencedor ∈ {a, b}`.
5. **Critério de aceite da Fase 5 (ranking)**: o ranking por evento computado pelo
   sistema deve reproduzir exatamente o cálculo manual de um cenário conhecido (ex.:
   fixture com 4 jogadores e 6 partidas em um evento).
6. **Critério de aceite da Fase 4 (sorteio)**: dado um vencedor com partida
   registrada contra um adversário, o sorteio **não repete esse adversário** quando
   existirem outros candidatos elegíveis no evento; com seed fixa, o resultado deve
   ser estável para teste.

---

## 11. Decisões Confirmadas pelo Usuário

Todas as questões em aberto foram **respondidas pelo usuário**. As respostas abaixo
são vinculantes e já estão refletidas nas seções 3 (RF), 5 (regras de negócio),
7 (modelagem), 9 (fases) e 10 (testes).

| # | Pergunta | Decisão confirmada |
|---|----------|--------------------|
| Q1 | Pode haver **empate** em uma partida? | **Sem empate** — toda partida tem apenas vencedor. |
| Q2 | Qual o **critério de desempate** no ranking? | Apenas **Vitórias → Derrotas**. Não usar aproveitamento nem confronto direto. Desempate final restante: **ordem de cadastro** (ex.: nome/ordem de cadastro). |
| Q3 | Jogadores **sem partidas** aparecem no ranking? | **Sim** — aparecem no final, com **0 jogos**. |
| Q4 | O sistema deve **sortear** a ordem dos confrontos automaticamente? | **Sim** — sorteio automático de confrontos é funcionalidade **central da v1**: ao informar partida e vencedor, o sistema **sugere o próximo adversário** sorteado entre os demais jogadores do evento, preferencialmente os que estão "na fila" / sem partida pendente com o vencedor. |
| Q5 | Permitir **editar/excluir** partidas já registradas? | **Sim, com confirmação**. |
| Q6 | Ao **excluir jogador** com histórico, o que acontece com as partidas? | **Bloquear exclusão** de jogador com histórico. |
| Q7 | O sistema controla **múltiplas mesas** simultâneas? | Não na v1 (uma única mesa); evolução futura. |
| Q8 | Registrar **placar/pontos** por partida? | Não na v1 (apenas vencedor); evolução futura. |
| Q9 | O ranking é **cumulativo** ou por período? | Cumulativo dentro do evento; filtro por período como evolução. |
| Q10 | O sistema precisa de **autenticação** (login de administrador)? | Não na v1 (uso local/social). |
| Q11 | Há limite de **número de jogadores** em uma sessão? | Sem limite na v1. |
| Q12 | O "vencedor continua na mesa" deve ser **controlado pelo sistema**? | **Sim, com sorteio automático** do próximo adversário (ver Q4); o registro da sessão/fila em si (quem está sentado) fica como evolução. |
| Q13 | Um **evento** representa o quê exatamente? | **Torneio com vários dias** — evento tem `data_inicio` e `data_fim`. |
| Q14 | O evento deve ter **nome** e **data** obrigatórios? Nome único? | **Nome e data obrigatórios**; **nome único**. |
| Q15 | Um evento tem **status** e isso bloqueia partidas? | **Sim** — status `planejado` / `em andamento` / `encerrado`, **bloqueando partidas** quando `encerrado`. |
| Q16 | Pode-se **adicionar/remover jogador** de um evento já iniciado/encerrado? | **Adicionar enquanto em andamento**; **remover apenas sem partidas** no evento (bloquear remoção com histórico). |
| Q17 | Ao **excluir evento** com partidas/participações, o que acontece? | **Bloquear exclusão** de evento com partidas. |
| Q18 | Confirma-se o modelo de jogadores? | **Cadastro por evento** — cada evento tem sua própria lista de jogadores (tabela `jogadores` com FK `evento_id`). **Não** usar jogadores globais + `evento_jogadores`. |

> **Caveat registrado (Q18):** o usuário reconfirmou o **cadastro por evento** mesmo
> ciente de que o futuro ranking entre eventos será menos confiável (exigirá o
> **casamento de jogadores por nome**). Essa decisão e seus impactos estão
> detalhados na seção 7.4.

---

## 12. Próximos Passos

1. ✅ **Questões em aberto respondidas** (Q1–Q18 — ver seção 11). O plano está
   **pronto para execução**; não há mais premissas pendentes de validação.
2. ✅ Modelagem definida: **cadastro por evento** (jogadores com FK `evento_id`) e
   **sorteio automático de confrontos** como funcionalidade central da v1.
3. **Iniciar a Fase 0** (setup e infraestrutura) — pré-requisito de todas as fases.
4. Após cada fase, revisar código e executar os testes da fase correspondente.
5. Revisar (via revisor) os marcos principais: modelagem (F0), eventos (F1),
   sorteio (F4) e ranking (F5).

---

*Fim do documento.*
