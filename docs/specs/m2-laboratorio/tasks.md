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
- [x] O registro da F6 (medições, interpretações) aqui, e o merge: o worktree não faz merge em `main`; deixe a
      mensagem no scratchpad e entregue ao dono os comandos (`git merge --no-ff`, `npm run check` em `main`, e a
      remoção do worktree)

### Registro da F6 (2026-11-18)

Como nas fases anteriores, o registro fica aqui e entra no "Registro das fases" do dashboard no merge da B em `main`
(que fecha a fatia, depois do checkpoint da F5).

**As regras novas** (`BATTLE_VERSION` 3). O `geo battle sweep` (seeds 1–100, 9 200 batalhas em 45 s e 43 s, duas
rodadas), comparado com a F5:

| O quê | Na F5 | Na F6 (primeiro passo imediato, inatividade da batalha) |
|---|---|---|
| Duração do 1 × 1 (mediana) | 18,6 s | 18,4 s |
| Duração do 3 × 3 (mediana) | 32,0 s | 34,7 s |
| Custo do 3 × 3 por 2 400 ticks (mediana; alvo 50 ms) | 38 ms | 41,7 ms e 37,4 ms nas duas rodadas (nas pedras, 49,6 e 45,4): ruído do WSL |
| Inatividade no 3 × 3 (aberta, pedras, corredor) | 7%, 19%, 2% | 0%, 0%, 0% |
| Triângulo × círculo (A / B: aberta, pedras, corredor) | 49/51, 66/34, 49/51 | 57/41, 87/13, 49/51 |
| Quadrado × círculo, quadrado × triângulo | 0–2/98–100, 99–100/0–1 | 0–2/98–100, 100/0 |
| Fuga carregada (escapa) | 2–7% | 2–8% |

O fim da inatividade no 3 × 3 é a C5: um creep que não acertava nem era acertado não sai mais no meio da luta dos
outros (no 1 × 1, a inatividade fica em até 3%, no ● × ● na aberta). O triângulo ganhou terreno do círculo nas
pedras (66% → 87%), provavelmente porque o primeiro passo imediato ajuda quem fecha a distância contornando a pedra
(não investigado; informativo, C1). O `geo battle verify` nas seeds 1, 42 e 649: OK.

A *fixture* do laboratório foi refeita: um log exportado da página no Chromium a 300 ms de RTT (o Começar já
dominando o quadrado, teclas durante a contagem, um reforço num lado novo e os gambits do círculo trocados pelo
portador), que dá na CLI o hash do worker (`e4fee827…`).

**O laboratório**, conferido no Chromium headless pelo CDP a 1366 × 768: a arena tem **1005 × 648 px** (~22 px por
célula; na F5, ~620 px de largura entre as colunas de 330 e 360 px), com a coluna de 300 px à direita e sem
rolagem horizontal. As capturas mostram o pulso de quem ataca, o clarão e o dano no atingido (dois golpes seguidos
no mesmo alvo, lado a lado), a marca do tiro que some no fim do alcance, o tempo sem dano na barra e o aviso
vermelho sobre a arena, e a fuga de todos aos 18,0 s (3 s de contagem + 15 s). No fim de uma batalha vencida
dominando, o "Na arena" não oferece mais "soltar" e o instantâneo volta. Testes: 2 701 no total (eram 2 686 no fim
da F5).

**Interpretações a validar:**

1. **O primeiro passo:** parado, os pontos se recompõem pelo ganho do tick (com o freio da carga) até `CELL_COST`;
   quem nasce ou entra começa com o passo pronto. Segurando desde o repouso, o 2º passo vem 1 tick antes do ritmo
   (o ganho do tick do 1º passo sobra; no círculo, 150 ms em vez de 200), como já acontecia com quem estava
   bloqueado. A velocidade média não muda, e tocar nunca anda mais rápido que segurar (teste sobre 200 padrões
   de toque).
