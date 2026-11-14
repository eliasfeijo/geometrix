# Status atual

**Atualizado:** 2026-11-14 · **Marco:** M1 — O ciclo da riqueza · **Fase:** F7 (cliente) em preparação, branch `m1/f7-client`

Resumo de bolso. A fonte de verdade continua nos docs linkados. Atualize este arquivo ao fechar uma fase, ao passar
por um portão de aprovação ou quando surgir um bloqueio.

## Onde estamos

| Etapa | Status | Onde ver |
|---|---|---|
| M0 — Design | ✅ Concluído. Pilares, GDD (com propostas e perguntas abertas por sistema), ADRs 0001–0005 `Accepted` | [PILLARS](../PILLARS.md) · [GDD](../gdd/README.md) · [ADRs](../adr/README.md) |
| M1 — spec | ✅ Aprovada (2026-11-13). Decisões de escopo D1–D10 | [spec.md](../specs/m1-ciclo-da-riqueza/spec.md) |
| M1 — plan | ✅ Aprovado (2026-11-13), com P1–P6 decididas | [plan.md](../specs/m1-ciclo-da-riqueza/plan.md) |
| M1 — F0 Bootstrap | ✅ Concluída, merge em `main`. Workspaces, TS strict, ESLint com as regras de determinismo, Vitest, CI | [tasks.md §F0](../specs/m1-ciclo-da-riqueza/tasks.md) |
| M1 — F1 Núcleo do sim | ✅ Concluída, merge em `main`. RNG, params, mapa simétrico, `WorldState`, serialize/restore, `step` vazio, `geo verify` no CI | [tasks.md §F1](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/` |
| M1 — F2 Movimento | ✅ Concluída, merge em `main`. Pontos de movimento em ‰, A* com cache, ordens `moveTo`/`stop` no pipeline | [tasks.md §F2](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{movement,pathfinding,orders}.ts` |
| M1 — F3 Economia | ✅ Concluída, merge em `main`. Ordens `gather`/`deliver`/`buildRoad`, regeneração, produção com "repetir", upgrade de capacidade. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F3](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{economy,production,roads,orders}.ts` |
| M1 — F4 Piloto automático e domínio | ✅ Concluída, merge em `main`. Vocabulário de comandos + `validate`, jogadores, domínio D-1..D-4, interpretador de regras, presets, `setRules`/`applyPreset`. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F4](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{commands,domination,autopilot,presets,rules}.ts` |
| M1 — F5 Harness | ✅ Concluída, merge em `main`. Checkpoint revisado pelo dono (2026-11-13): a economia precisa de balanceamento. Stats + `sampleMetrics`, estrategista `balanced`, `geo sim`/`report`/`sweep`, `geo verify` com bots e replay do log, orçamento de 6 h no CI. Detalhes decididos pelo dono no [plan §9](../specs/m1-ciclo-da-riqueza/plan.md) | [tasks.md §F5](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/cli/src/` · `packages/sim/src/stats.ts` |
| M1 — Balanceamento 1 | ✅ Decidido pelo dono (2026-11-14): candidato B no `params/default.json` provisório; DNAs economicamente equivalentes de propósito; playtest humano e deploy saem do M1. Assimetria entre os times corrigida (desempate do A*). Na branch `m1/f6-server` | [balance.md](../specs/m1-ciclo-da-riqueza/balance.md) |
| M1 — F6 Servidor | ✅ Concluída, merge em `main`. SQLite (log de comandos, snapshots, métricas), loop de tick com multiplicador, HTTP (criar, listar, entrar), WebSocket com ack/reject e broadcast ≤5/s, `release` automático, bots e limite de humanos, recuperação após restart. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F6](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/server/src/` · `packages/protocol/src/` |
| M1 — F7, F8 | ⬜ Pendentes; o F7 é o próximo. Checkpoint do F7: sessão do dono (interface e legibilidade). O M1 fecha com o critério da [spec §8](../specs/m1-ciclo-da-riqueza/spec.md) | [plan.md §13](../specs/m1-ciclo-da-riqueza/plan.md) |
| ~~M1 — F9~~ | Deploy e playtest comprimido saíram do M1 (dono, 2026-11-14): abrem o M2 | [ROADMAP](../ROADMAP.md) |
| M2–M4 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Próximos passos imediatos

1. **Publicar o repo no GitHub** (dono). Ainda não há remote, então o CI ([ci.yml](../../.github/workflows/ci.yml))
   nunca rodou fora da máquina local.
2. **F7 (cliente):** branch `m1/f7-client`. Ela já tem a decisão da coleta com depósitos zerados (dono,
   2026-11-14, [GDD 07](../gdd/07-piloto-automatico.md)): o creep fica com o depósito escolhido até encher e espera
   a regeneração ali (`SIM_VERSION` 2). No fim de jogo, a maioria dos creeps fica parada em volta dos depósitos,
   com o anel de carga enchendo devagar: o cliente deve mostrar isso como espera, não como travamento. O que o F7
   precisa saber do servidor:
   - `npm run server` sobe em `http://localhost:8080` e serve `apps/client/dist` como estáticos. Variáveis:
     `GEO_PORT`, `GEO_DB` (padrão `data/geometrix.db`, ignorado pelo git), `GEO_PARAMS` (padrão
     `params/default.json`), `GEO_STATIC`. O dev server do Vite precisa de proxy para `/api` e `/ws`.
   - **HTTP:** `POST /api/worlds` `{seed?, multiplier?, botTeams?}` → `201 {id}`; `GET /api/worlds` →
     `WorldSummary[]`; `POST /api/worlds/:id/join` `{name, team}` → `201 {playerId, team, token}`, ou `409
     {error: "teamFull" | ...}`. Erros sempre como `{error}`.
   - **WebSocket** `/ws?token=...`: o servidor manda `welcome` (params, mapa estático, Núcleos e o estado
     dinâmico) e depois `state {state, status}` no máximo 5 vezes por segundo. O cliente manda `{type: "command",
     ref, command}` e recebe `ack {ref, tick}` ou `reject {ref, reason}`. Token inválido fecha com 4401; mundo não
     hospedado, com 4404. Tipos e validação (zod) em `@geometrix/protocol`.
   - O token é a única credencial: guardado no cliente, reconecta o mesmo jogador. O `join` entra no tick
     seguinte, então logo após o `welcome` o jogador pode ainda não estar em `state.players`.
   - O estado dinâmico vai inteiro em cada mensagem: creeps sem `path`, estradas como índices de célula.
   - **Medições do F6:** mensagem de estado com 6,7 KB (12 creeps), 13,7 KB (28) e 26,9 KB (60). Tick + commit no
     SQLite: 0,08 ms no ext4 e 1,7 ms no `/mnt/c` (WSL), contra 28 ms por tick no ×36. 3 dias bot×bot do seed 42
     com o `default.json` atual: 12,1 s; com a coleta que espera a regeneração, 3,9 s.
   - **Efeito da coleta que espera** (3 dias bot×bot, seeds 42, 1 e 2): viagem média de 61–69 para 22–28 células;
     andando vazio de 22–34% para 13–19%; parado (inclui esperar no depósito) de 1% para 52–66%; todos os 12
     depósitos de matéria são usados; matéria entregue +16 a +28%.

## Pendências e pontos a esclarecer

- **Interpretações do F6 a validar** (o plan não fixa):
  - a recuperação restaura o último snapshot e reaplica os comandos do log com `tick >=` o do snapshot até o
    último tick gravado (`worlds.tick`, coluna além do esquema do plan, como `players.bot`);
  - um crash perde os comandos aceitos (com ack) do tick em andamento (no máximo 1 tick); um desligamento limpo
    (SIGTERM) grava o snapshot, mas perde os comandos ainda na fila. Os `join` na fila não se perdem: a
    recuperação reenvia o `join` de quem está na tabela `players` e não está no estado;
  - depois de um restart, os relógios de desconexão e de inatividade começam quando o servidor sobe;
  - o `release` automático é um comando do próprio jogador, gravado no log;
  - `metrics`: uma linha por time e uma do mundo (`team_id` nulo, com estradas e depósitos), a cada 60 ticks;
  - mundo encerrado continua hospedado, só para leitura (status `ended` e snapshot final). O relatório final a
    partir do banco não entra no F6;
  - sem `seed`, o servidor sorteia um; `multiplier` vai de 1 a 10 000 (padrão 1). Nome de jogador não é único;
  - `join` na fila conta para o limite de 3 humanos por time;
  - mensagem inválida sem `ref` legível volta com `ref: -1`.
- **`SIM_VERSION` vale desde o F6 (hoje 2):** mundos persistidos guardam a versão. Mudou o comportamento do `sim`?
  Suba a versão; um mundo de outra versão não é recuperado (o servidor loga e o pula).
- **Interpretações do F5 a validar** (a spec e o plan não fixam):
  - tempo dos creeps em 5 atividades: as 4 da spec §7 (coletando, carregando, andando vazio, parado) mais
    **construindo**. "Andando" conta desde o tick em que o creep ganha pontos de movimento; esperar a obra de outro
    construtor conta como parado;
  - **viagem** = do primeiro tick em que o creep sai andando até entregar carga no Núcleo. Chegar vazio ao Núcleo
    descarta a viagem;
  - **disputa** de um depósito = tempo em que creeps dos dois times tinham ordem de coletar nele (tráfego, não só
    coleta simultânea);
  - **Núcleo ocioso** = tick que termina sem nada em produção (um creep de 10 min conta 599 s ocupado);
  - "zerou pela 1ª vez" é registrado para todo depósito, inclusive de matéria;
  - os bots entram no tick 0 e agem no tick 1 e depois a cada 60 ticks; os comandos deles contam nas métricas de
    "humanos" do time (no harness não há humanos);
  - o `geo sweep` guarda só o `run.json` de cada run (o `samples.jsonl` de 3 dias tem ~11 MB); `--keep-runs` guarda
    tudo.
- **Testes de mecânica** usam `packages/sim/test/params.json` (os valores do F5), não o `default.json`; o
  balanceamento não quebra mais os testes. O `default.json` continua no `geo verify` e no orçamento do CI.
- **Correção do A* (2026-11-14, branch `m1/f6-server`):** o time 1 desempata na ordem de células rotacionada, e
  a rota dele é o espelho da do time 0. Antes, os times construíam estradas diferentes no mapa simétrico (até ~19%
  de diferença na entrega). Com o `default.json` atual (candidato B, `teams.maxHumans`), o hash de 3 dias do seed 42 é `10662729…` (`SIM_VERSION` 2).
- **Sinais do relatório de 3 dias (checkpoint do F5, anterior à correção do A*):** com os parâmetros atuais e o `balanced`, a economia trava
  em ~4 h: teto de população em 4,2 h, todo o cristal esgotado em 2,5 h, estradas param em 113 células; depois os
  30 creeps disputam 6 depósitos de matéria que regeneram 1/min (andam vazios 58–76% do tempo), o Núcleo fica 94%
  ocioso e 91% da matéria entregue sobra no estoque. Análise em [balance.md](../specs/m1-ciclo-da-riqueza/balance.md).
  A diferença entre os times vinha do A* (corrigida); a hipótese dos desempates por menor id não se confirmou.
- **Interpretações do F4 a validar** (a spec não fixa):
  - jogadores entram no estado por um comando de sistema `join {team}`, que o servidor emite e grava no log como
    o `release` de desconexão;
  - o `step` revalida cada comando no estágio 1, na ordem recebida, contra o estado deixado pelos anteriores (ex.:
    dois `produce` no mesmo tick: o 2º é recusado com `busy`);
  - "possível" para as ações: `gather` precisa de carga não cheia e de um depósito não vazio do recurso;
    `moveTo` precisa de célula transitável; `buildRoad` precisa de alvo que aceite estrada, de um próximo segmento
    e de estoque (ou de uma obra já paga nele); `deliver` e `stop` são sempre possíveis;
  - comandos manuais (`order`) só checam limites do mapa e a existência do depósito; uma ordem para célula
    intransponível vira `stop` na execução;
  - um `applyPreset` recusado (ex.: `roadBuilder` sem alvo) não mexe nas regras.
- **Custo do piloto automático:** com o "construtor de estrada" travado (alvo na outra margem ou sem caminho), a
  regra refaz o A* a cada tick. O F5 confirmou que cabe no orçamento (3 dias em ~56 s, 10× abaixo do alvo); o cache
  do próximo segmento por `roadRevision` só se a medição piorar.

- **Interpretações do F3 a validar no playtest** (detalhes de implementação que a spec não fixa):
  - o tick em que o creep chega a um depósito ou a um segmento é gasto andando; a coleta e a obra começam no
    tick seguinte. A entrega é no próprio tick da chegada ("instantânea");
  - `gather` com o creep já cheio, depósito inexistente ou de cristal esgotado vira `stop` na hora. Num depósito
    de matéria vazio, o creep anda até lá e espera a regeneração (decisão do dono, 2026-11-14); esperar conta
    como **parado** nas métricas; `deliver` sem carga anda
    até o Núcleo e para;
  - a regeneração usa o relógio do mundo (a cada `everySeconds` desde o tick 0), não um contador por depósito;
  - uma obra de estrada pertence ao time que pagou, mas qualquer creep com `buildRoad` naquela célula a continua
    (inclusive do outro time) sem pagar de novo; obras abandonadas ficam no estado para sempre.

- **Interpretações do F2 a validar no playtest** (o plan não detalha): o modificador vale para a célula em que o
  creep **entra**; "carregado" = qualquer carga > 0; creeps não colidem; `moveTo` inalcançável vira `stop`; ao
  chegar ou parar, os pontos acumulados zeram.

- **Chutes de geração de mapa a calibrar no F5:** `map.crossingWidth`, `map.core`, `map.rocks`,
  `deposits.materia.{perSide, min/maxCoreDistance}`, `deposits.cristal.{minCoreDistance, contested*}`. Aprovados
  pelo dono como provisórios.

- **`npm audit`:** aviso moderado (ReDoS no `minimatch`, dentro do typescript-eslint, só em dev). Sem correção
  que não quebre; reavaliar quando o typescript-eslint atualizar.
- **TypeScript fixado em `~6.0`:** o typescript-eslint ainda não suporta o TS 7.

## Workflow

- Branch por fase (`m<marco>/f<fase>-<slug>`), Conventional Commits por unidade lógica, merge `--no-ff` em `main`:
  skill [`commit`](../../.claude/skills/commit/SKILL.md).
- Implementar uma fase: skill `implement-phase`. Convenções de código: "Convenções do `sim`" no CLAUDE.md.
- Outras skills: `adr`, `gdd-decision`, `spec-slice`. Skills novas só quando uma necessidade aparecer na prática.
- Comandos: seção "Comandos" do [CLAUDE.md](../../CLAUDE.md). `npm run check` = o que o CI roda.
