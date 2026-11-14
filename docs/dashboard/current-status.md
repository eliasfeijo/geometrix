# Status atual

**Atualizado:** 2026-11-14 · **Marco:** M1 — O ciclo da riqueza · **Fase:** F8 (replay e multi-cliente) é a próxima

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
| M1 — F7 Cliente | ✅ Concluída, merge em `main`. Checkpoint aprovado pelo dono (2026-11-14). Lobby, mapa SVG com pan/zoom, creeps interpolados com nomes gerados, pilhas de creeps com lista para escolher, inspetor, dominar/liberar, painel do Núcleo, editor de regras e presets, controle direto pelo botão direito. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F7](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/client/src/` |
| M1 — F8 | ⬜ Pendente (replay no navegador, Safari/JSC, `dev:multi`). O M1 fecha com o critério da [spec §8](../specs/m1-ciclo-da-riqueza/spec.md) | [plan.md §13](../specs/m1-ciclo-da-riqueza/plan.md) |
| ~~M1 — F9~~ | Deploy e playtest comprimido saíram do M1 (dono, 2026-11-14): abrem o M2 | [ROADMAP](../ROADMAP.md) |
| M2–M4 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Próximos passos imediatos

1. **Publicar o repo no GitHub** (dono). Ainda não há remote, então o CI ([ci.yml](../../.github/workflows/ci.yml))
   nunca rodou fora da máquina local.
2. **Rodar o cliente:** `npm run build && npm run server` e abrir `http://localhost:8080`, ou `npm run server` +
   `npm run client` e abrir `http://localhost:5173` (recarga automática). Outra aba com `?slot=2` é outro jogador
   no mesmo navegador.
3. **F8 (replay e multi-cliente):** branch `m1/f8-replay`, a partir de `main`. O que ele precisa saber do F7:
   - O cliente é Vite + Preact + signals em `apps/client/src/`. O estado da tela é o `GameStore` (`store.ts`);
     o mapa recebe `DynamicState` + a parte estática do `welcome`. O replay pode alimentar o mesmo `GameStore`
     com `receive()` a partir do `sim` rodando no navegador (sem `Connection`).
   - `?slot=N` já separa sessões no mesmo navegador: o `dev:multi -- --clients K` pode abrir K abas com slots
     diferentes, entrando por `POST /api/worlds/:id/join` e gravando o token no `localStorage`
     (`geometrix:session:<slot>:<world>`), ou deixando cada aba entrar pelo lobby.
   - Os screenshots do F7 usaram o Chromium headless do cache do Playwright (`~/.cache/ms-playwright`) com o
     `playwright-core` instalado só no scratchpad; o repo continua sem Playwright (plan §10).
   - **Medições do F7:** 60 fps estáveis com 60 creeps no Chromium headless (mediana 16,7 ms por frame, nenhuma
     long task); bundle de 72,6 KB (26,2 KB gzip). 50 testes no cliente (1952 no total).

## Pendências e pontos a esclarecer

- **Interpretações do F7** (a spec e o plan não fixam; checkpoint aprovado pelo dono em 2026-11-14, ficam
  registradas para o playtest do M2):
  - o lobby cria mundos (seed, multiplicador, bot por time; padrão ×36 com bot no Laranja) e entra com nome de
    convidado; o token fica no `localStorage` por mundo e por slot da URL;
  - interpolação um estado atrás: o creep desliza entre os dois últimos estados no intervalo entre as mensagens;
    um salto de mais de 4 células é instantâneo; a ×1 o creep anda uma célula em ~1 s e espera a próxima;
  - zoom afastado aumenta creeps e depósitos até 2× (mínimo de 22 px na tela);
  - creeps na mesma célula (pergunta aberta no GDD 02) continuam individuais: com zoom aproximado ficam lado a
    lado numa grade de posições dentro da célula; quando cada posição teria menos de 18 px na tela, a célula vira
    uma pilha com contador, que mostra o creep selecionado, ou o seu dominado, ou o de menor id. Clicar na pilha
    abre a lista dos creeps dela; o inspetor tem "Nesta célula ◀ ▶". Com a célula cheia, os creeps cobrem o
    depósito que está embaixo;
  - "esperando o depósito regenerar" = ordem `gather`, parado na célula do depósito, depósito com 0; o creep
    ganha uma ampulheta e o inspetor diz isso em amarelo;
  - o botão direito sempre ordena o creep que o jogador domina, esteja ele selecionado ou não; sem domínio, um
    aviso. O modo estrada vale para um clique e termina se o domínio acabar. Núcleo inimigo vira `moveTo`;
  - além do clique direito, o inspetor tem "Parar" e "Entregar" (ordens do vocabulário);
  - o painel do próprio Núcleo fica fixo à esquerda; o Núcleo, os creeps e as regras do outro time aparecem só
    para leitura (sem fog, D5);
  - o editor de regras trabalha num rascunho local e envia a lista inteira com "Aplicar"; avisa se as regras
    mudaram no servidor no meio; um preset aplica na hora e descarta o rascunho. Valores iniciais ao trocar a
    condição: raio 10, quantidade 100 (padrões do editor, não balanceamento); regra nova = "sempre → entregar";
  - os nomes dos jogadores vêm do `GET /api/worlds` (o estado só tem ids);
  - nomes de creep (dono, 2026-11-14): gerados no cliente pela ordem de nascimento, de uma lista de 179 palavras
    curtas inventadas (todas a pelo menos 2 edições umas das outras, sem gíria, sem inicial I); nascimentos
    seguidos ganham nomes distantes na lista. Estável só porque ninguém morre no M1; o nome no estado é
    proposta no GDD 02 para o M2;
  - os botões de produção usam o `productionRefusal` do `sim` (alargado para aceitar o estado da rede).
- **Servidor no `/mnt/c`:** subir o `npm run server` às vezes leva mais de 5 s (WSL). Scripts que sobem o
  servidor devem esperar a porta responder, não um `sleep` fixo.
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