2. **A inatividade da batalha:** só o golpe que tira HP zera o relógio; quem entra não zera; quem completa a borda
   no mesmo tick em que o relógio estoura sai pela borda; a IA não lê o relógio. A visão leva o relógio
   (`idleTicks`) no topo, não mais em cada participante.
3. **Os sinais da tela vêm de eventos:** `missed` é evento novo (quem atirou, a última célula do projétil e a
   direção; a do atirador quando a frente já é pedra), e o `hit` ganhou a célula de quem apanhou. Deduzir o erro
   dos quadros seria frágil: o `hit` não diz qual projétil acertou. Os eventos ficam fora do estado (o hash não
   muda com eles), no contrato v0, sob a `BATTLE_VERSION` 3. O corpo a corpo que erra não deixa marca, só o pulso.
4. **A tela:** a batalha primeiro (a arena até a altura da janela, menos 118 px de cabeçalho e barra), a coluna
   estreita com a nota às cegas, o "Na arena" e os eventos; o formulário, a rede, a sessão e os gambits embaixo
   (antes da primeira batalha, o formulário fica logo abaixo do quadro vazio). A tabela de resultado também fica
   embaixo; o desfecho aparece sobre a arena. Os sinais duram 300 ms (ataque), 900 ms (golpe) e 600 ms (erro) no
   tempo da página: continuam na pausa e se acumulam mais no ×4. O tempo sem dano fica na barra durante a luta; o
   aviso grande aparece com 2/3 do relógio (10 s).
5. **O domínio:** acaba também com a batalha (o vencedor fica na visão); dominar quem já é seu não faz nada nem
   marca a batalha como "trocou".
6. Um teste dos presets (● × ● nas pedras, seed 7) virou dois atiradores que erram tudo até a inatividade; o teste
   passou a pedir golpes em uma de três seeds.

**Para a retomada do checkpoint** (acima): os grupos 1 a 3 refeitos com as regras e a tela novas, depois os
grupos 4 a 8. Continuam pendentes as interpretações 1 a 8 da F5 e o *jitter* da reação de cada nível (F4).

### Checkpoint, 2ª parte (dono, 2026-11-19 e 20): a retomada, grupos 1 a 8

Com o `main` da F6 (`BATTLE_VERSION` 3), o registro limpo e o lab no Vite (5173). Os grupos 1 a 3 refeitos, depois
do 4 ao 8. O export é o `sessao-lab-2026-11-19-23-13.json` (71 batalhas: 9 do grupo 1, 27 do 2, 2 do 3, 4 do 4 e 29
às cegas; o grupo 7 ficou fora do export, sem nota), na pasta Downloads do dono, fora do repo.

**Grupo 1** (9 duelos dominando, RTT 0, IA normal, seed 1):

| Você × IA | pedras | aberta | corredor |
|---|---|---|---|
| ■ × ● | venceu (61,6 s): "precisei me esconder e me posicionar para fazer *bait* nas esquinas" | perdeu, "pelo menos consegui dar 1 hit" | perdeu (84,3 s), "acertei alguns hits" |
| ▲ × ● | venceu: "agora o triângulo ficou forte" | venceu: "legal", a IA do ● "deu alguns moles" | venceu (27,1 s): "correu safado" (o registro não guarda o motivo do fim) |
| ● × ■ | venceu: "a IA do quadrado não sabe usar o terreno" | venceu | venceu |

7 de 9 (na 1ª parte, 4 de 9). Notas: **F1 5, F2 5, F5 5** (na 1ª parte, 3, 3 e 4). "Agora melhorou muito com
feedback visual"; "os feedbacks visuais melhoraram 1000% a experiência do combate, mesmo apenas com ataques
básicos"; o movimento "bem fluido", desvia com mais facilidade; nada travou nem confundiu, "100% estável". ■ e ▲ os
mais divertidos; a melhor luta, o ■ baitando o ● nas pedras; na aberta e no corredor, o ■ quase não vence o ●.

