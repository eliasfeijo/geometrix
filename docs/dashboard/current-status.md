# Status atual

**Atualizado:** 2026-11-14 · **Marco:** M1 — O ciclo da riqueza · **Fase:** F5 concluída; passada de balanceamento 1 aguardando decisão do dono; F6 a seguir

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
| M1 — Balanceamento 1 | 🟡 Diagnóstico e 2 candidatos prontos; **aguarda decisão do dono**. Assimetria entre os times corrigida (desempate do A*) | [balance.md](../specs/m1-ciclo-da-riqueza/balance.md) · `params/balance-{a,b}.json` |
| M1 — F6…F9 | ⬜ Pendentes. Checkpoints: F7 playtest local; F9 playtest comprimido | [plan.md §13](../specs/m1-ciclo-da-riqueza/plan.md) |
| M2–M4 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Próximos passos imediatos

1. **Publicar o repo no GitHub** (dono). Ainda não há remote, então o CI ([ci.yml](../../.github/workflows/ci.yml))
   nunca rodou fora da máquina local.
2. **Decisões do balanceamento** (dono), em [balance.md](../specs/m1-ciclo-da-riqueza/balance.md): aprovar as
   metas de "não trava nem explode" (§3); escolher o candidato A ou B (recomendado: B) para virar o
   `params/default.json` provisório (§4); responder as perguntas de §5 (sumidouro no M1, coleta com depósitos
   zerados, papel do cristal). A escolha só mexe em parâmetros, então o F6 pode andar em paralelo.
3. **F6 (servidor):** branch `m1/f6-server` a partir de `main`. O que ele precisa saber do código atual:
   - `apps/cli/src/harness.ts` já faz o caminho de entrada do servidor: `validate` no recebimento (ack/reject), o
     aceito ganha `tick` e `seq` e vai para o log (`LoggedCommand` = `{tick, seq, playerId, command}`, o formato da
     tabela `commands`), e o `step` revalida. Um comando aceito no recebimento ainda pode ser recusado no `step`
     (ex.: `produce` e `buyUpgrade` disputando o mesmo cristal); o replay reproduz isso.
   - O estado tem `stats` (no hash) e cada creep tem `activity` e `trip`. `sampleMetrics(state)` dá a amostra da
     tabela `metrics`, a cada 60 ticks. O SQLite das métricas entra no F6 (decisão do dono no plan §9).
   - `replay.json` do `geo sim` = `{simVersion, seed, params, ticks, finalHash, commands}`; o mundo inicial sai de
     `createWorld(seed, params)`. É o formato que o modo replay do F8 pode ler.
   - `SIM_VERSION` continua 1: nada é persistido ainda. Passa a valer no F6.
   - **Medições do F5:** 6 h de mundo bot×bot em ~3–4 s; 3 dias em ~56 s. `geo verify` (50 000 ticks, 4 execuções)
     leva ~45 s por seed; o CI roda 3 seeds.

## Pendências e pontos a esclarecer

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
- **Correção do A* (2026-11-14, branch `m1/f6-server`):** o time 1 desempata na ordem de células rotacionada, e
  a rota dele é o espelho da do time 0. Antes, os times construíam estradas diferentes no mapa simétrico (até ~19%
  de diferença na entrega). O hash de 3 dias do seed 42 com `params/default.json` passou a ser `ab0aa8a1…`.
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
  - `gather` com o creep já cheio, depósito vazio ou inexistente vira `stop` na hora; `deliver` sem carga anda
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
