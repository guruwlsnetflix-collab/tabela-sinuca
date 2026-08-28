# Módulo de Torneios

O **tabela-sinuca** conta com um módulo de **torneios de sinuca** (eliminatórias
no estilo *mata-mata*), isolado do sistema existente de eventos, jogadores e
partidas de ranking.

- Chave fixa de **16 jogadores** (oitavas de final → quartas → semifinais → final).
- Confrontos das **oitavas, quartas e semifinais** são disputados em **melhor de 3**
  (quem vencer 2 partidas avança).
- A **final** é disputada em **melhor de 5** (quem vencer 3 partidas é campeão).
- O vencedor de cada confronto avança **automaticamente** para o confronto seguinte
  (chave fixa, sem chaveamento dinâmico).
- **Painel público (TV/telão)** com atualização automática a cada 15 segundos e
  **API JSON** para integração (placar eletrônico, apps externas, atualizações via JS).

## Regras de negócio

### Status do torneio

| Status              | Descrição                                                     |
|---------------------|---------------------------------------------------------------|
| `cadastro_jogadores`| Estado inicial. Jogadores podem ser cadastrados/editados.     |
| `sorteado`          | Sorteio realizado; a chave foi montada. Alterações bloqueadas.|
| `em_andamento`      | Torneio iniciado; partidas podem ser registradas.             |
| `finalizado`        | Última partida da final registrada; campeão definido.         |
| `cancelado`         | Torneio cancelado (não pode cancelar o já finalizado).        |

### Fluxo principal

1. **Criar o torneio** (`POST /torneios`) — informar nome, data (e opcionais local,
   previsão de término e modalidade Par/Ímpar).
2. **Cadastrar os 16 jogadores** (`POST /torneios/:id/jogadores`) — o 17º é bloqueado.
3. **Sortear** (`POST /torneios/:id/sortear`) — embaralha os jogadores, atribui
   posições 1–16 e monta os 15 confrontos:

   | Fase        | Confrontos | Partidas p/ avançar |
   |-------------|------------|---------------------|
   | Oitavas     | 1–8        | 2 (melhor de 3)     |
   | Quartas     | 9–12       | 2 (melhor de 3)     |
   | Semifinais  | 13–14      | 2 (melhor de 3)     |
   | Final       | 15         | 3 (melhor de 5)     |

   É possível **refazer o sorteio** enquanto nenhuma partida tiver sido registrada.
4. **Iniciar** (`POST /torneios/:id/iniciar`) — só após o sorteio, com 16 jogadores.
5. **Registrar partidas** (`POST /torneios/:id/confrontos/:confrontoId/partidas`).
   O confronto só aceita partidas quando possui os dois jogadores definidos e o
   placar não atingiu o número de vitórias necessário. Ao atingir, o confronto é
   finalizado e o vencedor avança automaticamente.
6. **Finalizar**: registrar a 3ª vitória da final define o campeão e finaliza o torneio.

### Correções e bloqueios

- **Desfazer última partida** (`POST .../confrontos/:confrontoId/desfazer`): reverte o
  placar, remove a partida, reabre o confronto e retira o vencedor do confronto
  seguinte (o desfazer é bloqueado se o confronto seguinte já tiver partidas).
- **Edições bloqueadas após o sorteio**: editar o torneio, cadastrar/editar/excluir
  jogadores e refazer o sorteio são proibidos depois que o sorteio acontece ou que
  o torneio iniciou.
- **Excluir torneio** só é permitido sem partidas registradas.

## Estrutura de dados

Banco SQLite (`src/db/schema.sql`). As tabelas de torneio são **independentes** das
tabelas `eventos`/`jogadores`/`partidas` — não interferem no ranking.

| Tabela                | Descrição                                            |
|-----------------------|------------------------------------------------------|
| `torneios`            | Dados do torneio + status + `vencedor_id` (ON DELETE SET NULL). |
| `torneio_jogadores`   | Jogadores inscritos, com `posicao` (1–16 pós-sorteio). |
| `torneio_confrontos`  | Confrontos 1–15 com fase, `vitorias_necessarias`, placares e status. |
| `torneio_partidas`    | Partidas de cada confronto (número sequencial + vencedor). |

## Rotas

### Páginas