**Grupo 2** (27 IA × IA instantâneas, 3 seeds sorteadas por confronto): nenhum número surpreendeu.

| Confronto (você no A) | pedras | aberta | corredor |
|---|---|---|---|
| ■ × ● | você 1/1 · IA 0/3 | 0/1 · 0/3 | 0/1 · 0/3 |
| ▲ × ● | 1/1 · 3/3 | 1/1 · 2/3 | 1/1 · 3/3 |
| ● × ■ | 1/1 · 3/3 | 1/1 · 3/3 | 1/1 · 3/3 |

Só um confronto que a IA perde virou com a micro do dono: o ■ × ● nas pedras, pelo terreno (uma batalha só, um
sinal).

**Grupo 3** (assistir; as duas batalhas rodaram no **corredor** por engano, não nas pedras e na aberta, e não foram
refeitas: o grupo julga a tela e a IA, e o sweep da F6 já mediu a inatividade do 3 × 3 nas pedras em 0%). **F3 ok:**
tudo legível; do relógio de inatividade, ele só viu o alerta vermelho dos últimos 5 s, "e pra mim é suficiente"; o
medidor "sem dano: … · fogem em …" na barra passou despercebido. **F4:** a IA "ainda tá bem bobinha, tem espaço pra
melhorar, mas cumpre o papel". No 1 × 1 × 1, o ● esperou o ■ matar o ▲ no corpo a corpo ("não entendi o mole que o
triângulo deu pra ser solado no melee") e depois venceu o ■. O 3 × 3, "mais ou menos", o normal para quem assiste de
fora uma luta em grupo: é preciso focar num creep. Faltou um sinal (visual; som depois) de quem morre ou foge, e
anúncios como os do DotA e do LoL. Ideia: um **comandante** nas batalhas em grupo (GDD 06, proposta).

**Grupo 4** (corredor, ▲ × ▲, assistindo): o editor existe, mas os presets bastam, e "acho difícil o jogador
conseguir editar a regra dos creeps durante o combate" (pode mudar com a tática do comandante). **A esquiva fez
muita diferença:** "palmas para a esquiva da IA média, o azul aguentou bastante tempo 1vs2" (o ▲ do lado A, depois
do reforço ● no lado B). **A IA do ▲ fica parada no corpo a corpo do ■**, tomando golpe, quando poderia *kitar*
como o ● (2ª vez: no grupo 3 também). O medidor "sem dano" de novo não ficou na memória: "talvez essa barra esteja
mal posicionada e passa despercebida".

**Grupos 5 e 6** (às cegas, ▲ você × ● normal nas pedras, interpolar ligado, 29 batalhas: uma de 150 ms se perdeu
quando um atalho fechou a aba). Vitórias: 28 de 29 (a derrota, a 300 ms). Duração mediana: 25,3 s.

| RTT | 0 | 50 | 100 | 150 | 200 | 300 |
|---|---|---|---|---|---|---|
| Notas | 4 5 3 3 4 | 5 5 3 5 3 | 5 3 3 5 4 | 4 3 2 4 | 3 2 2 2 2 | 2 2 2 2 2 |
| Mediana | 4 | 5 | 4 | 3,5 | 2 | 2 |
| Atraso medido (mediana) | 78 ms | 125 | 184 | 234 | 282 | 386 |

**Veredito:** nota em 4 ou mais até **100 ms**; abaixo de 3 a partir de **200 ms**. O dono: "acima de 100 ms começa
a ficar perceptível"; nenhuma nota abaixo de 2; faltou testar lutas maiores e longas (um cerco de fim de jogo). No
começo ele ainda calibrava o senso de latência; separadas as 15 primeiras das 14 últimas, a diferença é ruído (2 ou
3 notas por RTT em cada metade), e 200 e 300 ms dão 2 nas duas. Contra o bot, o atraso "é previsível": depois de
algumas partidas, ele antecipa o tiro e acerta. O que incomoda não é bem a latência, é **"a pausa entre cada
movimento"**, que o leva a soltar e apertar a tecla várias vezes: "revisitar a implementação do movimento (pelo
menos no combate) para ficar mais fluido, menos engessado". **Causa provável:** a interpolação desliza só um tick
(50 ms, plan P8), e o ▲ anda 4 células por segundo (250 ms por célula): segurando, ele desliza 50 ms e fica ~200 ms
parado em cada célula. Isso explica as notas 3 a 0 ms.

