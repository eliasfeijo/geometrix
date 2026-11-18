# Plan M2 — O laboratório de batalha

**Status:** Aprovado (2026-11-15) · **Data:** 2026-11-15
**Spec:** [spec.md](spec.md) · **ADRs:** [0008](../../adr/0008-pacote-de-batalha.md) (pacote de batalha, `Accepted`),
[0007](../../adr/0007-eventos-do-sim.md) (eventos fora do estado), [0003](../../adr/0003-stack-typescript-node.md)
(simulação pura e inteira), [0002](../../adr/0002-tudo-e-comando.md) (tudo é comando)

As decisões que precisavam do OK do dono estão marcadas **(P*n*)** e listadas na §15. **Todas aprovadas pelo dono
(2026-11-15), pela proposta.**

## 1. O que existe e o que é novo

| Hoje | Na fatia B |
|---|---|
| Uma simulação, o `sim` (mundo, 1 tick por segundo de mundo) | Mais o `@geometrix/battle` (`packages/battle`), sem dependência do `sim` (ADR-0008), a 20 ticks por segundo |
| As guardas de determinismo do lint valem para `packages/sim/src` | Valem também para `packages/battle/src` |
| RNG (`rng.ts`) e JSON canônico (`serialize.ts`) no `sim` | Copiados para o pacote de batalha, com um teste de igualdade (P1) |
| Params do mundo em `params/default.json` | Mais `params/battle.json` e as arenas em `params/arenas/*.txt` |
| `geo sim`, `sweep`, `verify`, `net` | Mais `geo battle` (`sweep`, `verify`) |
| O cliente tem uma página (`index.html`) | Mais `lab.html`, a página do laboratório, com a batalha num *worker* (P11) |
| CI: `geo verify` e o orçamento do `geo sim` | Mais o `geo battle verify` e um orçamento do auto-resolve |

## 2. Onde fica cada coisa

```text
packages/battle/
  package.json    @geometrix/battle, sem dependências de runtime; devDependency de teste: @geometrix/sim (P1)
  src/
    rng.ts        cópia do xoshiro128** do sim (P1)
    canonical.ts  cópia do canonicalJson do sim (P1)
    params.ts     schema, BattleParams, parseBattleParams, checkConsistency
    arena.ts      parser da arena em texto, células, vizinhos, linha livre, anel de saída, trechos de entrada
    state.ts      BattleState, Participant, Projectile, Pile; BATTLE_VERSION
    setup.ts      BattleSetup, validação (S-2) e createBattle (S-1)
    commands.ts   vocabulário de comandos e validateCommand
    movement.ts   pontos, freio da carga, disputa de célula pelo rng
    combat.ts     ataque corpo a corpo, projéteis, dano, morte
    carry.ts      largar, catar, pilhas
    exits.ts      fuga pela borda, inatividade, fim
    gambits.ts    vocabulário, avaliação, alvos, BFS, esquiva; reação da IA (P12)
    presets.ts    linha de frente, atirador, escaramuçador, portador
    view.ts       BattleView (o que a página e a IA leem)
    events.ts     BattleEvent e o coletor do tick
    step.ts       stepBattle(state, commands): BattleEvent[]; o pipeline (§7)
    serialize.ts  serializeBattle, restoreBattle
    log.ts        BattleLog (setup + comandos por tick) e replayLog
    index.ts      exports públicos
  test/           helpers.ts (params fixos, arenas de texto), um arquivo por módulo
params/
  battle.json     stats por DNA e números da batalha (spec §6)
  arenas/         aberta.txt, pedras.txt, corredor.txt
apps/cli/src/
  battle.ts       geo battle sweep / verify; matriz de confrontos; relatório
apps/client/
  lab.html        a página do laboratório (2ª entrada do Vite)
  src/lab/
    worker.ts     o servidor local: relógio, stepBattle, hash, log
    channel.ts    o canal com atraso, jitter e ordem preservada (P7)
    lab.tsx       a página: setup, controles, painéis
    arena-view.tsx  o render SVG da arena (reaproveita map/creep-shape.tsx)
    input.ts      teclado → intenção (§6)
    setup-form.tsx, gambits-editor.tsx, events-list.tsx, result-table.tsx, latency-panel.tsx
    session.ts    o registro da sessão, o modo às cegas e o export (P14)
```

