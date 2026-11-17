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
- [ ] `commands.ts` (`intent`, `attackOnce`, `face`, validação e recusa sem efeito) e `movement.ts` (pontos, freio
      da carga, pedra e corpo que bloqueiam, disputa pelo `rng`) (spec M-1..M-3, plan §6, P4)
- [ ] `events.ts` e o esqueleto do `stepBattle` (estágios 1 e 4 do pipeline), com os comandos valendo no tick
      seguinte; exports no `index.ts` (plan §7, P5)

## F2 — O combate (`m2/laboratorio-f2-combat`)

- [ ] `combat.ts`: recarga, corpo a corpo (atacar antes de andar), projéteis (nascer, andar, conferir a célula de
      partida, acertar o primeiro inimigo, parar na pedra e no alcance, atravessar aliado), dano, morte (spec
      A-1..A-5, plan §7, P3)
- [ ] `carry.ts`: pilha na morte, largar a bolsa, catar até a capacidade, cristal primeiro (spec C-1, C-2, D8)
- [ ] `exits.ts`: fuga pela borda (contagem zerada por golpe), inatividade (zerada por dano dado ou recebido), fim
      com o lado vencedor ou sem vencedor; batalha acabada não avança (spec F-1..F-4, D7, D9)
- [ ] Comandos `join`, `control`, `setGambits` (a lista copiada campo a campo); entrada com o `rng` e o lado novo
      (spec E-1, D11, D12, plan §6)
- [ ] Eventos completos e o desfecho no `ended`; `totals` de dano por participante (spec D19, F-3, plan §10)
- [ ] `log.ts`: `BattleLog` e `replayLog`; teste de 2 execuções e snapshot → restore no meio com o mesmo hash (spec
      R-2, plan §11)

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