**Grupo 7** (300 ms, o mesmo setup): **F6: sem interpolar sente melhor**, "fica mais fácil de sincronizar o
movimento com a latência". A 0 ms, sem interpolar, a pausa continua, mas ele vê que o creep andou no mesmo tick da
ação: "ajuda a mitigar o problema, mas não acho que seja a melhor solução". Ele perguntou por um meio-termo: uma
interpolação que não pause quando o input seguinte continua o movimento.

**Grupo 8** (fechamento):

1. **A regra de grade é divertida?** Sim: "gostei bastante do resultado que alcançamos para o combate".
2. **A micro importa?** Sim: "esculachei" o ■ × ● nas pedras graças aos sinais, que mostram o alcance do tiro de
   cada creep e deixam calibrar o timing do golpe. **O exploit do ●:** nas pedras, baitando de um canto para o
   outro, os golpes são quase garantidos contra o ●, que não se aproxima e sempre passa pelos mesmos corredores,
   andando reto mesmo com o dono esperando na esquina. Ele acha que vale contra qualquer IA, com qualquer DNA
   ("humanos aprendem sozinhos").
3. **A latência:** "esquece deploy por enquanto". O deploy, mesmo o de testes, espera a junção colada (o mundo cria a
   instância, o canal fica aberto para reforços e terceiros, o resultado volta ao mundo); "podemos muito bem acabar
   decidindo colocar predição no client".
4. **A IA serve?** "Cumpre seu papel."
5. **A próxima regra:** nenhuma antes da junção: "vamos juntar o que tem".
6. **O movimento:** experimentar as opções antes de pedir uma decisão ("não tenho a base comparativa").
7. **A F7:** sim, com a rolagem até a arena ao clicar em Começar (pedido do dono).
8. **O comandante:** "o Mount & Blade inspira de várias formas, não só na conversa", sem comparar a escala. O dono
   pediu para **reorganizar o planejamento macro depois do M2**: "tem muita coisa com marco".
9. **Anúncios e som:** não são prioridade. O dono pediu que o agente analise e proponha onde cada ideia cabe, e
   pergunte só o que o repo não responde.

**As interpretações** (F4 a F6): aceitas, salvo duas. **(a) A contagem com várias ações** (F5, interpretação 1): apertar Q e
soltar durante a contagem ainda larga a bolsa no fim dela (o pedido espera), e o dono não quer isso: **decidido
(C15):** no fim da contagem vale só o que está apertado naquele instante (F7, abaixo). **(b) O elogio da esquiva** foi no ▲ × ▲ do grupo 4, não no
duelo contra o ●. O *jitter* da reação (fácil 600 ± 250 ms, normal 250 ± 100, difícil 100 ± 50) fica como está até
a F7 mexer na IA.

**Decisões** (plan §15, C9 a C15): a contagem vale o que está apertado no fim; a próxima regra é nenhuma (a fatia B fecha depois da F7; a frente seguinte é a
junção); o deploy e a predição esperam a junção; o movimento se experimenta no laboratório antes de virar regra; a
IA do ▲ e do ● se ajusta; a tela ganha o sinal de morte e de fuga; o comandante e os anúncios viram propostas no
GDD 06.

## F7 — Os ajustes do checkpoint da F5, 2ª parte (`m2/laboratorio-f7-ajustes`)

As decisões C9 a C15 do checkpoint (plan §15). Worktree: `.claude/worktrees/lab-f7`. A F7 fecha a fatia B.