## 3. Unidades e params

- **Tempo em ticks.** `tick.ticksPerSecond` = 20. Toda duração dos params está em **milissegundos**, e o
  `checkConsistency` exige múltiplo de `1000 / ticksPerSecond` (50 ms). Ex.: a recarga de 0,8 s são 800 ms, 16 ticks.
- **Movimento em pontos**, como o `CELL_COST` do `sim`: `CELL_COST = 6 000`, divisível por 20. Por tick, o creep
  ganha `cellsPerSecond × CELL_COST ÷ ticksPerSecond` pontos, vezes o freio da carga em ‰, com `Math.floor`; entra na
  célula seguinte ao juntar `CELL_COST`. O projétil anda pela mesma conta, com a velocidade dele.
- **Freio da carga** (spec D8): `freio‰ = 1 000 − fullBrakePermille × carga ÷ capacidade` (com `Math.floor`); com a
  bolsa cheia e `fullBrakePermille` = 500, metade da velocidade.
- **HP e dano inteiros**, sem milésimos: a batalha não regenera, então não há arredondamento a acumular.
- **Corpo a corpo é um projétil de velocidade 0:** `projectileCellsPerSecond` = 0 quer dizer que o ataque acerta a
  célula da frente (o quadrado). Assim o kit de cada DNA fica todo nos params, e o laboratório pode experimentar um
  quadrado que atira sem mudar código.

```json
{
  "tick": { "ticksPerSecond": 20 },
  "start": { "countdownMs": 3000 },
  "dna": {
    "square":   { "hp": 300, "damage": 30, "range": 1, "cooldownMs": 1000, "cellsPerSecond": 3,
                  "projectileCellsPerSecond": 0, "capacity": 30 },
    "triangle": { "hp": 200, "damage": 20, "range": 4, "cooldownMs": 800, "cellsPerSecond": 4,
                  "projectileCellsPerSecond": 10, "capacity": 20 },
    "circle":   { "hp": 120, "damage": 24, "range": 6, "cooldownMs": 800, "cellsPerSecond": 5,
                  "projectileCellsPerSecond": 12, "capacity": 10 }
  },
  "carry": { "fullBrakePermille": 500 },
  "exit": { "dwellMs": 2000 },
  "inactivity": { "timeoutMs": 15000 },
  "ai": { "decisionMs": 250, "decisionJitterMs": 100 },
  "gambits": { "maxRules": 8 },
  "limits": { "maxSides": 4, "maxPerSide": 5 }
}
```

O `test/params.json` do pacote fixa os mesmos números e não acompanha o balanceamento, como no `sim`. A exceção é a
contagem do começo (spec D21, F5): 0 nos params de teste, para as regras serem testadas desde o primeiro tick; os
testes da contagem a ligam.

## 4. A arena

Texto, uma linha por fileira, com o anel de saída incluído (23 × 15 para a arena de 21 × 13 da spec):

| Caractere | Célula |
|---|---|
| `.` | chão |
| `#` | pedra (bloqueia movimento e projétil) |
| `1`–`4` | chão do trecho de entrada do lado *n* |

- O **anel de saída** é a fileira e a coluna de fora, e só pode ter chão ou pedra. Os trechos de entrada ficam **na
  primeira volta de dentro**, colados no anel: quem nasce não está na saída e não começa a fugir (spec S-1, D7).
- **Checkpoint da F3 (dono, 2026-11-17), a fazer na F4:** as três arenas passam a 43 × 27 (45 × 29 com o anel), mais
  uma aberta de 63 × 39 só para comparar no relatório. Os trechos viram **zonas de nascimento**: blocos de chão a
  1/4 da largura (ou da altura) a partir da borda, longe da saída (spec D3). O formato do texto não muda: os dígitos
  1–4 marcam a zona, onde quer que ela esteja.
- As três arenas são **simétricas por rotação de 180°** entre os trechos 1 e 2 (e entre 3 e 4), para que o lado não
  decida nada; o harness confere isso (o espelho tem de dar ~50%, §12).
- A arena é dado do setup (um `string[]`), não param: o pacote é puro e não lê arquivo. A CLI lê `params/arenas/`
  com `fs`; o cliente importa o texto pelo Vite (`?raw`).

## 5. Estado

