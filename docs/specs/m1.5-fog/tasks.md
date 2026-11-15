# Tasks M1.5 — Fog of war

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Regra: uma task só é marcada `[x]` com os testes verdes (`npm run check`), no mesmo commit que a conclui. Cada fase
na sua branch (plan §12, skill `commit`), com merge `--no-ff` em `main`.

## F0 — Design, spec e plan (`m1.5/fog-spec`)

- [x] Rodada de design do fog no GDD 01, 02 e 07 (2026-11-14)
- [x] Spec aprovada, com D1–D12 (2026-11-14)
- [x] **Checkpoint:** plan aprovado (decisões N1–N10, 2026-11-14)

## F1 — Visão e memória no `sim` (`m1.5/fog-f1-vision`)

- [x] Params `vision` no `schema`, no `default.json` e no `test/params.json` (plan §2)
- [x] `vision.ts`: linha de visão (Bresenham inteiro no referencial do time), com testes em mapas de texto: atrás da
      pedra não, a pedra sim, rio não bloqueia, espelho igual nos dois times (plan §3, N2)
- [x] `TeamMemory` no `WorldState`, `createMemory` no `createWorld`, `updateVision` como estágio 6 do `step` e no
      fim do `createWorld`; estrada própria entra na memória em `completeRoadJob`; testes de memória (último valor,
      obra esquecida, estrada nunca some, Núcleo lembrado) (plan §3, N1, N10)
- [x] `view` filtrada (próprio inteiro, estrangeiros com os campos de D7, memória, `known`, `visible`), guardas
      `isOwnCreep`/`isOwnTeam`, `fullView`; teste "nada vaza" num mundo montado à mão (plan §4, spec §7)
- [x] `SIM_VERSION` 3; hashes travados novos (mundo inicial, bot × bot de 6 h); o resto do repositório compila com
      a visão nova (estrategista, `protocol`, cliente), sem mudar comportamento além do `sim`

## F2 — Pelo que o time sabe (`m1.5/fog-f2-knowledge`)

- [x] `known.ts`: o mapa conhecido do time como `GameMap`; `pathTo` nele, com o cache por `roadRevision` e
      `blockRevision` da memória; sai o `state.roadRevision` (plan §5, N3)
- [x] `nextSegment`, `canBuildRoad` e `buildRoad` no mapa conhecido, com teste de estrada no escuro (spec D5)
- [x] Piloto pela memória: `nearestDeposit`, `committedDeposit`, `resourceInRange`, validação de `moveTo` (spec A-1,
      A-2)
- [x] Ordem `explore`, ação `explore` (BFS no mapa conhecido, sem repetir alvo), condição `resourceUnknown`; presets
      coletor e `scout`; vocabulário com `BREAKING CHANGE` (plan §6, N4, N5)
- [x] Recusas sem vazamento: `unknownCreep` no lugar de `notYourTeam`; depósito fora da memória como inexistente
      (plan §7)
- [x] Estrategista só com a visão (mapa a partir de `known`), sem lógica de batedor (spec B-1, N8)
- [x] Métricas: 1ª entrega por recurso e time, células exploradas, Núcleo inimigo visto, creeps explorando; no
      `report.md` do `geo sim` e do `geo sweep` (plan §11)
- [x] **Checkpoint:** `geo sweep` nas seeds 1–20 (6 h), `geo sim --days 3` do seed 42 (economia lado a lado com o
      hash anterior), custo do tick antes × depois (spec §7). Dono, 2026-11-14: início de partida ✅; economia
      aceita; custo do tick 2,2× aceito; regra do estrategista mantida; divergência entre os times aceita, a rever no
      rebalanceamento (plan §10, "Checkpoint da F2")

## F3 — Rede e servidor (`m1.5/fog-f3-network`)

- [x] Delta com `known` (pares novos), `visible` (`add`/`remove`) e os tipos estrangeiros; testes pequenos (plan §8).
      Feita na F1, junto com a `view` filtrada: sem ela o teste de propriedade da rede quebrava
- [x] Teste de propriedade de 6 h × seeds 1, 42 e 649 com o fog. Já rodava com o fog desde a F1; ganhou as asserções
      de creep inimigo entrando na visão e do Núcleo inimigo descoberto pelos dois times
