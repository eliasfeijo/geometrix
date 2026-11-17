# Tasks M2 — O laboratório de batalha

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Regra: uma task só é marcada `[x]` com os testes verdes (`npm run check`), no mesmo commit que a conclui. Cada fase
na sua branch (plan §17, skill `commit`), com merge `--no-ff` em `main`. A fatia B anda em paralelo à A: antes de
cada merge, conferir os pontos de contato do plan §16.

## F0 — Design, spec e plan (`m2/laboratorio-spec`)

- [x] Spec aprovada, com D1–D19; as decisões de gameplay no GDD (02, 06, 07) (2026-11-15)
- [x] ADR-0008 (pacote de batalha) aceito; scope `battle` na skill `commit` (2026-11-15)
- [x] **Checkpoint:** plan aprovado (decisões P1–P14, 2026-11-15)

## F1 — O pacote e o movimento (`m2/laboratorio-f1-package`)

- [x] `packages/battle`: `package.json`, tsconfig (o do `sim`), projeto do Vitest; as guardas do `eslint.config.js`
      valendo para `packages/battle/src` (ADR-0008, plan §11)
- [x] `rng.ts` e `canonical.ts` copiados do `sim`, com o teste de igualdade contra o `@geometrix/sim`
      (devDependency de teste) (plan P1)
- [x] `params.ts` (schema, `parseBattleParams`, `checkConsistency`: durações múltiplas do tick, `CELL_COST`
      divisível pelo tick), `params/battle.json` e o `test/params.json` do pacote (spec §6, plan §3)
- [x] `arena.ts`: parser do texto, anel de saída, trechos de entrada, vizinhos, linha livre; as três arenas em
      `params/arenas/`, simétricas por rotação de 180°, com um teste da simetria (plan §4)
- [x] `state.ts` e `setup.ts`: `BattleSetup`, a validação com motivo, `createBattle` com o nascimento pelo `rng`,
      `BATTLE_VERSION` 1 (spec S-1, S-2, plan §5, §8)
- [x] `serialize.ts`: `serializeBattle` e `restoreBattle` (recusa a versão errada e o que não é JSON) (spec S-3)
- [x] `commands.ts` (`intent`, `attackOnce`, `face`, validação e recusa sem efeito) e `movement.ts` (pontos, freio
      da carga, pedra e corpo que bloqueiam, disputa pelo `rng`) (spec M-1..M-3, plan §6, P4)
- [x] `events.ts` e o esqueleto do `stepBattle` (estágios 1 e 4 do pipeline), com os comandos valendo no tick
      seguinte; exports no `index.ts` (plan §7, P5)

### Registro da F1 (2026-11-17)

A fatia B não edita o dashboard (ele é da A enquanto as duas andam em paralelo): o que a F1 mediu e interpretou
fica aqui, e entra no "Registro das fases" do dashboard quando a B fizer o merge em `main`.

**Medições.** 2 400 ticks de um 3 × 3 na arena de pedras, só com o movimento (comandos sorteados): mediana de 3,3 ms
e p95 de 9,4 ms em 50 seeds, com outra sessão rodando testes. O orçamento da spec §7 (50 ms) só se mede na F3, com o
combate e a IA. Testes do pacote: 141, em 9 arquivos.

**Interpretações a validar** (detalhes que a spec e o plan deixam abertos; nenhuma muda uma decisão do jogador):

1. **As três arenas** (`params/arenas/`), 23 × 15, trechos de 7 células: **aberta** (sem pedras); **pedras** (um
   bloco de 3 no centro, dois pilares de cobertura perto de cada lado, duas barras curtas perto dos trechos 3 e 4);
   **corredor** (o vau: uma passagem de 3 de largura por 5 de comprimento no meio, murada até o anel, com pedra no
   anel também, para ninguém contornar pela saída; os trechos 3 e 4 ficam em margens opostas). A validar no
   checkpoint da F3 (a matriz por arena) e no playtest.
2. **Pontos de movimento:** zeram quando a intenção de andar para; o que passa do `CELL_COST` ao entrar fica de
   sobra (a velocidade média bate com a dos params); bloqueado ou perdendo a disputa, o creep segura `CELL_COST` e
   entra no tick em que a célula liberar.
3. **Ordem das disputas** de célula: pela id do primeiro candidato de cada disputa (o resultado de cada uma continua
   pelo `rng`, nunca pela id).
4. **Comando do humano para um participante que a IA comanda é recusado** (`validateCommand(state, cmd, issuer)`): a
   intenção que chega atrasada depois da troca de domínio não move o creep. A IA (F3) valida com `issuer` =
   `gambits`.
5. **Virar:** quem tem intenção de andar vira para lá no estágio 3, por cima de um `face` do mesmo tick.
6. **Estado** (plan §5, "os tipos exatos saem na F1"): `sides: { id, entry }[]`, porque um lado que entra depois
   pega o primeiro trecho livre (E-1) e o lado deixa de ser o número do trecho; sem o campo `status` (quem sai vai
   para `departed`); os participantes nascem sob os gambits, com a lista vazia: o preset entra no setup com a F3.