Só JSON, arrays ordenados por id, ids do `nextId` (spec S-3).

```ts
type Dir = "up" | "down" | "left" | "right";
type Controller = "gambits" | "human";

type Participant = {
  id: number; side: number; name: string; dna: Dna;
  cell: number;               // índice na arena
  facing: Dir;
  hp: number;                 // atual; o máximo vem dos params
  carry: { materia: number; cristal: number };
  controller: Controller;
  gambits: Gambit[];          // substituídas inteiras, nunca mutadas (como as regras do sim)
  intent: { move: Dir | null; attack: boolean; attackLatch: boolean; drop: boolean; pickup: boolean };
  movePoints: number;
  cooldownTicks: number;
  exitTicks: number;          // ticks seguidos no anel sem levar golpe
  idleTicks: number;          // desde o último dano dado ou recebido, ou da entrada
  ai: { nextDecisionTick: number; target: number | null };
  status: "fighting";         // quem sai vai para `departed`
};

type Projectile = { id: number; owner: number; side: number; cell: number; dir: Dir;
                    points: number; cellsLeft: number; damage: number };
type Pile = { id: number; cell: number; materia: number; cristal: number };

type BattleState = {
  battleVersion: number; params: BattleParams; arena: Arena; rng: RngState;
  tick: number; nextId: number;
  participants: Participant[]; projectiles: Projectile[]; piles: Pile[];
  departed: Departure[];      // morreu ou fugiu: desfecho, HP final, carga, dano dado e recebido, tick
  totals: { id: number; dealt: number; taken: number }[];  // por participante, ordenado por id
  ended: { tick: number; winnerSide: number | null } | null;
};
```

Os tipos exatos saem na F1; a forma acima é a do contrato que a F2 e a F3 assumem.

## 6. Comandos

Um só vocabulário para o humano e para a IA (ADR-0008, regra 6), validado por `validateCommand`:

| Comando | Quem | Efeito |
|---|---|---|
| `intent { id, move, attack }` | humano | **intenção persistente:** anda na direção enquanto `move` ≠ `null`; ataca sempre que a recarga deixar enquanto `attack` |
| `attackOnce { id }` | humano | arma o *latch*: o próximo ataque possível sai, mesmo que a tecla já tenha sido solta |
| `face { id, dir }` | humano, IA | vira sem andar (mirar) |
| `drop { id }`, `pickup { id }` | humano, IA | largar a bolsa e catar (spec D8), no próximo tick |
| `control { id, controller }` | laboratório | troca quem comanda (spec D12); `human` em um participante solta o anterior |
| `setGambits { id, gambits }` | laboratório | substitui a lista inteira (L-7), copiada campo a campo como o `rules.ts` do `sim` |
| `join { side, participant }` | laboratório | entrada no meio da luta (spec D11, E-1) |

- **Intenção, não passo** (P4): com latência, o humano manda uma mensagem ao apertar e outra ao soltar, não uma por
  célula. O efeito da latência no "soltar" (o creep anda uma célula a mais) é justamente o que o laboratório mede.
- **Os comandos valem no tick seguinte ao que chegam ao *worker*** (P5). O log guarda `{ tick, commands }` na ordem
  de chegada; o replay os aplica no mesmo tick.
- Um comando para um participante que não existe mais, ou de um tipo que o controlador não pode emitir (a IA não
  manda `control`), é recusado sem efeito e sem evento.

## 7. Pipeline do tick

`stepBattle(state, commands): BattleEvent[]` (como o `step` do `sim` na fatia A):

1. **Comandos** do humano e do laboratório, validados e aplicados (intenção, *latch*, `control`, `setGambits`,
   `join`).
2. **IA:** para cada participante com `controller = "gambits"` cujo `nextDecisionTick` chegou, avaliar os gambits
   sobre a `BattleView` do começo do tick e trocar a intenção dele (P12). Entre duas decisões, ele segue a intenção
   anterior.
3. **Virar e atacar** (P3): quem tem intenção de atacar (ou *latch*) e recarga zerada ataca na direção em que olha.
   O corpo a corpo resolve na hora; o projétil nasce na célula da frente (se for pedra, some).
