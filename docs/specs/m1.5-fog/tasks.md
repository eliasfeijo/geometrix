# Tasks M1.5 — Fog of war

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Regra: uma task só é marcada `[x]` com os testes verdes (`npm run check`), no mesmo commit que a conclui. Cada fase
na sua branch (plan §12, skill `commit`), com merge `--no-ff` em `main`.

## F0 — Design, spec e plan (`m1.5/fog-spec`)

- [x] Rodada de design do fog no GDD 01, 02 e 07 (2026-11-14)
- [x] Spec aprovada, com D1–D12 (2026-11-14)
- [x] **Checkpoint:** plan aprovado (decisões N1–N10, 2026-11-14)

## F1 — Visão e memória no `sim` (`m1.5/fog-f1-vision`)

- [ ] Params `vision` no `schema`, no `default.json` e no `test/params.json` (plan §2)
- [ ] `vision.ts`: linha de visão (Bresenham inteiro no referencial do time), com testes em mapas de texto: atrás da
      pedra não, a pedra sim, rio não bloqueia, espelho igual nos dois times (plan §3, N2)
- [ ] `TeamMemory` no `WorldState`, `createMemory` no `createWorld`, `updateVision` como estágio 6 do `step` e no
      fim do `createWorld`; estrada própria entra na memória em `completeRoadJob`; testes de memória (último valor,
      obra esquecida, estrada nunca some, Núcleo lembrado) (plan §3, N1, N10)
- [ ] `view` filtrada (próprio inteiro, estrangeiros com os campos de D7, memória, `known`, `visible`), guardas
      `isOwnCreep`/`isOwnTeam`, `fullView`; teste "nada vaza" num mundo montado à mão (plan §4, spec §7)
- [ ] `SIM_VERSION` 3; hashes travados novos (mundo inicial, bot × bot de 6 h); o resto do repositório compila com
      a visão nova (estrategista, `protocol`, cliente), sem mudar comportamento além do `sim`

## F2 — Pelo que o time sabe (`m1.5/fog-f2-knowledge`)

- [ ] `known.ts`: o mapa conhecido do time como `GameMap`; `pathTo` nele, com o cache por `roadRevision` e
      `blockRevision` da memória; sai o `state.roadRevision` (plan §5, N3)
- [ ] `nextSegment`, `canBuildRoad` e `buildRoad` no mapa conhecido, com teste de estrada no escuro (spec D5)
- [ ] Piloto pela memória: `nearestDeposit`, `committedDeposit`, `resourceInRange`, validação de `moveTo` (spec A-1,
      A-2)
- [ ] Ordem `explore`, ação `explore` (BFS no mapa conhecido, sem repetir alvo), condição `resourceUnknown`; presets
      coletor e `scout`; vocabulário com `BREAKING CHANGE` (plan §6, N4, N5)
- [ ] Recusas sem vazamento: `unknownCreep` no lugar de `notYourTeam`; depósito fora da memória como inexistente
      (plan §7)
- [ ] Estrategista só com a visão (mapa a partir de `known`), sem lógica de batedor (spec B-1, N8)
- [ ] Métricas: 1ª entrega por recurso e time, células exploradas, Núcleo inimigo visto, creeps explorando; no
      `report.md` do `geo sim` e do `geo sweep` (plan §11)
- [ ] **Checkpoint:** `geo sweep` nas seeds 1–20 (6 h), `geo sim --days 3` do seed 42 (economia lado a lado com o
      hash anterior), custo do tick antes × depois (spec §7)

## F3 — Rede e servidor (`m1.5/fog-f3-network`)

- [ ] Delta com `known` (pares novos), `visible` (`add`/`remove`) e os tipos estrangeiros; testes pequenos (plan §8)
- [ ] Teste de propriedade de 6 h × seeds 1, 42 e 649 com o fog
- [ ] `welcome` sem terreno e sem `cores`; `PROTOCOL_VERSION` 3
- [ ] `WorldSummary.seed` `null` em mundo vivo; replay de mundo vivo → 409 (spec D9, D10, N9)
- [ ] **Checkpoint:** `geo net --seed 42 --days 3` contra os alvos da spec da rede §7

## F4 — Cliente (`m1.5/fog-f4-client`)

- [ ] Terreno a partir de `known`; camada de névoa com os três estados; depósitos e obras lembrados sob o véu (spec
      C-1)
- [ ] Estrangeiros: creep e Núcleo inimigos só com o que a visão traz; painéis sem dados do time inimigo (spec C-2)
- [ ] Cursor e traçado de estrada pelo mapa conhecido (spec C-3)
- [ ] Editor de regras: ação explorar, condição "não conhece depósito de X", preset batedor (spec C-4)
- [ ] Replay com `fullView`, sem névoa (spec C-5)

## F5 — Soak e legibilidade (`m1.5/fog-f5-playtest`)

- [ ] `npm run soak` completo com o fog: 0 divergências, visões finais iguais às do servidor
- [ ] Perguntas de névoa no `PLAYTEST.md` (spec §8)
- [ ] **Checkpoint:** sessão de legibilidade do dono com `dev:multi`; resposta à hipótese; fecha o M1.5