- [x] As decisões no GDD 06, no ROADMAP, no brainstorm, na spec e no plan; o registro da 2ª parte do checkpoint
      (acima) (2026-11-20)
- [x] **A contagem: vale o que está apertado no fim** (C15; spec D21, S-4; GDD 06). Hoje (`step.ts`,
      `commands.ts`), largar e catar são um pedido que espera, e o toque no espaço arma o *latch*: apertar e soltar
      durante a contagem ainda larga ou ataca no primeiro tick da luta (um Q sem querer derruba a bolsa). **Decidido:**
      no fim da contagem, vale só o que está apertado naquele instante: a direção segurada anda, o espaço segurado
      ataca, o Q ou o E segurado larga ou cata; um pedido feito e solto durante a contagem é descartado. O virar
      continua valendo durante a contagem. Vale para a IA (a intenção dela no fim da contagem) e para quem entra
      durante a contagem. A página passa a mandar o estado segurado do Q e do E (ou o *worker* descarta os pedidos
      da contagem e a página repete o que está segurado no fim: escolha da F7, com o porquê no registro). Mesmo log,
      outro resultado: a `BATTLE_VERSION` sobe para 4, com o hash de referência, o `sweep` e o `verify` de novo e a
      *fixture* do laboratório refeita (um log exportado da página no fim da F7, com as outras mudanças)
- [x] **O movimento, para comparar** (C11): ao lado do "interpolar" e do "sem interpolar" de hoje, duas opções de
      desenho na "Rede simulada": **deslizar o passo inteiro** (o creep desliza na velocidade do DNA, sem a pausa,
      desenhado até um passo atrás) e **prever o meu creep** (enquanto a tecla está segurada e a frente está livre
      no último quadro, a página continua deslizando o creep dominado para a próxima célula, sem esperar o quadro;
      o quadro do *worker* corrige). A simulação não muda (a autoridade continua no *worker*). O ADR-0008, item 9,
      diz "sem predição": rascunhar a emenda (`Proposed`, skill `adr`), uma opção de experimento do laboratório. O
      atraso medido de cada opção (o CDP, a 0, 100 e 300 ms), e um grupo novo no PLAYTEST para o dono comparar as
      quatro a 0 e a 150 ms
- [x] **A IA do ▲ contra o corpo a corpo** (C12): o ▲ *kita* o ■, como o ● (recua quando o inimigo de corpo a corpo
      está perto, e atira de longe). Primeiro os gambits do preset; código novo só se a condição ou a ação não
      existir. Medido no `geo battle sweep` (▲ × ■ hoje 0/100; informativo, C1)
- [x] **O ● nas esquinas** (C12): investigar por que o ● anda reto para a esquina onde o inimigo espera (o caminho
      sempre igual nas pedras) e ajustar o que for gambit ou escolha de caminho; se a solução pedir uma IA que
      aprende, registrar na proposta do GDD 06 em vez de implementar
- [x] **A tela** (C13): um sinal de morte e um de fuga na arena (a partir dos eventos); o medidor "sem dano" sai da
      barra e vai para cima da arena, discreto (o alerta vermelho dos últimos 5 s continua); **Começar** (e o
      Começar da sessão às cegas) rola a página até a arena, com as dicas e os controles visíveis. Conferir no
      Chromium headless a 1366 × 768, com capturas para o dono
- [x] O fechamento da fatia B: o registro da F7 aqui; o "Registro das fases" do dashboard com as fases da B; o
      "Agora" do dashboard com a frente seguinte (a **junção**, fatia D) e uma rodada de proposta do **ROADMAP
      depois do M2** (pedido do dono: reorganizar o planejamento macro), que o agente prepara e o dono aprova antes da
      spec da D; o `CLAUDE.md` com a fase atual. O merge como na F6: a mensagem no scratchpad e os comandos para o
      dono

### Registro da F7 (2026-11-20)

O registro fica aqui e entra no "Registro das fases" do dashboard com o fechamento da fatia B.