4. **Movimento:** pontos, freio da carga; quem junta `CELL_COST` tenta entrar na célula vizinha. Pedra ou célula
   ocupada no começo da etapa: só vira. Duas entradas na mesma célula: o `rng` escolhe, em ordem de id dos
   candidatos, uma chamada por disputa (M-3).
5. **Projéteis**, em ordem de id: cada um confere a célula onde está e cada célula em que entra neste tick, **depois
   do movimento**; acerta o primeiro inimigo que encontrar, some numa pedra ou ao fim do alcance. Conferir a célula
   de partida pega o creep que andou para dentro do tiro.
6. **Dano e morte:** o dano zera o `idleTicks` de quem bate e de quem apanha (spec A-4, D9) e o `exitTicks` de quem
   apanha (F-1). HP 0: sai para `departed`, e a carga vira pilha na célula (A-5).
7. **Largar e catar** (C-1, C-2).
8. **Saída e inatividade:** no anel, `exitTicks` + 1; ao chegar a `dwellMs`, foge pela borda (F-1). Fora do anel,
   `exitTicks` = 0. `idleTicks` + 1; ao chegar a `timeoutMs`, foge por inatividade (F-2).
9. **Fim:** se sobra no máximo um lado com participantes, `ended` (F-3).

**Atacar antes de andar** (P3): no mesmo tick, o golpe sai antes do passo. Quem está colado no quadrado e foge leva
o golpe daquele tick; o projétil, por sua vez, só se move depois dos creeps, então dá para sair da linha.

## 8. As regras, no detalhe

- **Linha livre** (`arena.ts`): da célula da frente até o alcance, na direção, sem pedra no caminho. Serve para a
  condição "inimigo alinhado no alcance" e para o ataque corpo a corpo (alcance 1).
- **Disputa de célula:** só entre quem juntou os pontos no mesmo tick. Quem perde fica com os pontos e tenta de
  novo no tick seguinte, se a célula ainda estiver livre.
- **Pilhas:** uma por célula, somadas. Uma pilha não ocupa a célula (dá para pisar e catar).
- **Entrada** (E-1): a célula livre do trecho do lado é escolhida pelo `rng`; um lado novo recebe o primeiro trecho
  sem participantes vivos. O `idleTicks` começa em 0.
- **Nascimento** (S-1): a mesma escolha pelo `rng`, olhando para o lado oposto ao do trecho.
- **Nome:** vem do setup (o laboratório usa uma lista curta de nomes próprios do laboratório; os nomes do mundo
  chegam pela junção).

## 9. IA de gambits

```ts
type Target = { by: "nearest" } | { by: "weakest" } | { by: "dna"; dna: Dna };
type Condition =
  | { type: "always" }
  | { type: "hpBelow"; permille: number }
  | { type: "enemyWithin"; cells: number }
  | { type: "enemyAligned" }                       // no alcance, com linha livre
  | { type: "projectileIncoming" }                 // projétil inimigo cuja linha passa por mim
  | { type: "carryAbove"; permille: number }
  | { type: "allyHpBelow"; permille: number; cells: number };
type Action =
  | { type: "attack"; target: Target } | { type: "approach"; target: Target }
  | { type: "keepDistance"; target: Target } | { type: "dodge" } | { type: "protect" }
  | { type: "flee" } | { type: "drop" } | { type: "pickup" };
type Gambit = { when: Condition; then: Action };
```

- **Avaliação** (spec G-1): a 1ª regra com condição verdadeira e ação possível dá a intenção. Ação impossível (ex.:
  catar sem pilha à vista, esquivar sem célula livre) passa para a regra seguinte.
- **Tempo de reação** (P12): cada participante da IA decide a cada `decisionMs` ± `decisionJitterMs` (sorteado pelo
  `rng` a cada decisão). Sem isso, a IA veria cada projétil no tick em que nasce e desviaria de todos: o círculo
  nunca acertaria a IA, e as lutas acabariam por inatividade. Com 250 ms, de longe ela costuma desviar e de perto
  não, o que dá valor à distância. A reação sorteada também dá variedade às seeds do `geo battle` (§12).
- **Alvos:** "mais perto" em passos (BFS); "mais ferido" pelo HP relativo (‰); empate: mantém o alvo anterior, e
  depois o `rng`. Nunca o id.
