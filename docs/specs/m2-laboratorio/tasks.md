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

- [x] `view.ts` (`BattleView`) e `gambits.ts`: o vocabulário, a avaliação (1ª regra possível), os alvos sem
      desempate pelo id, o tempo de reação pelo `rng` (spec G-1, G-2, D14, plan §9, P12, P13)
- [x] As ações: BFS até alinhar, manter distância, esquivar, proteger, fugir, largar, catar; um teste por condição e
      por ação, em arenas de texto
- [x] `presets.ts`: linha de frente, atirador, escaramuçador, portador; padrões por DNA (spec G-3, D15)
- [x] `apps/cli/src/battle.ts`: `geo battle sweep` com a matriz, `battle.md` e `battle.csv` (vitórias por confronto
      e arena, espelhos, duração, inatividade, borda, fuga carregada, custo) (spec R-1, §7, plan §12)
- [x] `geo battle verify` (amostra da matriz, 2 execuções e snapshot → restore; e `--log`) e os passos do CI
      (`verify` nas seeds 1, 42, 649; o orçamento do `sweep --quick`) (spec R-2, R-3, plan §12)
- [x] **Checkpoint:** o dono lê a matriz, a duração, a inatividade e a fuga carregada no relatório, antes da página
      (dono, 2026-11-17, depois de ver os replays: decisões no fim do registro abaixo e no plan §15, C1–C3)

### Registro da F3 (2026-11-17)

Como na F1 e na F2, o registro fica aqui e entra no "Registro das fases" do dashboard no merge da B em `main`.

**Medições** (`geo battle sweep`, seeds 1–100, 22 cenários × 3 arenas = 6 600 batalhas, em 10,6–10,8 s; duas
rodadas com os mesmos desfechos). Para ler: `npm run geo -- battle sweep` e abrir `runs/<id>/battle.md`.

| Critério (spec §7) | Alvo | Medido |
|---|---|---|
| O DNA não decide sozinho | nenhum DNA acima de 75% no mesmo par nas três arenas | **reprova:** quadrado vence o triângulo em 100% nas três |
| Duração do 1 × 1 (mediana) | 15–90 s | **reprova:** 13,6 s (de 12,3 s no quadrado × triângulo a 18,8 s no quadrado × círculo na aberta) |
| Duração do 3 × 3 (mediana) | até 120 s | 23,9 s |
| Custo do 3 × 3 por 2 400 ticks (mediana) | até 50 ms | 22,5–23,5 ms (era ~48 ms antes do cache das distâncias, commit `perf`) |
| Espelhos (o lado não decide) | ~50% | 37–59% para o lado A em 9 casos de 100 batalhas; o quadrado espelhado tem 11–17% sem vencedor (os dois morrem no mesmo tick) |
| O ferido pesa | muda a taxa | sim, sempre: o lado a 500‰ perde de 74% a 100% |
| Inatividade | o dono julga | quase nenhuma: 0% nos 1 × 1, até 4% no 3 × 3 |
| Fuga carregada (quadrado cheio × círculo) | o dono julga | do trecho de entrada, 100% escapa em 2,6 s; do centro, 88% na aberta, 5–9% nas pedras, 22% no corredor, **com ou sem largar a bolsa** |

Vitórias do 1 × 1 de HP cheio (A / B): quadrado × triângulo 100/0 nas três; quadrado × círculo 19/81 (aberta),
92/8 (pedras), 80/20 (corredor); triângulo × círculo 39/61, 77/23, 46/54. O `verify` passa nas seeds 1, 42 e 649
(18 casos; 5,8 s). O `sweep --quick` do CI (660 batalhas) leva 1,2 s. Testes: 2 611 no total (eram 2 571 no começo
da fase).

**Interpretações a validar** (detalhes que a spec e o plan deixam abertos):

1. **Decididas pelo dono na abertura da fase:** "proteger", já na posição, vira para o inimigo e ataca se ele estiver
   alinhado; as distâncias de "inimigo a até N", "aliado ferido a até N" e "o mais perto" são em passos contornando
   pedra (os corpos não contam, porque se mexem). A composição da matriz ficou comigo (o dono pediu): os cenários e o
   que cada um mede estão no comentário de `GROUPS` em `apps/cli/src/battle.ts`.
2. **A lista de gambits está no setup de cada participante** (`ParticipantSetup.gambits`), não só o nome do preset: um
   log exportado repete a batalha mesmo que um preset mude depois. Os presets são só o padrão de quem monta (G-3).