**A contagem (C15; `BATTLE_VERSION` 4).** A escolha: **a intenção ganha a bolsa segurada** (`bag`: `drop` ou
`pickup`, ao lado da direção e do espaço), em vez de a página repetir o pedido no fim da contagem. Nos ticks da
contagem, o *worker* descarta os pedidos de um toque (o *latch* do espaço, `drop`, `pickup`); no último tick dela, a
bolsa segurada vira o pedido, e o espaço e a direção segurados agem no primeiro tick da luta. Por quê: o Q segurado
atravessa a rede com a mesma latência da direção segurada, sem depender do relógio da página (que não sabe quando a
contagem acaba do lado do *worker*); e a IA usa o mesmo caminho, porque a intenção dela já guarda a bolsa da última
decisão. O teclado manda o `bag` só enquanto Q ou E está segurado.

**A IA (C12).** **O ▲ *kita* o ■:** o escaramuçador ganhou "quadrado inimigo a até 3 células → manter distância do
quadrado", entre a esquiva e o ataque. Para isso, a condição `enemyWithin` ganhou um filtro de DNA opcional (`dna`;
o editor, o seletor "de qualquer forma" ou uma forma): sem ele, o ▲ recuaria de triângulos e círculos também. **O ●
nas esquinas:** a causa era o caminho, não o gambit: o caminho mais curto até a célula de tiro passava ao lado do ■
parado na esquina. Agora o alinhar de quem atira desvia das células a até `gambits.meleeBerthSteps` passos (contorno
de pedra) de um inimigo de corpo a corpo, e só passa por elas se não houver outro caminho (**3, provisório**; 0
desliga). Na isca da esquina (o ■ em 39 células das pedras × 20 seeds, script no scratchpad): com o ■ parado, 12% das
batalhas tinham um golpe do ■ antes e 0% depois; com o ■ que espreita, 18% → 0%; o ● vence todas. O que sobra é a
previsibilidade (o ● ainda escolhe os mesmos corredores): registrada na proposta "IA que aprende" do GDD 06.

O `geo battle sweep` (seeds 1–100, 9 200 batalhas em 48 s). Com só a contagem (v4), a matriz deu os mesmos números da
F6: a IA não toca durante a contagem. A coluna da F7 é a final, com a IA nova:

| O quê | Na F6 (e na v4 só com a contagem) | Na F7 |
|---|---|---|
| Duração do 1 × 1 (mediana) | 18,4 s | 20,4 s |
| Duração do 3 × 3 (mediana) | 34,7 s | 38,5 s |
| Custo do 3 × 3 por 2 400 ticks (mediana; alvo 50 ms) | 37–42 ms | 40,8 e 41,6 ms (duas rodadas) |
| Quadrado × triângulo (A / B: aberta, pedras, corredor) | 100/0 nas três | 48/52, 52/48, 47/53 |
| Triângulo × círculo, quadrado × círculo | 57/41, 87/13, 49/51; 0/100 | iguais |
| 1 × 1 × 1 (■ / ▲ / ●: aberta, pedras, corredor) | 20/19/61, 16/24/60, 12/58/30 | 1/31/68, 2/34/64, 2/46/51 |
| Saída pela borda no 3 × 3 (aberta, pedras, corredor) | 82%, 79%, 77% | 75%, 68%, 71% |
| Fuga carregada (escapa) | 2–8% | 2–8% |

A luta fica mais longa porque o ▲ recua do ■ em vez de trocar golpes; o ■ perde o 1 × 1 × 1 porque o ▲ não morre mais
parado no corpo a corpo dele (o mole do grupo 3). O `geo battle verify` nas seeds 1, 42 e 649: OK.