- **Ir até alinhar** (`attack`, `approach`): BFS na arena até a célula mais próxima de onde o alvo fica alinhado
  no alcance com linha livre; o corpo a corpo, até a vizinha. O BFS roda só na decisão (a cada ~250 ms), não a cada
  tick: um 3 × 3 de 120 s faz ~3 000 BFS de ~300 células, dentro do orçamento de 50 ms.
- **Manter distância:** fica a uma distância entre o alcance próprio − 1 e o alcance próprio; recua se o alvo chega
  mais perto; atira quando alinha.
- **Esquivar:** sai para uma célula vizinha livre fora da linha do projétil (a perpendicular); sem nenhuma, a ação é
  impossível.
- **Proteger:** vai para uma célula entre o aliado mais ferido no raio e o inimigo mais perto dele.
- **Fugir:** BFS até a célula do anel mais próxima e fica nela.
- **Presets** (spec D15), com o limite de HP baixo em 250‰ e o "inimigo perto" do portador em 4 células:

| Preset | Regras, em ordem |
|---|---|
| Linha de frente (quadrado) | `allyHpBelow 500‰ a 4` → `protect`; `always` → `attack nearest` |
| Atirador (círculo) | `hpBelow 250‰` → `flee`; `projectileIncoming` → `dodge`; `enemyWithin 3` → `keepDistance nearest`; `always` → `attack weakest` |
| Escaramuçador (triângulo) | `hpBelow 250‰` → `flee`; `projectileIncoming` → `dodge`; `always` → `attack nearest` |
| Portador (qualquer) | `enemyWithin 4` → `drop` (impossível sem carga: passa adiante); `always` → `flee` |

## 10. Eventos e resultado

`BattleEvent = { tick, index, type, ... }`, fora do estado (ADR-0007): `attacked` (quem, direção), `hit` (quem,
em quem, dano, HP restante), `died`, `dropped`, `picked`, `joined`, `escaped` (`reason: "edge" | "idle"`),
`controlChanged`, `ended` (lado vencedor ou `null`, e o desfecho de cada participante: `won`, `died`,
`escapedEdge`, `escapedIdle`, com HP final, carga, dano dado e recebido; e as pilhas que ficaram). Os eventos são o
contrato interno v0 do ADR-0008, versionado pela `BATTLE_VERSION`.

## 11. Determinismo

- **RNG e JSON canônico copiados do `sim`** (P1): dois arquivos pequenos, com um teste do pacote de batalha que
  compara a sequência do RNG e a saída do `canonicalJson` com as do `sim` (devDependency só de teste: o runtime não
  importa o `sim`). A extração para um pacote comum fica para a junção, quando o mundo chamar a batalha.
- **Hash:** sha256 do `serializeBattle`, fora do pacote (`node:crypto` na CLI, Web Crypto no *worker*).
- **`BATTLE_VERSION`** = 1; sobe quando o mesmo log passa a dar outro resultado.
- **O log** (`BattleLog`): `{ battleVersion, setup, params, commands: { tick, commands }[], finalHash }`. O
  `replayLog` recria a batalha e aplica os comandos; o `geo battle verify --log` compara com o `finalHash`.
- **Lint e tsconfig:** o bloco do `eslint.config.js` passa a valer para `packages/battle/src/**/*.ts`; o tsconfig do
  pacote é o do `sim` (`lib` ES2023, `types` vazio).

## 12. `geo battle` e o CI

- **`geo battle sweep`** (spec R-1): a matriz da spec §7 e §8 (1 × 1 de cada par e espelhos, 2 × 2, 3 × 3,
  1 × 1 × 1; HP cheio e a 500‰; com e sem carga; três arenas; `--seeds 1-100`), só com os presets. Escreve
  `runs/<id>/battle.md` e `battle.csv`: vitórias por confronto e arena, a taxa do lado 1 nos espelhos (o teste de
  simetria, ~50%), a distribuição da duração, a fração de fugas por inatividade e pela borda, a fuga carregada com e
  sem largar a bolsa, e o custo por batalha (mediana e p95 de ms por 3 × 3).
- **`geo battle verify`**: sem `--log`, roda uma amostra da matriz duas vezes e com snapshot → restore no meio e
  compara os hashes (R-2); com `--log <arquivo>`, reproduz o log do laboratório (R-3).