| Método | Rota                                                   | Ação                          |
|--------|--------------------------------------------------------|-------------------------------|
| GET    | `/torneios`                                            | Listagem                      |
| GET    | `/torneios/novo`                                       | Formulário de criação         |
| POST   | `/torneios`                                            | Criar torneio                 |
| GET    | `/torneios/:id`                                        | Detalhe / painel administrativo (chave completa) |
| GET    | `/torneios/:id/editar` · POST `/torneios/:id`          | Editar torneio                |
| POST   | `/torneios/:id/cancelar` · `/torneios/:id/excluir`     | Cancelar / excluir            |
| GET    | `/torneios/:id/jogadores/novo` · POST `/torneios/:id/jogadores` | Cadastrar jogador   |
| GET    | `/torneios/:id/jogadores/:jogadorId/editar` · POST `/...` | Editar jogador              |
| POST   | `/torneios/:id/jogadores/:jogadorId/excluir`           | Remover jogador               |
| POST   | `/torneios/:id/sortear` · `/torneios/:id/iniciar`      | Sortear / iniciar             |
| POST   | `/torneios/:id/confrontos/:confrontoId/iniciar`        | Iniciar confronto             |
| POST   | `/torneios/:id/confrontos/:confrontoId/partidas`       | Registrar partida             |
| POST   | `/torneios/:id/confrontos/:confrontoId/desfazer`       | Desfazer última partida       |
| GET    | `/torneios/:id/painel`                                 | Painel público (TV)           |

### API JSON (somente leitura)

| Método | Rota                     | Retorno                                   |
|--------|--------------------------|-------------------------------------------|
| GET    | `/api/torneios`          | Lista resumida de torneios                |
| GET    | `/api/torneios/:id`      | Estado completo (torneio, fases, confrontos, próximos, fase atual) |
| GET    | `/api/torneios/:id/painel` | Sinônimo de `/api/torneios/:id` (usá-lo em painéis externos) |

Formato dos confrontos na API:

```json
{
  "id": 1,
  "numero": 1,
  "fase": "oitavas",
  "status": "em_andamento",
  "jogador_a": "Jogador 07",
  "jogador_b": "Jogador 03",
  "vencedor": null,
  "placar_a": 1,
  "placar_b": 0,
  "vitorias_necessarias": 2,
  "preparado": true,
  "partidas_realizadas": 1
}
```

Erros são retornados com `{ "erro": "mensagem" }` e o status HTTP correspondente
(ex.: `404` para torneio inexistente).

## Painel TV

`GET /torneios/:id/painel` renderiza uma página **standalone** (sem o layout do app):

- Tema escuro com tipografia ampla, otimizado para telão/televisão.
- Exibe a chave completa em colunas (oitavas → quartas → semifinais → final).
- Destaques visuais: confronto **AO VIVO** e o **PRÓXIMO** confronto da rodada.
- **Auto-refresh** via `<meta http-equiv="refresh" content="15">`.
- Responsivo: em telas até ~1100px vira lista vertical com rolagem discreta.

> Dica: para usar o painel em um TV, abra a URL em modo de tela cheia
> (`F11`) no navegador do aparelho. O painel não requer login.

## Arquivos do módulo

| Arquivo                          | Responsabilidade                              |
|----------------------------------|-----------------------------------------------|
| `src/db/schema.sql`              | Tabelas `torneios`, `torneio_jogadores`, `torneio_confrontos`, `torneio_partidas`. |
| `src/repositories/torneioRepository.js` | CRUD de torneios e jogadores.           |
| `src/repositories/confrontoRepository.js` | CRUD de confrontos e partidas.      |
| `src/services/torneioService.js` | Regras de negócio: sorteio, avanço, validações, estado das views e `TAMANHO_CHAVE=16`. |
| `src/validators/torneioValidator.js` | Validações `express-validator`.        |
| `src/routes/torneios.js`         | Rotas de página (CRUD + painel).             |
| `src/routes/apiTorneios.js`      | Rotas API JSON de leitura.                   |
| `src/views/pages/torneios/*.ejs` | Telas: listagem, formulários, detalhe e painel. |
| `public/css/torneio.css`         | Estilo administrativo da chave.              |
| `public/css/painel.css`          | Estilo do painel TV.                         |
| `tests/torneio.test.js`          | Testes de serviço, rotas e API.              |

## Como testar

```bash
npm test                       # suíte completa (vitest)
npm run dev                    # servidor de desenvolvimento
```

Fluxo manual: criar torneio → cadastrar 16 jogadores → sortear → iniciar →
registrar as partidas dos confrontos (o vencedor avança sozinho) → registrar a
final → abrir `/torneios/:id/painel` para ver o campeão no telão.

A suíte cobre: cadastro e bloqueios, sorteio, avanço automático, melhor de 3/5,
desfazer partida (inclusive na final), regras de transição de estado, rotas HTTP
e a API JSON.