7. **Eventos:** carimbados com o tick que está sendo processado, como no `sim`. O vocabulário do plan §10 já está
   tipado; nenhum é emitido na F1.

**Pontos de atenção para o merge:** `eslint.config.js` (o glob das guardas e as mensagens, que agora falam de "a
simulation"), `package-lock.json` (o workspace novo). Com a suíte inteira e outra sessão rodando, dois testes da CLI
estouraram por tempo e passaram sozinhos (`main.test.ts` › verify, sem timeout explícito; `net.test.ts`, alvo de
CPU).

## F2 — O combate (`m2/laboratorio-f2-combat`)

- [x] `combat.ts`: recarga, corpo a corpo (atacar antes de andar), projéteis (nascer, andar, conferir a célula de
      partida, acertar o primeiro inimigo, parar na pedra e no alcance, atravessar aliado), dano, morte (spec
      A-1..A-5, plan §7, P3)
- [x] `carry.ts`: pilha na morte, largar a bolsa, catar até a capacidade, cristal primeiro (spec C-1, C-2, D8)
- [x] `exits.ts`: fuga pela borda (contagem zerada por golpe), inatividade (zerada por dano dado ou recebido), fim
      com o lado vencedor ou sem vencedor; batalha acabada não avança (spec F-1..F-4, D7, D9)
- [x] Comandos `join`, `control`, `setGambits` (a lista copiada campo a campo); entrada com o `rng` e o lado novo
      (spec E-1, D11, D12, plan §6)
- [x] Eventos completos e o desfecho no `ended`; `totals` de dano por participante (spec D19, F-3, plan §10)
- [x] `log.ts`: `BattleLog` e `replayLog`; teste de 2 execuções e snapshot → restore no meio com o mesmo hash (spec
      R-2, plan §11)

### Registro da F2 (2026-11-17)

Como na F1, o registro fica aqui e entra no "Registro das fases" do dashboard no merge da B em `main`.

**Medições.** 2 400 ticks de um 3 × 3 na arena de pedras, com comandos sorteados (andar, atacar, virar, largar,
catar), a saída e a inatividade esticadas para a batalha durar: mediana de 4,6 ms e p95 de 12–16 ms em 50 seeds (duas
rodadas), com ~0,8 projétil no ar em média. O orçamento da spec §7 (50 ms) se mede na F3, com a IA. Testes do pacote:
234, em 15 arquivos (eram 141). Uma propriedade sobre 40 batalhas inteiras confere os eventos (carimbo e posição no
tick, um `ended` por último), os `totals` (a soma dos golpes e o HP que cada um perdeu), um evento por saída e a carga
conservada entre os resultados e as pilhas.

**Interpretações a validar** (detalhes que a spec e o plan deixam abertos):

1. **Golpes simultâneos no tick:** os estágios 3 (corpo a corpo) e 5 (projéteis) só registram os golpes, e o estágio 6
   aplica todos. Dois que se batem no mesmo tick acertam os dois, qualquer que seja a id; quem chega a 0 ainda anda
   no estágio 4 e morre onde está. A ordem de aplicação (corpo a corpo pela id do atacante, depois projéteis pela id)
   só decide quem leva o crédito da morte; um golpe em quem já chegou a 0 no mesmo tick se perde (o projétil some).
2. **Dano contado é o que tirou do HP:** o `hit` e os `totals` levam o dano efetivo (o excesso não conta).
3. **Recarga:** desconta antes de atacar, então uma recarga de n ticks dá um ataque a cada n ticks; o ataque que erra
   também gasta a recarga; qualquer ataque consome o *latch*.
4. **Corpo a corpo com alcance:** velocidade 0 acerta o primeiro inimigo na linha livre até o alcance (com alcance 1,
   a célula da frente); aliado não bloqueia, como no projétil.
5. **Projétil:** nasce na célula da frente, que é a 1ª do alcance; sobre pedra ou fora da grade, não nasce (o
   `attacked` sai assim mesmo); ganha pontos já no tick em que nasce, pela velocidade do DNA do dono; some quando
   passaria do alcance (fica na última célula o tempo normal); sobrevive ao dono, e o golpe é creditado a ele.
6. **Saída e inatividade no mesmo tick:** vale a borda (o creep escolheu). O morto sai com carga zero no `departed`
   (ela ficou na pilha).
7. **Largar e catar** agem uma vez; se os dois chegam no mesmo tick, vale o último.
8. **Troca de domínio** (`control`): zera a intenção (andar, atacar, *latch*, largar, catar) de quem troca, e os
   gambits decidem já no tick da troca; trocar para o mesmo controlador não faz nada nem gera evento; o `human` num
   participante solta o anterior (o evento da soltura vem antes).
9. **Entrada** (`join`): um lado sem ninguém na arena perdeu e não recebe reforço (quem chega depois entra como lado
   novo); o lado novo pega o primeiro trecho que nenhum lado com gente na arena usa; `maxSides` conta os lados com
   gente na arena, e `maxPerSide` os vivos do lado. Os comandos do laboratório (`join`, `control`, `setGambits`)
   são recusados se vierem dos gambits.
10. **`setGambits`** vale para qualquer participante, inclusive o dominado (ele guarda a lista para quando for
    solto); `permille` em 0..1000, `cells` ≥ 0.
11. **`BattleLog`** ganhou `ticks` (o plan §11 não tem): uma batalha pode parar antes do fim (o laboratório pausa ou
    reinicia). O `replayLog` recusa um log cuja batalha acaba antes dele e aceita `until` e `from` (o snapshot →
    restore do `geo battle verify` da F3). Os comandos recusados ficam no log: o replay os recusa do mesmo jeito.
12. **`departed`** fica ordenado por id (S-3), não pela ordem das saídas (o `tick` de cada saída está nele).
13. **`BATTLE_VERSION` continua 1:** nenhum log foi exportado ainda.

**Pontos de atenção para o merge:** `apps/cli/test/net.test.ts` mudou (commit `test(cli)` próprio): o alvo de CPU do
`geo net` estourou duas vezes com a suíte inteira e outra sessão rodando; o teste agora exige banda e propriedade, e
confere que o código de saída e a linha `FAIL: cpu` seguem o veredito de CPU. Resolve a pendência viva "Testes
sensíveis a tempo" do dashboard (tirar de lá no merge). Fora isso, a F2 só toca em `packages/battle` e neste arquivo.

## F3 — A IA e o auto-resolve (`m2/laboratorio-f3-gambits`)

- [ ] `view.ts` (`BattleView`) e `gambits.ts`: o vocabulário, a avaliação (1ª regra possível), os alvos sem
      desempate pelo id, o tempo de reação pelo `rng` (spec G-1, G-2, D14, plan §9, P12, P13)
- [ ] As ações: BFS até alinhar, manter distância, esquivar, proteger, fugir, largar, catar; um teste por condição e
      por ação, em arenas de texto
- [ ] `presets.ts`: linha de frente, atirador, escaramuçador, portador; padrões por DNA (spec G-3, D15)
- [ ] `apps/cli/src/battle.ts`: `geo battle sweep` com a matriz, `battle.md` e `battle.csv` (vitórias por confronto
      e arena, espelhos, duração, inatividade, borda, fuga carregada, custo) (spec R-1, §7, plan §12)
- [ ] `geo battle verify` (amostra da matriz, 2 execuções e snapshot → restore; e `--log`) e os passos do CI
      (`verify` nas seeds 1, 42, 649; o orçamento do `sweep --quick`) (spec R-2, R-3, plan §12)
- [ ] **Checkpoint:** o dono lê a matriz, a duração, a inatividade e a fuga carregada no relatório, antes da página

## F4 — O laboratório (`m2/laboratorio-f4-lab`)

- [ ] `lab.html` como 2ª entrada do Vite, `npm run lab`, servida também pelo `npm run server` (plan §13, P11)
- [ ] `worker.ts`: o relógio sem deriva, ×1/×4/instantâneo, pausar e reiniciar, a visão e os eventos por tick, o log
      e o hash no fim (Web Crypto) (plan §13, P10)
- [ ] `channel.ts`: atraso por perna, jitter, ordem preservada, com teste em relógio falso; o seletor de RTT e o
      tamanho médio da visão (spec L-3, L-4, D17, plan P6, P7)
- [ ] `arena-view.tsx`: as formas pelo DNA, a direção, a barra de HP, a carga, os projéteis, as pedras, a saída, os
      trechos, as pilhas, a contagem da fuga, o relógio de inatividade perto de estourar; interpolação com o botão
      (spec L-8, plan P8, P9)
- [ ] `input.ts`: o teclado → intenção, *latch*, virar, largar, catar, trocar e soltar o domínio; o atraso medido
      (mediana e p95) (spec L-2, L-4, D13)
- [ ] `setup-form.tsx`, o reforço, o `gambits-editor.tsx`, a lista de eventos e a tabela de resultado (spec L-1,
      L-6, L-7, L-8)
- [ ] Export do `BattleLog`; um log exportado entra como *fixture* do teste da CLI (`geo battle verify --log`) (spec
      R-3)

## F5 — Às cegas e o playtest (`m2/laboratorio-f5-playtest`)

- [ ] `session.ts`: o registro de cada batalha (setup, domínio, desfecho, RTT, nota) no `localStorage` com
      `try/catch`, o export em JSON, o resumo nota × RTT e vitórias dominando × IA (spec L-5, plan P14)
- [ ] O modo às cegas: o RTT sorteado pela página e escondido, a nota de 1 a 5 antes de revelar (spec D17)
- [ ] Perguntas do laboratório no [PLAYTEST.md](../../PLAYTEST.md) (spec §8)
- [ ] **Checkpoint:** sessão livre e sessão às cegas do dono (pelo menos 5 batalhas por RTT); ele responde às
      perguntas 1 a 4 da hipótese e decide a próxima regra (livre, forja ou nenhuma antes da junção); fecha a fatia B