- **CI:** `geo battle verify --seeds 1,42,649` e o orçamento `geo battle sweep --quick --max-seconds 60` (uma
  fração da matriz), como o orçamento do `geo sim`. Um log exportado do laboratório entra como *fixture* de teste da
  CLI na F4.

## 13. O laboratório

- **A página** (P11): `apps/client/lab.html`, a 2ª entrada do Vite (`build.rollupOptions.input`). `npm run lab`
  abre o Vite em `/lab.html`; o `npm run server` também a serve, do `dist`. Ela não abre WebSocket nem fala com o
  servidor do jogo.
- **O *worker*** é o servidor local: recebe o setup, cria a batalha, roda o relógio de 20 ticks por segundo
  (acumulando o tempo real, sem deriva), aplica os comandos que chegaram no tick seguinte, manda a `BattleView` e
  os eventos de cada tick, guarda o log e calcula o hash no fim. Velocidades: ×1, ×4 e instantâneo (todos os ticks
  de uma vez, só com a IA); pausar e reiniciar.
- **O canal** (P7): as mensagens nos dois sentidos passam por uma fila com atraso de `RTT ÷ 2 ± jitter` cada perna,
  e **a ordem é preservada** (como num WebSocket sobre TCP: uma mensagem nunca ultrapassa a anterior). O que vai
  pelo canal é a **visão inteira de cada tick** (P6); a página mostra o tamanho médio, como dado para o deploy.
- **O render** (P8, P9): SVG em Preact, como o mapa do mundo, com as formas de `map/creep-shape.tsx`. A posição do
  creep é **interpolada por um tick** entre as duas últimas visões; um botão desliga a interpolação (pula de
  célula em célula, como no BYOND) para o dono comparar. A interpolação entra no atraso medido.
- **O atraso medido** (L-4): a página carimba a tecla com o relógio local e mede até a primeira visão que mostra o
  efeito (a intenção aplicada); mostra a mediana e o p95 da batalha.
- **Os controles** (spec D13): setas ou WASD dão a intenção de andar (e viram); Shift + seta só vira; espaço
  segurado ataca (e o toque arma o *latch*); `Q` larga a bolsa; `E` cata; `Tab` troca o creep dominado; `0` solta o
  domínio.
- **Setup:** arena, lados, participantes (DNA, HP inicial em ‰, carga, preset), seed; um botão "sortear seed".
- **Editor de gambits** (L-7): a lista do participante selecionado, com o preset, acrescentar, tirar e reordenar,
  limitado a `maxRules`; manda `setGambits`.
- **Reforço** (L-6): escolhe o lado (um dos existentes ou um novo, até 4) e o participante, e manda `join`.
- **Sessão e modo às cegas** (P14, L-5): cada batalha acabada entra no registro (setup, quem foi dominado,
  desfecho, RTT, nota). No modo às cegas, o RTT é sorteado entre os do seletor **pela página, com `Math.random`**
  (fora da simulação, não entra no log), o seletor some, e a nota de 1 a 5 é pedida no fim antes de revelar o RTT.
  O registro fica no `localStorage` (com `try/catch`) e sai num JSON exportável, com o resumo nota × RTT e vitórias
  dominando × IA.
- **Export do log:** um botão baixa o `BattleLog` da última batalha.

## 14. Testes

- **`battle`**, em arenas de texto: S-1..S-3 (incl. setups inválidos), M-1..M-3 (freio, corpo que bloqueia, disputa
  pelo `rng`), A-1..A-5 (recarga, corpo a corpo, projétil que acerta, que erra quem saiu da linha, que pega quem
  entrou na linha, que para na pedra, que atravessa aliado), C-1, C-2, F-1..F-4 (fuga interrompida por golpe,
  inatividade, fim com três lados, arena vazia), E-1, G-1..G-3 (cada condição e ação, presets, tempo de reação),
  serialize → restore, a igualdade com o RNG e o JSON canônico do `sim`, o `replayLog`.
- **`cli`:** o `verify` com e sem log (com a *fixture* do laboratório); a forma do relatório.
- **`client`:** o canal (atraso, jitter, ordem preservada, com relógio falso), a entrada do teclado → intenção, a
  interpolação, o registro da sessão e o resumo nota × RTT.

## 15. Decisões aprovadas (dono, 2026-11-15)