**O movimento (C11).** O seletor **Movimento** na "Rede simulada" (o "interpolar" virou uma das opções); a batalha não
muda, só o desenho; o registro de cada batalha guarda a opção. A predição contraria o item 9 do ADR-0008: o
[ADR-0009](../../adr/0009-predicao-no-laboratorio.md) (`Proposed`) a faz uma opção de experimento do laboratório,
com a autoridade no *worker*. Medido no Chromium headless pelo CDP (o ▲ segurado para cima 1,2 s, seis vezes por
opção, cada uma depois de um R; mediana):

| Opção | Tecla → 1º movimento na tela (0 / 150 / 300 ms) | Parado enquanto segura | Painel "tecla → tela" (0 / 100 / 300 ms) |
|---|---|---|---|
| sem interpolar | 52 / 175 / 345 ms | 234–267 ms | 24 / 134 / 341 ms |
| interpolar (1 tick) | 64 / 231 / 329 ms | 200–217 ms | 76 / 179 / 396 ms |
| deslizar o passo inteiro | 60 / 239 / 354 ms | nenhum (1 quadro) | 276 / 379 / 590 ms |
| prever o meu creep | 15 / 16 / 43 ms | nenhum | 71 / 180 / 378 ms (o dos quadros; o seu creep anda na hora) |

O painel mede até o creep chegar à célula na tela; por isso o passo inteiro soma o passo do ▲ (250 ms), embora o
creep comece a andar tão cedo quanto no 1 tick. A pausa de ~200 ms que o dono sentiu ("a pausa entre cada
movimento") é a do 1 tick e a do sem interpolar; as outras duas não param. **Um achado da medição, corrigido:** a
primeira versão da predição desenhava o creep para trás em toda tecla (0,7 a 0,9 célula a 0 ms; 0,2 a 0,4 a 150 e
300 ms). A batalha entra em cada célula no começo do passo, e a predição deslizava à frente dela; solta a tecla, o
creep voltava. Agora ela desliza até um passo atrás da batalha, nunca à frente, e solta espera os quadros onde está;
medido de novo, nada para trás nas 36 teclas. O grupo 7 do [PLAYTEST](../../PLAYTEST.md) compara as quatro a 0 e
150 ms.

**A tela (C13).** Quem morre se desfaz em estilhaços onde o golpe o pegou ("‹nome› caiu"); quem foge deixa uma seta
para fora da arena na última célula ("‹nome› fugiu", "(inatividade)" quando o relógio mandou todos embora). Os dois
vêm dos eventos, com as células do quadro anterior. O medidor "sem dano" saiu da barra: é uma linha discreta logo
acima da arena; o aviso vermelho dos últimos 5 s continua. O Começar (e o da sessão às cegas e o da próxima) sobe a
página até o cabeçalho, com as dicas, os controles e a arena à vista; o R reinicia onde a página está. Conferido no
Chromium headless a 1366 × 768; as capturas e as medições ficam em `runs/m2-laboratorio-f7/` do checkout principal
(fora do Git).

**A *fixture*** foi refeita com um log exportado da página no fim da F7 (v4, 300 ms de RTT): o Começar dominando o ■,
um Q apertado e solto durante a contagem (o `drop` descartado) e uma direção segurada através dela, um ataque, um
reforço num lado novo e os gambits do ● trocados pelo portador. Na CLI, dá o hash do *worker* (`25532f10…`). Testes:
2 729 no total (eram 2 701 no fim da F6).

**Interpretações a validar:**

1. **A bolsa segurada na intenção** (acima), e a IA que segura a bolsa da última decisão na contagem.
2. **O filtro de DNA no `enemyWithin`** e a regra nova do escaramuçador (antes do ataque, depois da esquiva).
3. **O desvio do corpo a corpo** vale para quem atira (o ▲ e o ●) e só no alinhar; 3 passos é chute.
4. **O que o painel mede** em cada opção de movimento (até o creep chegar à célula na tela) e a predição só no creep
   dominado, até um passo atrás da batalha; na contagem, ela espera.
5. **Os sinais de morte e fuga** duram 1,4 s no tempo da página; sem a célula (nenhum quadro antes), não há sinal.
