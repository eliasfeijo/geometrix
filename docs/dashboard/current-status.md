# Status atual

**Atualizado:** 2026-11-13 · **Marco:** M1 — O ciclo da riqueza · **Fase:** F2 concluída, F3 a iniciar

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
| M1 — F3 Economia | ⏭️ Próxima. Coleta, entrega, regeneração, produção, upgrade, `buildRoad` | [tasks.md §F3](../specs/m1-ciclo-da-riqueza/tasks.md) · [spec §5 R/I](../specs/m1-ciclo-da-riqueza/spec.md) |
| M1 — F4…F9 | ⬜ Pendentes. Checkpoints: F5 primeiro relatório de 3 dias bot×bot; F7 playtest local; F9 playtest comprimido | [plan.md §13](../specs/m1-ciclo-da-riqueza/plan.md) |
| M2–M4 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Próximos passos imediatos

1. **Publicar o repo no GitHub** (dono). Ainda não há remote, então o CI ([ci.yml](../../.github/workflows/ci.yml))
   nunca rodou fora da máquina local.
2. **F3:** criar a branch `m1/f3-economy` a partir de `main` e seguir [tasks.md §F3](../specs/m1-ciclo-da-riqueza/tasks.md).
   As novas ordens (`gather`, `deliver`, `buildRoad`) entram em `orders.ts`; uma estrada concluída deve incrementar
   `state.roadRevision` para invalidar os caminhos em cache.

## Pendências e pontos a esclarecer

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
- Outras skills: `adr`, `gdd-decision`, `spec-slice`. Skills novas só quando uma necessidade aparecer na prática.
- Comandos: seção "Comandos" do [CLAUDE.md](../../CLAUDE.md). `npm run check` = o que o CI roda.