3. **Quase alinhado, a IA espera metade das vezes** (um sorteio do `rng`): sem isso, dois atiradores a uma fileira de
   distância trocavam de fileira para sempre e a luta acabava por inatividade, sem golpe.
4. **As ações que param num lugar nunca param no anel de saída** (só "fugir" mira o anel; "catar" aceita uma pilha no
   anel): o atirador parava na borda para atirar e fugia sem querer.
5. **Os empates** (alvo, primeiro passo do caminho, esquiva, aliado a proteger) vão pelo `rng`, nunca pelo id; o alvo
   empatado mantém o anterior antes do sorteio.
6. **A visão (`BattleView`)** é uma cópia, sem o `rng`, as intenções, os pontos de movimento e a memória da IA. Toda
   decisão de um tick lê a visão do começo do estágio 2, e a IA decide no próprio tick em que recebe o creep de volta.
7. **Sem regra possível, o creep fica parado** (a intenção zera); entre duas decisões ele mantém a intenção, inclusive
   a de atacar na direção em que olha.
8. **"Manter distância"** mira as células alinhadas com o alvo entre alcance − 1 e alcance; onde a pedra corta essas
   linhas, qualquer célula alinhada serve.
9. **Veredito "o DNA não decide sozinho":** reprova só se o **mesmo** DNA passa de 75% nas três arenas. Quadrado ×
   círculo passa de 75% nas três, mas com vencedores diferentes (a arena decide).
10. **Fuga carregada do centro:** o harness move o quadrado para o centro depois do setup (do trecho de entrada, a
    saída está a um passo). É só do relatório, não é regra.
11. **`BATTLE_VERSION` continua 1:** o setup mudou de formato (a lista de gambits), mas nenhum log foi exportado ainda.

**Para o checkpoint (o dono responde):**

1. **Quadrado × triângulo, 100% a 0%.** O triângulo para e atira, e o quadrado chega e bate. Mexo no preset do
   triângulo (por exemplo, "manter distância" como o círculo), nos números do `battle.json`, ou deixo como está?
2. **Lutas curtas.** O 1 × 1 dura ~14 s na mediana (o alvo era 15–90 s). Aceita, ou aumento o HP (ou diminuo o dano)?
3. **Fugir no começo é de graça.** Todo mundo nasce a um passo da saída, então qualquer um sai em 2,6 s antes de o
   inimigo chegar. No laboratório isso é ok, ou o nascimento deveria ser mais para dentro da arena?
4. **Na borda, sob fogo, ninguém sai.** Cada golpe zera os 2 s de saída, e o círculo atira a cada 0,8 s: o quadrado
   que chega à borda com um círculo atirando nele morre lá. Por isso largar a bolsa quase não muda a fuga carregada.
   É o que você quer?

**Decisões do checkpoint (dono, 2026-11-17).** O dono pediu para ver antes de responder: uma página de replays
(sete batalhas da matriz, geradas pela simulação, uma por pergunta) mostrou cada caso.

1. Quadrado × triângulo a 100% é **justo**: o corpo a corpo vence se não for *kitado*. Não se balanceia combate cru
   antes de skills, nível e stats; o laboratório serve para experimentar e validar as regras candidatas.
2. As lutas de ~14 s estão **boas**: prolongar combate cru, sem variedade de mecânicas, seria chato.
3. **Arenas 2× maiores e zonas de nascimento** a meio caminho entre a borda e o centro (a 1/4 da largura), longe da
   saída; uma aberta 3× para comparar. Vai para a 1ª task da F4.
