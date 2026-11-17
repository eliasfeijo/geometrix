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

- [ ] As arenas 2× (43 × 27) com as zonas de nascimento a 1/4 da largura, e uma aberta 3× (63 × 39) só para o
      relatório; o teste de simetria de 180°; o `sweep` de novo (duração, inatividade, fuga, custo) e os replays, para
      o dono ver antes da página (spec D3, §6; plan §4, C2)
- [ ] A reação por participante: `fácil`/`normal`/`difícil` no setup, os números em `params/battle.json`, o
      `rng` sorteando a reação de cada decisão (spec D20; plan C3)
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