| # | Decisão | Aprovada (a proposta) | Alternativa descartada |
|---|---|---|---|
| P1 | RNG e JSON canônico | Copiar os dois arquivos do `sim` para o pacote de batalha, com um teste de igualdade; extrair um pacote comum na junção | Extrair já um `@geometrix/core` com os dois: mexe no `sim` enquanto a fatia A está nele |
| P2 | Unidades | 20 ticks por segundo; durações em ms múltiplas de 50; movimento em pontos (`CELL_COST` 6 000); HP inteiro | Durações em ticks nos params (menos legíveis; mudar o tick muda todos os números) |
| P3 | Ordem do tick | Atacar antes de andar; os projéteis andam depois dos creeps e conferem a célula de partida | Andar antes de atacar: o corpo a corpo erra quem sai no mesmo tick, e a esquiva fica mais fácil |
| P4 | Entrada do humano | Intenção persistente (apertar e soltar) mais um *latch* para o toque no ataque | Um comando por passo (uma mensagem por célula; a latência pesa duas vezes) |
| P5 | Quando um comando vale | No tick seguinte ao que chega ao *worker*, na ordem de chegada | No próprio tick em que chega (o tick pode já ter rodado: não determinístico no replay) |
| P6 | O que vai pelo canal | A visão inteira de cada tick (poucos creeps; ~2–4 KB) | Deltas, como o ADR-0006: o formato da rede de batalha fica para a junção e o deploy |
| P7 | O canal | Atraso por perna de RTT ÷ 2 ± jitter, com a ordem preservada (TCP) | Mensagens independentes (podem chegar fora de ordem, como UDP): não é o que o WebSocket do deploy faz |
| P8 | Render | Interpolação de um tick, com um botão para desligar | Sem interpolação (pula de célula em célula) |
| P9 | Tecnologia do render | SVG em Preact, com as formas do mapa do mundo | Canvas (só se o SVG não aguentar; uma dúzia de creeps não pede) |
| P10 | Relógio do *worker* | Acumula o tempo real e roda os ticks devidos, sem deriva; ×1, ×4, instantâneo | `setInterval` puro (deriva sob carga) |
| P11 | Onde mora a página | `apps/client/lab.html`, 2ª entrada do Vite, com `npm run lab` | Um app novo, `apps/lab` (duplica o Vite, os estilos e as formas) |
| P12 | **Tempo de reação da IA (gameplay)** | A IA decide a cada 250 ms ± 100 ms (params, sorteado pelo `rng` da batalha); entre decisões, segue a intenção anterior | Decidir a cada tick: a IA desviaria de todo projétil, e o círculo nunca acertaria ninguém |
| P13 | Gambits na simulação | Dentro do `stepBattle`, como o piloto do mundo: a lista está no estado e o log só tem os comandos do humano e do laboratório | Fora, como o estrategista dos bots, com os comandos da IA no log (o log cresce 20 vezes e o auto-resolve depende de quem roda a IA) |
| P14 | Registro da sessão | `localStorage` com `try/catch`, mais o export em JSON | Só em memória, com o export (some ao recarregar a página) |

### Decisões do checkpoint da F3 (dono, 2026-11-17)

| # | Decisão |
|---|---|
| C1 | O combate cru não se balanceia agora: quadrado × triângulo a 100% é justo (corpo a corpo que não é *kitado* vence), e lutas de ~14 s no 1 × 1 estão boas sem variedade de mecânicas. No relatório, vitórias e duração viram **informativos**; só o custo reprova |
| C2 | Arenas 2× maiores, com zonas de nascimento a 1/4 da largura (spec D3, §6); uma aberta 3× para comparar. Primeira task da F4, com o `sweep` e os replays de novo antes da página |
| C3 | A fuga pela borda não muda (um golpe zera a contagem). A dificuldade da IA fica configurável: reação por participante no setup (spec D20); uma IA que aprende é proposta sem marco no GDD 06 |

### Decisões do checkpoint da F5 (dono, 2026-11-18, na sessão livre)

O checkpoint da F5 continua depois da F6, que implementa estas decisões (registro no
[tasks.md](tasks.md), F5 e F6).