4. Ficar preso na borda sob fogo **não é problema**, desde que a dificuldade do bot seja configurável: reação por
   participante (fácil 600 ms, normal 250 ms, difícil 100 ms; spec D20). Uma IA que aprende ("começa burra e vai
   ficando esperta") fica como proposta sem marco no GDD 06.
5. O 3 × 3 é uma boa luta para o escopo (só o ataque básico).

No relatório, "o DNA não decide sozinho" e "duração" passam a "fora do chute (informativo)"; só o custo reprova
(commit `fix(cli)` próprio).

**Pontos de atenção para o merge:** `apps/server/test/ws.test.ts` ganhou timeout explícito (commit `test(server)`
próprio: estourou os 5 s duas vezes seguidas com a suíte inteira e outra sessão rodando); `.github/workflows/ci.yml`
(dois passos novos no fim); `apps/cli/src/main.ts` (o subcomando `battle` e o texto do `USAGE`);
`apps/cli/package.json` e `package-lock.json` (a CLI depende do `@geometrix/battle`).

## F4 — O laboratório (`m2/laboratorio-f4-lab`)

- [x] As arenas 2× (43 × 27) com as zonas de nascimento a 1/4 da largura, e uma aberta 3× (63 × 39) só para o
      relatório; o teste de simetria de 180°; o `sweep` de novo (duração, inatividade, fuga, custo) e os replays, para
      o dono ver antes da página (spec D3, §6; plan §4, C2)
- [x] A reação por participante: `fácil`/`normal`/`difícil` no setup, os números em `params/battle.json`, o
      `rng` sorteando a reação de cada decisão (spec D20; plan C3)
- [x] `lab.html` como 2ª entrada do Vite, `npm run lab`, servida também pelo `npm run server` (plan §13, P11)
- [x] `worker.ts`: o relógio sem deriva, ×1/×4/instantâneo, pausar e reiniciar, a visão e os eventos por tick, o log
      e o hash no fim (Web Crypto) (plan §13, P10)
- [x] `channel.ts`: atraso por perna, jitter, ordem preservada, com teste em relógio falso; o seletor de RTT e o
      tamanho médio da visão (spec L-3, L-4, D17, plan P6, P7)
- [x] `arena-view.tsx`: as formas pelo DNA, a direção, a barra de HP, a carga, os projéteis, as pedras, a saída, os
      trechos, as pilhas, a contagem da fuga, o relógio de inatividade perto de estourar; interpolação com o botão
      (spec L-8, plan P8, P9)
- [x] `input.ts`: o teclado → intenção, *latch*, virar, largar, catar, trocar e soltar o domínio; o atraso medido
      (mediana e p95) (spec L-2, L-4, D13)
- [x] `setup-form.tsx`, o reforço, o `gambits-editor.tsx`, a lista de eventos e a tabela de resultado (spec L-1,
      L-6, L-7, L-8)
- [x] Export do `BattleLog`; um log exportado entra como *fixture* do teste da CLI (`geo battle verify --log`) (spec
      R-3)

### Registro da F4 (2026-11-17)

Como nas fases anteriores, o registro fica aqui e entra no "Registro das fases" do dashboard no merge da B em `main`.

**As arenas 2× e a reação** (`geo battle sweep`, seeds 1–100, 23 cenários × 4 arenas = 9 200 batalhas em 35 s). Os
replays de seis batalhas da matriz, gerados pela simulação, estão numa página para o dono
([replays das arenas 2×](https://claude.ai/artifact/EgpQW7gEeBHmfXZL2TZ8Xj)).

| O quê | Na F3 (arenas 21 × 13, trecho na borda) | Na F4 (43 × 27, zona a 1/4) |
|---|---|---|
| Duração do 1 × 1 (mediana) | 13,6 s | 15,6 s |
| Duração do 3 × 3 (mediana) | 23,9 s | 28,3 s |
| Custo do 3 × 3 por 2 400 ticks (mediana; alvo 50 ms) | 22,5–23,5 ms | 38–39 ms (76 ms na aberta 3×, que fica só no relatório) |
| Quadrado × círculo (A / B: aberta, pedras, corredor) | 19/81, 92/8, 80/20 | 0/100, 2/98, 0/100: com espaço, o círculo *kita* |
| Triângulo × círculo | 39/61, 77/23, 46/54 | 43/57, 68/31, 41/59 |
| Fuga carregada (quadrado cheio × círculo) | do trecho, 100% escapa | da zona, 3–8% escapa |
| Inatividade | 0% no 1 × 1, até 4% no 3 × 3 | 0–1% no 1 × 1, 7–20% no 3 × 3 |
| Espelho difícil × fácil (vitórias do difícil) | — | quadrado 81–85%, triângulo 83–95%, círculo 94–99% |

Quadrado × triângulo continua 100/0 nas três. Na fuga carregada, largar a bolsa não muda nada: o círculo mantém
5 células ou mais de distância, e a regra do portador ("inimigo a até 4 → largar") nunca dispara.

**Interpretações a validar:**

1. **A zona de nascimento** é um bloco de 3 × 5 células (15, o bastante para 5 por lado): as zonas 1 e 2 nas colunas
   10–12 e 32–34, no meio da altura; as 3 e 4 nas fileiras 6–8 e 20–22, no meio da largura (no corredor, as 3 e 4
   ficam em margens opostas do vau). Quem nasce olha para longe da borda mais próxima da zona (pela soma das
   distâncias, sem centroide); uma zona tão perto de duas bordas é recusada. O formato do texto não mudou.
2. **As pedras em 2×:** o bloco central de 3 × 5, um par de pilares de 2 × 3 de cobertura à frente das zonas 1 e 2,
   e barras curtas à frente das zonas 3 e 4, com uma brecha no meio. **O corredor:** um muro de 11 de espessura que
   desce até o anel, com o vau de 5 de largura no meio.
3. **A fuga carregada sai da zona:** o harness não move mais o quadrado para o centro (a zona já fica longe da saída).
4. **A dificuldade** fica no setup de cada participante (`reaction`, também no `join`) e no estado; a visão a mostra.
   O sweep usa o normal, salvo os espelhos difícil × fácil (grupo novo, "a dificuldade pesa").
5. **`BATTLE_VERSION` continua 1:** o setup mudou de formato (`reaction`) antes do primeiro log exportado. **Daqui em
   diante, ele sobe** quando o mesmo log passar a dar outro resultado: a *fixture* do laboratório
   (`apps/cli/test/fixtures/lab-battle.json`) é o primeiro log guardado, e o teste dela falha se a regra mudar sem a
   versão subir.

**Pendente de confirmação do dono:** o *jitter* de cada nível (fácil 600 ± 250 ms, normal 250 ± 100, difícil
100 ± 50). A spec só dá o período; usei a proporção do normal (40%).

**O laboratório** (`npm run lab`, ou `npm run build` + `npm run server` e `/lab`). Medido no Chromium headless,
dirigido pelo CDP (o 1 × 1 padrão nas pedras, dominando o quadrado com as setas e o espaço, 43–45 teclas por
batalha, a interpolação ligada):

| RTT | Tecla → tela, mediana | p95 | Esperado (RTT + 1 tick de interpolação + até 1 tick de espera) |
|---|---|---|---|
| 0 ms | 77 ms | 97 ms | 50–100 ms |
| 100 ms | 188 ms | 211 ms | 150–200 ms, ± 20% de *jitter* do RTT |
| 300 ms | 396 ms | 439 ms | 350–400 ms, ± 60 ms de *jitter* |

Sem acúmulo ao longo da batalha (o p95 fica a ~20–40 ms da mediana). A visão de cada tick tem ~0,6 KB (2 ou 3
participantes; o plan P6 estimava 2–4 KB para uma dúzia). O build: o worker sai com 26 KB, a página com 37 KB. O log
exportado dessa sessão (com domínio, reforço num lado novo e a troca de gambits) dá na CLI o hash que o worker
calculou com o Web Crypto (R-3). **Custo do 3 × 3 por reação** (mediana por 2 400 ticks, 120 batalhas): fácil 30 ms,
normal 38 ms, **difícil 65 ms** (acima dos 50 ms; o critério da spec mede o auto-resolve com o normal). Testes: 2 664
no total (eram 2 618 no começo da fase), 41 deles do laboratório.

**Interpretações a validar (o laboratório):**

6. **O canal mora na página:** as duas pernas são simuladas na *thread* principal, entre a página e o worker. Só os
   comandos de batalha (os do teclado, `control`, `join`, `setGambits`) e os quadros atravessam; os controles do
   laboratório (começar, pausar, velocidade, exportar) e o pedido da lista de gambits para o editor vão direto.
7. **O atraso medido** vai da tecla até a chegada do quadro do tick que aplicou o comando, mais um tick quando a
   interpolação está ligada (o creep chega à célula no fim do deslize).
8. **A interpolação** desliza por um tick na velocidade atual (50 ms a ×1, 12,5 ms a ×4); quem entra, ou pula mais de
   duas células, aparece direto na célula.
9. **O teclado só vale com a arena em foco** (um clique nela): fora dela, o Tab navega pela página como sempre. Perder
   o foco solta as teclas. Dominar alguém no modo instantâneo volta a velocidade para ×1; o instantâneo fica
   desligado enquanto alguém está dominado.
10. **O relógio do worker** recupera até 40 ticks atrasados de uma vez (uma aba em segundo plano, um *debugger*); além
    disso, recomeça a contar de agora em vez de correr.
11. **O formulário:** o HP inicial em 100, 75, 50 ou 25%; a carga só de matéria (o cristal fica de fora); vinte nomes
    próprios do laboratório (Ária, Brasa, Cobre…), na ordem do setup e depois para os reforços. O reforço escolhe entre
    os lados com alguém na arena ou um lado novo (C, D).
12. **As cores dos lados C e D:** verde-limão e magenta, depois do azul e do laranja dos times do mundo.
13. **O relógio de inatividade** aparece perto do creep depois de 2/3 do tempo (10 s de 15 s), como um arco vermelho
    que encolhe.
14. **O servidor serve a página também em `/lab`**, além de `/lab.html`.

**Pontos de atenção para o merge:** `apps/client/vite.config.ts` (a 2ª entrada), `package.json` (o `npm run lab`),
`apps/client/package.json` e `package-lock.json` (o cliente depende do `@geometrix/battle`),
`apps/server/src/http.ts` (o `/lab`). O `params/arenas/` mudou (as três arenas 2× e a aberta 3×), e o hash de
referência do `serialize.test.ts` da batalha também.

## F5 — Às cegas e o playtest (`m2/laboratorio-f5-playtest`)

**Abertura (dono, 2026-11-17, depois de jogar o laboratório da F4):** com 300 ms e a interpolação ligada, "rodou
suave"; o que atrapalha é chegar à luta. Hoje é preciso começar, correr para pausar, dominar, continuar e clicar na
arena para o teclado valer, e o aliado já está morrendo. A nota às cegas mediria essa correria, não a latência.
Decidido: a **contagem de 3 s** no começo é regra da batalha (spec D21, S-4; GDD 06) e a sessão às cegas usa **um
setup único** (spec §8). O resto do pacote abaixo é do laboratório (sem gameplay).

- [x] A contagem do começo (spec D21, S-4): um parâmetro em `params/battle.json` (e nos params de teste), em que só
      o `face` vale, do humano e da IA; o evento ou o campo da visão que a página precisa para mostrá-la; a
      `BATTLE_VERSION` sobe para 2 (o mesmo log passa a dar outro resultado), o hash de referência e a *fixture* do
      laboratório refeitos (um log novo exportado da página). **Interpretações a validar:** o relógio de inatividade
      começa a correr no fim da contagem; largar e catar também esperam a contagem; quem entra no meio da luta não
      ganha contagem própria
- [x] A UX do combate humano: escolher no setup quem o dono domina desde o começo (ou "só assistir"), e o Começar e
      o Reiniciar já dominam; o teclado vale na página inteira durante a batalha, salvo com o foco num campo do
      formulário (sem clicar na arena); atalhos para reiniciar (R) e pausar (Esc ou P); a contagem visível na arena
- [x] `session.ts`: o registro de cada batalha (setup, domínio, desfecho, RTT, nota) no `localStorage` com
      `try/catch`, o export em JSON, o resumo nota × RTT e vitórias dominando × IA (spec L-5, plan P14)
- [x] O modo às cegas: o RTT sorteado pela página e escondido, a nota de 1 a 5 antes de revelar (spec D17). Um
      setup único na sessão (dono); o sorteio sem repetição (5 de cada RTT embaralhados, com quantas faltam); o
      atraso medido escondido até a nota (ele entregaria o RTT); "próxima batalha" num toque, com o mesmo setup e o
      próximo RTT
- [x] Perguntas do laboratório no [PLAYTEST.md](../../PLAYTEST.md) (spec §8)
- [ ] **Checkpoint:** sessão livre e sessão às cegas do dono (pelo menos 5 batalhas por RTT); ele responde às
      perguntas 1 a 4 da hipótese e decide a próxima regra (livre, forja ou nenhuma antes da junção); fecha a fatia B

### Registro da F5 (2026-11-17)

Como nas fases anteriores, o registro fica aqui e entra no "Registro das fases" do dashboard no merge da B em `main`
(que fecha a fatia, depois do checkpoint).

**A contagem do começo** (`start.countdownMs` = 3 000 em `params/battle.json`; `BATTLE_VERSION` 2). O `geo battle
sweep` (seeds 1–100, 9 200 batalhas em 45 s), comparado com a F4:

| O quê | Na F4 | Na F5 (com a contagem) |
|---|---|---|
| Duração do 1 × 1 (mediana) | 15,6 s | 18,6 s |
| Duração do 3 × 3 (mediana) | 28,3 s | 32,0 s |
| Custo do 3 × 3 por 2 400 ticks (mediana; alvo 50 ms) | 38–39 ms | 38 ms |
| Inatividade no 3 × 3 (aberta, pedras, corredor) | 7–20% | 7%, 19%, 2% |
| Triângulo × círculo (A / B: aberta, pedras, corredor) | 43/57, 68/31, 41/59 | 49/51, 66/34, 49/51 |
| Quadrado × círculo, quadrado × triângulo, fuga carregada | — | iguais aos da F4 (0–2/98–100, 99–100/0–1, 2–7% escapa) |

A duração sobe pelos 3 s parados; o resto mexe só onde a IA decide diferente (ela vira e sorteia a reação durante a
contagem, o que muda a ordem do `rng`). A *fixture* do laboratório foi refeita: um log exportado da página no
Chromium a 300 ms de RTT, com teclas durante a contagem, o domínio, um reforço num lado novo e a troca de gambits, que
dá na CLI o hash do worker.

**O laboratório**, conferido no Chromium headless dirigido pelo CDP: o Começar já domina (o `control` atravessa a
rede durante a contagem); o "3, 2, 1" aparece sobre a arena; as setas andam sem clicar na arena; P pausa, Esc
continua, R reinicia já dominando; um R com o foco no campo da seed não reinicia. O registro da sessão guardou
batalhas assistidas e dominadas e sobreviveu a recarregar a página; a sessão às cegas escondeu o RTT, o atraso medido
e o esperado até a nota, revelou depois, abriu a próxima com Enter, ofereceu a próxima depois de recarregar e
mostrou a tabela nota × RTT ao encerrar. Testes: 2 686 no total (eram 2 664 no fim da F4).

**Interpretações a validar:**

1. **A contagem:** durante ela, os comandos, a IA e o virar rodam (o humano e a IA miram); ataque, movimento,
   largar e catar esperam, e a saída pela borda e o relógio de inatividade só começam a contar no fim. O que foi
   pedido na contagem (uma tecla segurada, o *latch* do espaço, um largar) sai no primeiro tick da luta. Quem entra
   durante a contagem espera por ela; quem entra depois não ganha contagem própria. A página lê a contagem de um
   campo da visão (`countdownTicks`), sem evento novo.
2. **Os params de teste** do pacote têm a contagem em 0, para as regras continuarem testadas desde o tick 0; os
   testes da contagem a ligam.
3. **Quem o dono domina** é escolhido no formulário ("você joga com"), por padrão o primeiro participante do lado A;
   o id vem da posição no setup (a batalha numera os participantes do setup a partir de 1).
4. **O teclado na página:** fica com o formulário só num campo de texto ou número, num seletor ou com Ctrl, Alt ou
   Meta (o Ctrl + R ainda recarrega). O Tab, durante a batalha, troca o domínio em vez de navegar.
5. **As batalhas numeradas:** depois de um R, uma tecla ainda em trânsito da batalha anterior e os quadros dela são
   descartados, em vez de cair na nova.
6. **O registro:** só a batalha que acaba entra; o RTT é o do começo da batalha. "Você × IA" compara as vitórias do
   lado que o dono dominou do começo ao fim com as da IA no mesmo lado, nas batalhas do mesmo confronto (a arena, os
   DNAs e o HP de cada lado) em que ele só assistiu. Trocar ou soltar o domínio no meio tira a batalha das duas
   contas.
7. **A sessão às cegas:** o setup único inclui a seed; o RTT é sorteado no começo de cada batalha (recarregar no meio
   dela perde aquele sorteio, e o saco segue); R reinicia com o mesmo RTT escondido; a nota pelas teclas 1 a 5, a
   próxima com Enter ou N; a tabela nota × RTT fica escondida até encerrar a sessão, para não ancorar as notas. A
   mediana de um número par de notas é a média das duas do meio; o "até onde a nota fica em 4 ou mais" para no
   primeiro RTT que cai abaixo de 4.
8. **O setup sugerido** para a sessão às cegas, no PLAYTEST: ▲ (você) × ● (IA normal) nas pedras, o duelo à
   distância em que mirar e desviar mais sentem o atraso.

**Aguardando o dono (o checkpoint):**

1. A **sessão livre** e a **sessão às cegas** (`npm run lab`; o roteiro no [PLAYTEST.md](../../PLAYTEST.md), seção
   "Laboratório de batalha (M2)"), com o **"Exportar sessão"** no fim.
2. As **perguntas 1 a 4 da hipótese** (spec §1) e a **próxima regra**: a livre, a forja ou nenhuma antes da junção.
3. As **interpretações 1 a 8** acima, e o *jitter* da reação de cada nível, pendente da F4 (fácil 600 ± 250 ms,
   normal 250 ± 100, difícil 100 ± 50).

### Checkpoint, 1ª parte (dono, 2026-11-18): grupos 0 a 3

O dono achou o roteiro do laboratório difícil de seguir; ele foi reorganizado em **grupos** de tarefas, um de cada
vez, na ordem das dependências ([PLAYTEST.md](../../PLAYTEST.md), "Laboratório de batalha (M2)", grupos 0 a 8). A
sessão parou no grupo 3: os achados pedem mudanças de regra e de tela antes do resto, e elas vão para a **F6**
(abaixo). O export da 1ª parte é o `sessao-lab-2026-11-18-03-28.json` (38 batalhas), na pasta Downloads do dono,
fora do repo.

**Grupo 1** (9 duelos dominando, RTT 0, IA normal, seed 1, com as regras da `BATTLE_VERSION` 2):

| Você × IA | pedras | aberta | corredor |
|---|---|---|---|
| ■ × ● | perdeu sem dar um golpe | perdeu | perdeu |
| ▲ × ● | venceu ("botei pra correr") | perdeu (não viu o HP descendo) | perdeu (o W que não andava) |
| ● × ■ | venceu | venceu | venceu sem levar dano |

Notas: **F1 3** (sabe por que perde, em geral pelo confronto ■ × ●; na 8, ficou parado apertando W por 2–3 s sem
sentido), **F2 3** (o tiro é previsível e dá para desviar; "uma certa sensação de lentidão que trava o movimento";
não balancear a velocidade do tiro antes das skills), **F5 4** (a contagem melhorou bastante a preparação). O ▲ foi
o DNA que ele quis jogar de novo ("o único que não é cheese"); ■ × ● pareceu decidido de antemão; "a IA do círculo
pode ser ajustada"; a barra de HP quase não se vê na tela do notebook.

**Grupo 2** (IA × IA, 3 seeds sorteadas por confronto), com as batalhas 1 e 2 do grupo 1 contadas à mão (o registro
as marcou como "trocou de domínio": alguma troca ou soltura no meio, provavelmente um Tab, um 0 ou um clique em
"dominar"/"soltar" pelo hábito da F4):

| Confronto (você no A), nas 3 arenas | Você | A IA no seu lugar |
|---|---|---|
| ■ × ● | 0/3 | 0/9 |
| ▲ × ● | 1/3 | 4/9 |
| ● × ■ | 3/3 | 8/9 |

Dois dos três 1 × 1 são decididos pelo DNA; só o ▲ × ● está aberto, e ali o dono e a IA ficaram parecidos. Com uma
batalha dele por confronto, ainda não diz se a micro pesa.

**Grupo 3** (assistir um 3 × 3 nas pedras e um 1 × 1 × 1 na aberta): **F3 "não"** ("tudo muito confuso e pequeno
demais para eu conseguir enxergar"); **F4 sem nota** ("foi muito rápido, mesmo no ×1": não deu para ver por que o
■ Ária fugiu por inatividade). No 3 × 3, "confusão total": o projétil some sem sinal de acerto ou de erro. No
1 × 1 × 1, o ▲ fugiu por inatividade sem acertar nem levar tiro, "de novo essa fuga por inatividade estragando a
luta". Faltou um sinal visual e/ou sonoro do começo, do meio e do fim do ataque (o disparo e o golpe, pelo menos).

**Achados e decisões** (plan §15, C4 a C8):

1. **O W que não andava** (grupo 1, batalha 8) não era rede: parado, o creep esperava o tempo de uma célula inteira
   segurando a tecla (200 a 333 ms) antes do primeiro passo, e soltar antes zerava os pontos (a interpretação 2 da
   F1). Toques repetidos nunca moviam o creep. **Decidido (C4, spec D22):** o primeiro passo é imediato.
2. **A fuga por inatividade cortava lutas** (grupo 3). **Decidido (C5, spec D9):** um relógio só, da batalha (ideia
   do dono).
3. **A tela ilegível no notebook e sem sinal do golpe** (grupos 1 e 3). **Decidido (C6, spec L-8):** a arena na
   largura disponível, tudo maior, e o sinal de quem ataca, do golpe (com o dano) e do projétil que some sem
   acertar. O **som** fica como proposta sem marco, e o **golpe crítico** como pergunta aberta para o M2.5 (GDD 06;
   C8).
4. **Bug: o domínio sobrevivia ao fim da batalha.** Depois de uma batalha vencida dominando, a página continuava
   dominando o creep, e o "instantâneo" ficava desligado até um "soltar" à mão. **C7:** o domínio acaba com a
   batalha, e dominar o creep que já é seu não marca a batalha como "trocou".

**A retomada** (depois do merge da F6, nesta ordem): exportar e limpar o registro (a 1ª parte já está no export
acima), refazer os **grupos 1 a 3** com as regras e a tela novas (a `BATTLE_VERSION` 3 muda o movimento e a
inatividade, e as notas do F3 e do F4 eram da tela antiga; é também o aquecimento antes das às cegas) e seguir do
**grupo 4 ao 8**. Continuam pendentes do checkpoint: as interpretações 1 a 8 da F5 e o *jitter* da reação de cada
nível (F4).

## F6 — Os ajustes do checkpoint da F5 (`m2/laboratorio-f6-ajustes`)

As decisões C4 a C7 do checkpoint da F5 (plan §15; spec D9, D22, M-1, A-4, F-2, L-8). Worktree:
`.claude/worktrees/lab-f6`. Depois do merge, o checkpoint da F5 retoma (a "retomada", acima).

- [x] As decisões no GDD 06, na spec e no plan; o roteiro do laboratório em grupos no PLAYTEST; o registro da 1ª
      parte do checkpoint (acima) (2026-11-18)
- [x] **O primeiro passo imediato** (spec D22, M-1; C4): parado, o creep anda no tick seguinte ao comando, e cada
      toque anda uma célula sem passar da velocidade do DNA. Sugestão: com a intenção parada, os pontos não zeram,
      mas se recompõem pelo ganho do tick (com o freio da carga) até `CELL_COST`, e não passam dele; quem ficou
      parado o tempo de uma célula tem o passo pronto. Testes: um toque de 1 tick anda uma célula; toques mais
      rápidos que o ritmo não andam mais rápido que segurar; segurar mantém a velocidade média; o bloqueio e a
      disputa como antes; a contagem (S-4) termina com o passo pronto. Vale para a IA também
- [x] **A inatividade da batalha** (spec D9, A-4, F-2; C5): um relógio só no estado da batalha, no lugar do relógio
      de cada participante; zera com qualquer golpe que tire HP; começa no fim da contagem, como hoje; quando
      estoura, todos os que estão na arena saem com o motivo "inatividade" (um evento por saída, na ordem da id) e a
      batalha acaba sem vencedor. A visão mostra o relógio para a página. A IA não lê o relógio (o `gambits.ts` não o
      usa). **A validar:** quem entra no meio não zera o relógio (só o dano zera)
- [x] A `BATTLE_VERSION` 3 (o mesmo log dá outro resultado): o hash de referência do `serialize.test.ts`, o
      `geo battle sweep` de novo (seeds 1–100; a tabela comparada com a da F5: duração, inatividade, custo,
      vitórias), o `verify` nas seeds 1, 42 e 649, e a *fixture* do laboratório refeita (um log novo exportado da
      página, com domínio, reforço e gambits, que dê na CLI o hash do worker)
- [x] **O domínio acaba com a batalha** (C7): no fim da batalha, a página solta o domínio (o "instantâneo" volta a
      valer, e o "Na arena" não oferece mais "soltar"); dominar o participante que já é seu não faz nada nem marca
      a batalha como "trocou"
- [x] **A tela legível num notebook** (spec L-8; C6): a arena ocupa a largura disponível (e cabe na altura de uma
      tela de 1366 × 768), com as formas, a barra de HP, a seta da direção e os traços maiores; **o ataque:** um
      pulso em quem ataca (o `attacked`); **o golpe:** um clarão no atingido e o número do dano subindo (o `hit`,
      com o dano efetivo); **o erro:** uma marca curta onde o projétil some sem acertar (na pedra ou no fim do
      alcance), tirada dos quadros e dos eventos, ou de um evento novo se a dedução for frágil (evento novo é
      contrato: registre); a contagem da fuga e o **relógio de inatividade da batalha** maiores, este perto do
      relógio da batalha ou sobre a arena. Conferir no Chromium headless pelo CDP a 1366 × 768, com capturas, e
      guardar as capturas para o dono ver antes do merge
- [ ] O registro da F6 (medições, interpretações) aqui, e o merge: o worktree não faz merge em `main`; deixe a
      mensagem no scratchpad e entregue ao dono os comandos (`git merge --no-ff`, `npm run check` em `main`, e a
      remoção do worktree)
