# Status atual

**Atualizado:** 2026-11-13 · **Marco:** M1 — O ciclo da riqueza · **Fase:** F3 concluída, F4 a iniciar

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
| M1 — F4 Piloto automático e domínio | ⏭️ Próxima. `validate`, domínio, interpretador de regras, presets | [tasks.md §F4](../specs/m1-ciclo-da-riqueza/tasks.md) · [spec §5 D/P](../specs/m1-ciclo-da-riqueza/spec.md) |
| M1 — F5…F9 | ⬜ Pendentes. Checkpoints: F5 primeiro relatório de 3 dias bot×bot; F7 playtest local; F9 playtest comprimido | [plan.md §13](../specs/m1-ciclo-da-riqueza/plan.md) |
| M2–M4 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Próximos passos imediatos

1. **Publicar o repo no GitHub** (dono). Ainda não há remote, então o CI ([ci.yml](../../.github/workflows/ci.yml))
   nunca rodou fora da máquina local.
2. **F4:** criar a branch `m1/f4-autopilot` a partir de `main` e usar a skill `implement-phase`. O que ela precisa
   saber do código atual:
   - `Command` em `step.ts` ainda é `never`. O F3 expôs a mecânica como funções que devolvem o motivo da recusa
     (ou `null`): `startProduction(state, teamId, dna, repeat)` e `buyUpgrade(state, teamId, "capacity")`. Os
     comandos `produce`/`buyUpgrade` do F4 devem chamá-las. Falta um comando para **desarmar o "repetir"**
     (`team.repeat = null`); o `produce` sem repetir já desarma.
   - Ordens (`Order` em `orders.ts`): `stop`, `moveTo{x,y}`, `gather{depositId}`, `deliver`,
     `buildRoad{x,y,segment}`. Crie a de estrada com `buildRoadOrder(cell)` (`segment: -1`); o comando externo
     `buildRoad{x,y}` não carrega `segment`.
   - O sim ainda não conhece jogadores: o `validate(state, cmd, playerId)` vai precisar do vínculo jogador → time
     no estado (decisão de modelagem do F4).

## Pendências e pontos a esclarecer

- **Interpretações do F3 a validar no playtest** (detalhes de implementação que a spec não fixa):
  - o tick em que o creep chega a um depósito ou a um segmento é gasto andando; a coleta e a obra começam no
    tick seguinte. A entrega é no próprio tick da chegada ("instantânea");
  - `gather` com o creep já cheio, depósito vazio ou inexistente vira `stop` na hora; `deliver` sem carga anda
    até o Núcleo e para;
  - a regeneração usa o relógio do mundo (a cada `everySeconds` desde o tick 0), não um contador por depósito;
  - uma obra de estrada pertence ao time que pagou, mas qualquer creep com `buildRoad` naquela célula a continua
    (inclusive do outro time) sem pagar de novo; obras abandonadas ficam no estado para sempre;
  - **consequência da regra "não constrói em travessia"**: como todo segmento precisa encostar na rede, nenhuma
    estrada cruza o rio. Um `buildRoad` para a outra margem constrói até a travessia e para.
- **Sinal da medição do F3** (bot improvisado, não é o estrategista do F5): em 3 dias, os dois times batem o teto
  de 30 creeps, acumulam ~13 000 de matéria e esgotam todo o cristal. Material para a calibragem do F5.

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