| # | Decisão |
|---|---|
| C4 | **Primeiro passo imediato** (spec D22, M-1): parado, o creep anda no tick seguinte ao comando; cada toque anda uma célula, sem passar da velocidade do DNA |
| C5 | **Inatividade da batalha** (spec D9, A-4, F-2): um relógio só; 15 s sem nenhum dano em ninguém, todos fogem ao mesmo tempo, sem vencedor |
| C6 | **A tela do laboratório legível num notebook** (spec L-8): a arena na largura disponível, formas, barras e traços maiores; sinal de quem ataca, do golpe (com o dano) e do projétil que some sem acertar. Sem som (proposta sem marco no GDD 06) |
| C7 | **O domínio acaba com a batalha** no laboratório: o "instantâneo" não fica travado depois do fim, e dominar o creep que já é seu não marca a batalha como "trocou de domínio" |
| C8 | **Golpe crítico** fica como pergunta aberta no GDD 06, para o M2.5 (stats e skills); não entra no M2 |

## 16. Pontos de contato com a fatia A

A B anda em paralelo e mora num pacote novo. Os arquivos que as duas tocam, e que pedem atenção no merge:

| Arquivo | Na B | Cuidado |
|---|---|---|
| `eslint.config.js` | o glob das guardas inclui `packages/battle` | conflito pequeno, de uma linha |
| `package-lock.json` | o workspace novo | regenerar com `npm install` no merge |
| `.github/workflows/ci.yml` | os passos do `geo battle` | acrescentar depois dos passos do `geo` |
| `apps/cli/src/main.ts` | o subcomando `battle` | a A mexe no harness, não no despacho; o conflito, se houver, é no texto do `USAGE` |
| `apps/client/vite.config.ts`, `package.json` | a 2ª entrada, `npm run lab` | a A não mexe nesses |
| `apps/client/src/map/creep-shape.tsx` | só leitura (reaproveitar as formas) | se a A mudar a assinatura, a B se adapta no merge |
| `docs/PLAYTEST.md` | as perguntas do laboratório | seções separadas |

Nada da B toca em `packages/sim/src`, `params/default.json`, `SIM_VERSION` ou nos hashes do mundo.

## 17. Ordem de implementação

Cada fase na sua branch `m2/laboratorio-f<n>-<slug>`, com merge `--no-ff` em `main` (skill `commit`).

| Fase | Entrega | Checkpoint |
|---|---|---|
| F0 | Spec, ADR-0008 e plan (`m2/laboratorio-spec`) | Plan aprovado |
| F1 | **O pacote e o movimento:** `packages/battle` (package, tsconfig, lint, projeto do Vitest), RNG e JSON canônico com o teste de igualdade, params e `params/battle.json`, a arena e as três arenas, setup e `createBattle`, estado, `serialize`/`restore`, os comandos de intenção e virar, o movimento com o freio e a disputa, o esqueleto do `stepBattle` com os eventos, a `BATTLE_VERSION` | — |
| F2 | **O combate:** ataque corpo a corpo e projéteis, dano, morte e pilhas, largar e catar, a fuga pela borda, a inatividade, o fim, a entrada, `control` e `setGambits`, os eventos e o resultado, o log e o `replayLog` | — |
| F3 | **A IA e o auto-resolve:** o vocabulário dos gambits, o BFS, a esquiva, o tempo de reação, os presets; `geo battle sweep` e `verify`; os passos do CI | **Dono:** a matriz de confrontos, a duração, a inatividade e a fuga carregada, nos números, antes da página |
| F4 | **O laboratório:** as arenas 2× e as zonas de nascimento (C2), a reação por participante (C3), `lab.html`, o *worker*, o canal com latência, o render, o teclado, o setup, a troca de domínio, o reforço, o editor de gambits, os eventos e o resultado, o atraso medido, o export do log (e a *fixture* da CLI) | — |
| F5 | **Às cegas e o playtest:** o modo às cegas, o registro da sessão e o export, as perguntas do PLAYTEST | **Dono:** sessão livre e sessão às cegas; responde às perguntas 1 a 4 da hipótese e decide a próxima regra; fecha a fatia B (continua depois da F6) |
| F6 | **Os ajustes do checkpoint da F5** (C4–C7): o primeiro passo imediato, a inatividade da batalha, a `BATTLE_VERSION` 3 com o `sweep` e a *fixture* refeitos, o domínio que acaba com a batalha, a tela legível com o sinal do ataque, do golpe e do erro | — (o checkpoint da F5 retoma) |