- [x] `welcome` sem terreno e sem `cores`; `PROTOCOL_VERSION` 3. O cliente passou a desenhar o terreno a partir de
      `known` (nunca visto como selva, sem a névoa ainda) e a ler os Núcleos da visão
- [x] `WorldSummary.seed` `null` em mundo vivo; replay de mundo vivo → 409 (spec D9, D10, N9). O lobby só mostra
      a seed e o botão "Assistir replay" de mundo encerrado
- [x] **Checkpoint:** `geo net --seed 42 --days 3` contra os alvos da spec da rede §7. Os três verdes (2026-11-14):
      195 B/s por cliente (antes do fog 227), 121 µs por envio na mediana (antes 83; alvo 250), 0 divergências em
      518 400 verificações; hash `a6bde918…`, o mesmo da F2 (`runs/m1.5-fog-f3-checkpoint-net/net.md`)

## F4 — Cliente (`m1.5/fog-f4-client`)

- [x] Terreno a partir de `known` (feito na F3, com o `welcome` sem terreno); camada de névoa com os três estados; depósitos e obras lembrados sob o véu (spec
      C-1). O inspetor de depósito fora da visão diz "último valor visto"
- [x] Estrangeiros: creep e Núcleo inimigos só com o que a visão traz; painéis sem dados do time inimigo (spec C-2).
      Os painéis reduzidos vieram da F1; a F4 testou o creep inimigo (sem regras, ordem nem atividade; capacidade
      base) e trocou "não existe mais" por "saiu da visão do seu time"
- [x] Cursor e traçado de estrada pelo mapa conhecido (spec C-3). O traçado já usava o mapa conhecido desde a F3;
      sobre célula nunca vista, o rótulo diz "nunca vista · custo desconhecido" e o traçado continua desenhado
- [x] Editor de regras: ação explorar, condição "não conhece depósito de X", preset batedor (spec C-4)
- [x] Replay com `fullView`, sem névoa (spec C-5). O controller já usava a `fullView` desde a F1; a névoa não
      desenha nada com `team = -1`, e um teste confere o mundo inteiro no replay

## F5 — Soak e legibilidade (`m1.5/fog-f5-playtest`)

- [x] `npm run soak` completo com o fog: 0 divergências, visões finais iguais às do servidor (2026-11-14,
      `runs/soak-20261114-230613-s42/`): 14 364 hashes conferidos, 0 divergentes; as 4 visões finais iguais; replay
      com o hash do servidor; 6 interrupções retomadas. De novo com o `SIM_VERSION` 4
      (`runs/soak-20261115-000828-s42/`): 14 372 hashes, 0 divergentes, visões e replay iguais
- [x] Perguntas de névoa no `PLAYTEST.md` (spec §8): roteiro N1–N9 e questionário N1–N6
- [x] Alvo de explorar desempatado pelo ganho: entre as células nunca vistas igualmente próximas, a com mais células
      nunca vistas no raio de visão do creep (dono, 2026-11-14, no checkpoint; plan §10); `SIM_VERSION` 4
- [x] **Checkpoint:** sessão de legibilidade do dono com `dev:multi`; resposta à hipótese; fecha o M1.5. Dono,
      2026-11-14 (sessão 2, em andamento): **o fog e a exploração cumprem o papel esperado**; o alvo de explorar
      passou a desempatar pelo ganho (task acima). Os achados de economia e legibilidade viram a **F6**, e o
      fechamento do M1.5 passa para o checkpoint dela

## F6 — Ajustes do playtest (`m1.5/fog-f6-tuning`)

Spec §11, plan §13. Achados e decisões da sessão 2 do dono (2026-11-14).

- [x] Decisões no GDD 07 (E1) e 03 (E2); spec, plan e tasks da F6
- [x] E1: depósito escolhido por tempo de viagem; com a matéria vazia, espera só se compensar; `SIM_VERSION` 5
- [ ] E2: ritmo de coleta por recurso; cristal com o chute de 1 a cada 5 s
- [ ] E3: seleção de creep com área de clique mínima em pixels e lista quando o clique cai em vários
- [ ] E4: cursor com o ícone da ação do clique
- [ ] **Checkpoint:** economia lado a lado com a F5 (parados, vazão, esgotamento do cristal, upgrade, teto, custo
      do tick), valor do cristal, sessão de legibilidade do dono; fecha o M1.5
