# Status atual

> **Como usar.** O topo é o retrato de agora. A seção **Agora** é **reescrita** ao fechar uma fase, ao passar por um
> portão de aprovação ou quando surge um bloqueio: ela nunca acumula. O que uma fase mediu, interpretou ou decidiu
> vai para o **Histórico**, no fim do arquivo, com a entrada mais recente no topo de "Registro das fases". A fonte
> de verdade continua nos docs linkados.

## Agora

**Atualizado:** 2026-11-15

| | |
|---|---|
| **Marco** | **M2 — A emboscada** ([ROADMAP](../ROADMAP.md)). M0, M1 e M1.5 ✅ |
| **Fatia** | **A — O encontro** ([spec](../specs/m2-encontro/spec.md) · [plan](../specs/m2-encontro/plan.md) · [tasks](../specs/m2-encontro/tasks.md)): F0 ✅, F1 ✅ (nomes, HP e eventos), F2 ✅ (o encontro no `sim`) · **B — O laboratório de batalha** ([spec](../specs/m2-laboratorio/spec.md) · [plan](../specs/m2-laboratorio/plan.md) · [tasks](../specs/m2-laboratorio/tasks.md)): F0 ✅ (spec, ADR-0008 e plan aprovados) |
| **Em execução** | **A F3 — Bots e harness**, branch `m2/encontro-f3-harness`: as três tasks prontas; **parada no checkpoint do dono**, antes do merge |
| **Próxima fase** | **A F3 — Bots e harness**, branch `m2/encontro-f3-harness` (skill `implement-phase`), com o checkpoint do dono nos números |
| **Pode andar em paralelo** | **B F1 — O pacote e o movimento**, branch `m2/laboratorio-f1-package`, numa outra sessão com worktree próprio (como a spec da B); a B mexe no pacote de batalha, não no `sim`. Ela não edita o dashboard nem o `CLAUDE.md`; o merge em `main` acontece entre duas fases da A |
| **Aguardando o dono** | Fechar a A F3 (2ª rodada, no topo do "Registro das fases"): 6. o depósito lembrado vazio que ninguém revisita (25% de diferença entre os times no seed 42); 7. encontros só nas primeiras ~8 h; 8. o ▲ quase nunca paga; 9. custo do tick (1,10×) |
| **Bloqueios** | Nenhum |

### Próximos passos

As fatias do M2 seguem o grafo de dependências do [ROADMAP](../ROADMAP.md), não uma fila.

1. **A F3 a F6**, em sequência.
2. **A implementação da B** (F1 a F5) em paralelo à A, numa outra sessão.
3. **Depois do checkpoint da A F3:** as rodadas de design do **papel do cristal** e da **fatia E** (se o cerco
   passa pela instância de batalha, a E depende da D; senão, pode vir antes dela).
4. **Depois da A:** a D (com a B pronta) ou a E, e a C em paralelo à D.

### O que a próxima fase precisa saber

- **o encontro** (F2, `sim/encounter.ts`): estágio 4 do `step` (`runEncounters`): expira salvo-condutos e
  bloqueios, abre (`approach` a até `encounter.radius`; mútuo por D12), decide o diálogo (vítima livre na hora,
  dominada pelo `reply` ou pelas regras no fim da janela), rola as rodadas (`nextRoundTick`), fecha. Critérios
  de abordagem e a exigência em `sim/approach.ts` (`opening`, `demandFor`, `freeCapacity`); despojos em
  `sim/spoils.ts`; `speedHere` em `movement.ts`; reações do piloto em `autopilot.ts` (`ruleReaction`,
  `isReaction`); o comando `react` e as ordens `approach`/`pickup` em `domination.ts`. Atividades novas:
  `talking`, `fighting`, `fleeing`;
- **para o estrategista (F3):** o preset `raider` (`raiderRules`) já existe; o bot só precisa dar o preset a
  `floor(creeps ÷ 6)` coletores de matéria de menor id. Num teste de rascunho (metade dos creeps salteadores,
  24 h), o seed 42 levou 47 s: o `explore` dos salteadores pesa; medir com a fração real;
- **ainda fora da visão:** `encounters` e `spoils` não estão na `TeamView` (entram na F4, junto com o delta,
  senão o hash do cliente diverge); o creep inimigo já mostra `engagement`;
- **identidade e HP** (F1): `creep.name` vem de `nameAt(state.births)` (`sim/names.ts`) no nascimento
  (`newCreep(id, birth, team, dna, params)`; a produção usa `spawnCreep`); `creep.hp` em milésimos (`maxHp`);
  `creep.engagement` já existe e é sempre `null` até a F2 criar o `Encounter`; `hp.ts` tem `regenerateHp`
  (estágio 5, no tick que fecha o minuto, como os depósitos; pula `engagement !== null`), `inCoreZone` e `kill`
  (só tira do estado: a carga, o saque e o `died` são da F2);
- **eventos** (F1, `sim/events.ts`): `step` devolve `SimEvent[]`; os estágios recebem o `EventLog` do tick
  (`emit(log, body)`; só a produção, hoje); `setAudience` roda depois do `updateVision`; `eventsFor(events,
  team)` filtra e tira o `teams`; o union `EventBody` já tem todos os tipos do plan §7, mas só o `born` é emitido;
  o `createWorld` não emite eventos;
- **visão** (F1): o `ForeignCreepView` tem `name`, `hp` e `engagement`; o `CreepView`, os mesmos e o resto;
- **visão e memória** (`sim/vision.ts`, `view.ts`): o que o time vê e lembra, e a `view` filtrada é a única
  entrada do estrategista e do cliente; `fullView` (time −1) para o replay;
- **pelo que o time sabe** (`sim/known.ts`): mapa conhecido, A* e estradas no escuro, `explore`, preset batedor;
- **coleta** (`autopilot.ts`): `quickestDeposit` escolhe o depósito pelo custo do A* no mapa conhecido
  (`nearestTargets` em `pathfinding.ts`); o `committedDeposit` pesa esperar × andar uma vez por intervalo de
  regeneração, **no segundo do meio, o mesmo para todos** (uma fase pelo id quebrava o espelho entre os times:
  teste em `bot-world.test.ts`); `params.gather.{materia,cristal}.{units,everySeconds}` (`economy.ts`);
- **rede:** `PROTOCOL_VERSION` 3, `welcome` só com o tamanho do mapa; o terreno chega pelo `known` do delta;
- **cliente:** a névoa é a `FogLayer` (`map/fog-layer.tsx`; véu 0,55, nunca visto `#050608`); seleção por área
  (`map/layout.ts`, `MIN_HIT_PX` = 20) com lista quando o clique cai em vários; cursor da ação
  (`map/cursor.ts`, `cursorAt` num signal ligado ao `style` do mapa); `roadPreview` compartilhado pela prévia
  de estrada e pelo cursor;
- o replay de um mundo só abre depois que ele acaba: para uma sessão, `--mult` alto ou o mundo do soak;
- screenshot sem navegador: o Chromium headless do cache do Playwright
  (`~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell --screenshot … --virtual-time-budget=10000 <URL do dev:multi>`).
  O cursor não aparece no screenshot: os ícones se conferem renderizando os SVG numa página.

**Push:** o Git do WSL não tem credencial do GitHub; o dono faz o push pelo PowerShell (`git push origin main`).

### Pendências vivas

Só o que ainda está aberto. Ao resolver, tire daqui e registre no Histórico.

- **Perguntas abertas do GDD 06 e 08 que a fatia A não cobre** (duração da batalha, tempo do mundo durante a luta,
  canais e sintaxe do chat, macros, reparo): ficam para as fatias B a E.
- **Deploy** (quando acontecer): quem cria o mundo escolhe a seed no lobby (N9) e criar mundo deixa de ser público;
  o snapshot com a memória do fog (117 MB de SQLite num mundo de 3 dias) passa a ser guardado compactado, com o
  `SIM_VERSION` seguinte; os snapshots antigos são podados; o cliente ganha um link para o código-fonte (a licença
  é a AGPL-3.0, cuja seção 13 pede oferecer o código a quem usa pela rede).
- **Olhos novos** (quando o dono achar o jogo divertido): o playtest com pessoas que nunca viram o jogo responde de
  novo à hipótese do M1.5 (o roteiro e as perguntas de névoa estão no [PLAYTEST.md](../PLAYTEST.md)); observar se
  travam num mundo só de humanos, em que ninguém explora sem ordem (regra D3).
- **`SIM_VERSION` (hoje 7, desde a F2 do encontro):** mundos persistidos guardam a versão. Mudou o comportamento do `sim`?
  Suba a versão; um mundo de outra versão não é recuperado (o servidor loga e o pula).
- **Servidor no `/mnt/c`:** subir o `npm run server` às vezes leva mais de 5 s (WSL). Scripts que sobem o
  servidor devem esperar a porta responder, não um `sleep` fixo.
- **`npm audit`:** aviso moderado (ReDoS no `minimatch`, dentro do typescript-eslint, só em dev). Sem correção
  que não quebre; reavaliar quando o typescript-eslint atualizar.
- **TypeScript fixado em `~6.0`:** o typescript-eslint ainda não suporta o TS 7.

## Marcos

| Marco | Status |
|---|---|
| M0 — Design | ✅ |
| M1 — O ciclo da riqueza | ✅ 2026-11-14 |
| M1.5 — A névoa | ✅ 2026-11-14 (rede e fog of war) |
| M2 — A emboscada | 🟡 Fatia A: F0 ✅, F1 ✅, F2 ✅, F3–F6 ⬜ · Fatia B: F0 ✅, F1–F5 ⬜ · Fatias C, D, E ⬜ |
| M2.5 — A jungle hostil e o fim do mundo | ⬜ (fim do mundo decidido no GDD, 2026-11-15) |
| M3 — O time · M4 — O mundo vivo · M5 — As lendas | ⬜ |

## Workflow

- Branch por fase (`m<marco>/f<fase>-<slug>`), Conventional Commits por unidade lógica, merge `--no-ff` em `main`:
  skill [`commit`](../../.claude/skills/commit/SKILL.md).
- Implementar uma fase: skill `implement-phase`. Convenções de código: "Convenções do `sim`" no CLAUDE.md.
- Outras skills: `adr`, `gdd-decision`, `spec-slice`. Skills novas só quando uma necessidade aparecer na prática.
- Comandos: seção "Comandos" do [CLAUDE.md](../../CLAUDE.md). `npm run check` = o que o CI roda.

---

# Histórico

## Etapas, em ordem cronológica

| Etapa | Status | Onde ver |
|---|---|---|
| M0 — Design | ✅ Concluído. Pilares, GDD (com propostas e perguntas abertas por sistema), ADRs 0001–0005 `Accepted` | [PILLARS](../PILLARS.md) · [GDD](../gdd/README.md) · [ADRs](../adr/README.md) |
| M1 — spec | ✅ Aprovada (2026-11-13). Decisões de escopo D1–D10 | [spec.md](../specs/m1-ciclo-da-riqueza/spec.md) |
| M1 — plan | ✅ Aprovado (2026-11-13), com P1–P6 decididas | [plan.md](../specs/m1-ciclo-da-riqueza/plan.md) |
| M1 — F0 Bootstrap | ✅ Concluída, merge em `main`. Workspaces, TS strict, ESLint com as regras de determinismo, Vitest, CI | [tasks.md §F0](../specs/m1-ciclo-da-riqueza/tasks.md) |
| M1 — F1 Núcleo do sim | ✅ Concluída, merge em `main`. RNG, params, mapa simétrico, `WorldState`, serialize/restore, `step` vazio, `geo verify` no CI | [tasks.md §F1](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/` |
| M1 — F2 Movimento | ✅ Concluída, merge em `main`. Pontos de movimento em ‰, A* com cache, ordens `moveTo`/`stop` no pipeline | [tasks.md §F2](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{movement,pathfinding,orders}.ts` |
| M1 — F3 Economia | ✅ Concluída, merge em `main`. Ordens `gather`/`deliver`/`buildRoad`, regeneração, produção com "repetir", upgrade de capacidade. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F3](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{economy,production,roads,orders}.ts` |
| M1 — F4 Piloto automático e domínio | ✅ Concluída, merge em `main`. Vocabulário de comandos + `validate`, jogadores, domínio D-1..D-4, interpretador de regras, presets, `setRules`/`applyPreset`. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F4](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{commands,domination,autopilot,presets,rules}.ts` |
| M1 — F5 Harness | ✅ Concluída, merge em `main`. Checkpoint revisado pelo dono (2026-11-13): a economia precisa de balanceamento. Stats + `sampleMetrics`, estrategista `balanced`, `geo sim`/`report`/`sweep`, `geo verify` com bots e replay do log, orçamento de 6 h no CI. Detalhes decididos pelo dono no [plan §9](../specs/m1-ciclo-da-riqueza/plan.md) | [tasks.md §F5](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/cli/src/` · `packages/sim/src/stats.ts` |
| M1 — Balanceamento 1 | ✅ Decidido pelo dono (2026-11-14): candidato B no `params/default.json` provisório; DNAs economicamente equivalentes de propósito; playtest humano e deploy saem do M1. Assimetria entre os times corrigida (desempate do A*). Na branch `m1/f6-server` | [balance.md](../specs/m1-ciclo-da-riqueza/balance.md) |
| M1 — F6 Servidor | ✅ Concluída, merge em `main`. SQLite (log de comandos, snapshots, métricas), loop de tick com multiplicador, HTTP (criar, listar, entrar), WebSocket com ack/reject e broadcast ≤5/s, `release` automático, bots e limite de humanos, recuperação após restart. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F6](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/server/src/` · `packages/protocol/src/` |
| M1 — F7 Cliente | ✅ Concluída, merge em `main`. Checkpoint aprovado pelo dono (2026-11-14). Lobby, mapa SVG com pan/zoom, creeps interpolados com nomes gerados, pilhas de creeps com lista para escolher, inspetor, dominar/liberar, painel do Núcleo, editor de regras e presets, controle direto pelo botão direito. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F7](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/client/src/` |
| M1 — F8 Replay e multi-cliente | ✅ Concluída, merge em `main`. Replay no navegador (arquivo do `geo sim` ou `GET /api/worlds/:id/replay`) com velocidades, linha do tempo e hash ✓/✗; hash confere no WebKit/JSC; `npm run dev:multi`. Detalhes decididos pelo dono no [plan §8](../specs/m1-ciclo-da-riqueza/plan.md) | [tasks.md §F8](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/client/src/replay/` · `apps/server/src/dev-multi*.ts` |
| M1 — F9 Legibilidade e playtest | ✅ Concluída, merge em `main`. Fecha o M1. Feito: `npm run soak` (teste de resistência comprimido, no lugar do mundo de 24 h), estrada × pedra, nomes no mapa (Chakra Petch), carga cheia, `+N`/`−N` no Núcleo, custo da estrada sob o cursor e tempo da obra, [PLAYTEST.md](../PLAYTEST.md). **Checkpoint** (dono, 2026-11-14): playtest parcial e replay validados, sem achados | [tasks.md §F9](../specs/m1-ciclo-da-riqueza/tasks.md) · [spec §8](../specs/m1-ciclo-da-riqueza/spec.md) |
| Deploy e playtest de diversão | Saíram do M1 (dono, 2026-11-14). **Não bloqueiam mais o M2 nem o M3** (dono, 2026-11-15): a diversão é julgada pelo dono nos playtests locais; o deploy espera o combate dizer quanta latência é aceitável | [ROADMAP](../ROADMAP.md) |
| M2 — brainstorm | ✅ Respondido pelo dono (2026-11-15, rodada interativa). Ideias do dono com a análise do agente; decisões nos GDD 01, 02, 03, 05, 06, 07 e no GDD 08 novo (crônica, chat e console); **marco novo M2.5 — A jungle hostil** no ROADMAP. **Rodada de design encerrada**, merge em `main` (`m2/f0-design`); os detalhes restantes vão para a spec | [brainstorm §0](../brainstorm/2026-11-15-m2-m3.md) · [ROADMAP](../ROADMAP.md) |
| M1.5 — A névoa | 🟡 Em andamento (dono, 2026-11-14). Duas fatias: rede (deltas da visão de cada time, [ADR-0006](../adr/0006-sync-do-mundo.md), aceito) ✅ concluída, e depois fog of war 🟡 (rodada de design, spec e plan ✅ 2026-11-14; F1 ✅; F2 ✅; F3 ✅; F4 ✅; F5 ✅; F6 ⬜) | [ROADMAP](../ROADMAP.md) |
| M1.5 rede — spec | ✅ Aprovada (2026-11-14). Decisões D1–D8; critérios de viabilidade na §7 | [spec.md](../specs/m1.5-rede/spec.md) |
| M1.5 rede — plan | ✅ Aprovado (2026-11-14), com R1–R7 decididas | [plan.md](../specs/m1.5-rede/plan.md) |
| M1.5 fog — spec | ✅ Aprovada (2026-11-14). Decisões D1–D12 (D1: pedras bloqueiam a visão, escolha do dono; D3/D4: como e para onde se explora, no GDD 07); critérios na §7 | [spec.md](../specs/m1.5-fog/spec.md) |
| M1.5 fog — plan | ✅ Aprovado (2026-11-14), com N1–N10 (N4 trocou a distância do "explorar" para passos; N8: bot sem batedor até medir; N9: campo de seed fica no lobby). Fases F1–F5 | [plan.md](../specs/m1.5-fog/plan.md) · [tasks.md](../specs/m1.5-fog/tasks.md) |
| M1.5 rede — F0 Spike | ✅ Concluída, merge em `main`. Diff à mão em JSON por uma visão com cópia rasa: ~41 µs por mundo por envio (2 times), ~257 bytes por delta; o schema do Colyseus funciona, mas não foi adotado (R1) | [plan §1](../specs/m1.5-rede/plan.md) · [tasks.md](../specs/m1.5-rede/tasks.md) |
| M1.5 rede — F1 Visão no `sim` | ✅ Concluída, merge em `main`. `view(state, team)` e `TeamView`; o estrategista decide pela visão do time + mapa estático + parâmetros; hash de 6 h travado em teste e o de 3 dias (`10662729…`) inalterado | [tasks.md](../specs/m1.5-rede/tasks.md) · `packages/sim/src/view.ts` |
| M1.5 rede — F2 Delta no `protocol` | ✅ Concluída, merge em `main`. `diffView`/`applyDelta`/`viewJson`, propriedade de 6 h × 3 seeds no CI, `geo net`. **Checkpoint** (3 dias, seed 42): 227 B/s por cliente a ×1 (alvo ≤ 2 KB/s), 83 µs por envio (alvo ≤ 250 µs), 0 divergências em 518 400 verificações, hash `10662729…` igual | [tasks.md](../specs/m1.5-rede/tasks.md) · `packages/protocol/src/delta.ts` · `apps/cli/src/net.ts` |
| M1.5 rede — F3 Servidor | ✅ Concluída, merge em `main`. Protocolo 2: `welcome` com a última visão enviada ao time, `delta` numerado por time (inclusive sem socket), hash a cada 60 ticks, retomada pelo buffer de 30 s, `resync` com linha no log. O store do cliente já aplica os deltas (1ª task da F4) | [tasks.md](../specs/m1.5-rede/tasks.md) · `apps/server/src/{stream,ws}.ts` |
| M1.5 rede — F4 Cliente | ✅ Concluída, merge em `main`. Retomada com `&stream=…&seq=…`, `resync` por `seqGap` e por hash divergente (Web Crypto), recarga com outra versão do protocolo, painel `?net=1`. Conferido no Chromium com `kill -9` + restart do servidor | [tasks.md](../specs/m1.5-rede/tasks.md) · `apps/client/src/{connection,store,net-panel}.ts*` |
| M1.5 rede — F5 Soak e viabilidade | ✅ Tasks concluídas, merge em `main`. `npm run soak` com 2 clientes sem interface por time: 0 hashes divergentes, visões finais iguais à do servidor, retomadas pelo buffer e `welcome` depois de cada restart. **Todos os critérios da spec §7 verdes.** **Checkpoint** (dono, 2026-11-14): sessão com `dev:multi --net` e reconexão ok; segue para o fog; id do stream na URL aprovado | [viability.md](../specs/m1.5-rede/viability.md) · `apps/server/src/soak-client.ts` |
| M1.5 fog — F1 Visão e memória | ✅ Concluída, merge em `main`. Params de visão, linha de visão (Bresenham inteiro no referencial do time), `TeamMemory` com `updateVision` incremental (estágio 6), `view` filtrada e `fullView`, delta com `known`/`visible` (1ª task da F3, adiantada), `SIM_VERSION` 3 | [tasks.md](../specs/m1.5-fog/tasks.md) · `packages/sim/src/{vision,view}.ts` |
| M1.5 fog — F2 Pelo que o time sabe | ✅ Concluída, merge em `main`. Mapa conhecido (`known.ts`), A* e estradas pelo que o time sabe, piloto pela memória, ordem/ação `explore` e condição `resourceUnknown`, presets coletor e `scout`, recusas sem vazamento, estrategista só com a visão, métricas novas. **Checkpoint** (dono, 2026-11-14): início de partida ✅ (1ª matéria em 2–7 min, seeds 1–20); economia aceita (matéria −13% a −20% em 3 dias); custo do tick 2,2× aceito; divergência entre os times a rever no rebalanceamento ([plan §10](../specs/m1.5-fog/plan.md)) | [tasks.md](../specs/m1.5-fog/tasks.md) · `packages/sim/src/known.ts` · `runs/m1.5-fog-f2-checkpoint/` |
| M1.5 fog — F3 Rede e servidor | ✅ Concluída, merge em `main`. `welcome` só com o tamanho do mapa (sem terreno, sem `cores`), `PROTOCOL_VERSION` 3; seed `null` e replay → 409 em mundo vivo; propriedade de 6 h com creep inimigo e Núcleo inimigo. **Checkpoint `geo net`** ✅: 195 B/s, 121 µs por envio, 0 divergências | [tasks.md](../specs/m1.5-fog/tasks.md) · `apps/server/src/{http,ws}.ts` · `runs/m1.5-fog-f3-checkpoint-net/` |
| M1.5 fog — F4 Cliente | ✅ Concluída, merge em `main`. Névoa com os três estados (negro, véu, visível), lembrados sob o véu; creep inimigo que sai da visão; sem custo de estrada sobre célula nunca vista; ação explorar, condição "não conhece depósito de" e preset Batedor no editor; replay sem névoa. Nomes de creep pelo id | [tasks.md](../specs/m1.5-fog/tasks.md) · `apps/client/src/map/{fog,fog-layer}.ts*` |
| M1.5 fog — F6 Ajustes do playtest | ✅ Concluída, merge em `main`. Coletor pelo tempo de viagem e que só espera a matéria se compensar, ritmo de coleta por recurso (cristal 1 a cada 5 s), clique por área com lista, cursor com a ação; `SIM_VERSION` 5. **Checkpoint** (dono, 2026-11-14): coletores mais produtivos, seleção bem melhor; recomendações aceitas; **fecha o M1.5** | [tasks.md](../specs/m1.5-fog/tasks.md) · `runs/m1.5-fog-f6/` |
| M1.5 fog — F5 Soak e legibilidade | ✅ Concluída, merge em `main`. Soak com o fog (`SIM_VERSION` 3 e 4) sem divergência; perguntas de névoa no PLAYTEST; alvo de explorar desempatado pelo ganho (decisão do dono depois de um vídeo do batedor). Sessão 2 do dono: o fog e a exploração cumprem o papel; os achados viram a F6 | [tasks.md](../specs/m1.5-fog/tasks.md) · `runs/m1.5-fog-f5-explore/` |
| M2 — fatias | ✅ Decididas pelo dono (2026-11-15): A o encontro → B o laboratório de batalha → C chat, console e macros → D a junção (com os errantes) → E cerco e reparo | [ROADMAP](../ROADMAP.md) |
| M2 A (encontro) — spec | ✅ Aprovada (2026-11-15), com D1–D21 decididas na rodada interativa; as de gameplay no GDD 01, 02, 03, 06, 07, 08; a ideia do dono de acampamento e torres em incubação no GDD 01. ADR-0007 (eventos do `sim`) ✅ `Accepted` (2026-11-15) |
| M2 A (encontro) — plan | ✅ Aprovado (2026-11-15), com P1–P11 pela proposta; fases F1–F6 no tasks.md. F0 ✅ | [plan.md](../specs/m2-encontro/plan.md) · [tasks.md](../specs/m2-encontro/tasks.md) | [spec.md](../specs/m2-encontro/spec.md) |
| M2 B (laboratório) — spec e plan | ✅ Aprovados (2026-11-15), escritos numa sessão paralela (worktree `../geometrix-lab`); ADR-0008 (pacote de batalha) ✅ `Accepted`. Fases F1–F5 no tasks.md | [spec.md](../specs/m2-laboratorio/spec.md) · [plan.md](../specs/m2-laboratorio/plan.md) · [tasks.md](../specs/m2-laboratorio/tasks.md) |
| M2 A — F2 O encontro no `sim` | ✅ Concluída, merge em `main`. Ordens `approach`/`pickup`/`flee`, o estágio de encontros (abrir, diálogo, rodadas, fechar), extorsão com salvo-conduto e bloqueio, fuga pela velocidade, sorteio pelo HP × DNA, morte, saque e despojo, o vocabulário de encontro e as regras de reação, o preset salteador, o comando `react`, todos os eventos; `SIM_VERSION` 7 | [tasks.md](../specs/m2-encontro/tasks.md) · `packages/sim/src/{encounter,approach,spoils}.ts` |
| M2 A — F1 Identidade, HP e eventos | ✅ Concluída, merge em `main`. Params do encontro, nomes no `sim` pelo contador de nascimentos, HP em milésimos com regeneração e `kill`, `step` devolve os eventos (`born`) com o público e `eventsFor`, nome/HP/encontro do inimigo na visão, `SIM_VERSION` 6 | [tasks.md](../specs/m2-encontro/tasks.md) · `packages/sim/src/{names,hp,events}.ts` |
| Fim do mundo — brainstorm | ✅ Respondido pelo dono (2026-11-15, rodada interativa). A duração termina num apocalipse: a corrupção dos depósitos de cristal esgotados, que não pode ser limpa e é vista de longe; só o final feliz das tribos (M4) a detém, e salva o mundo inteiro; vitória pírrica com humor; qualquer creep vivo no fim vira lenda; empate no relógio da fatia E. **ROADMAP:** fatias do M2 como grafo, M2.5 "A jungle hostil e o fim do mundo", M5 novo, "As lendas" | [brainstorm §0](../brainstorm/2026-11-15-fim-do-mundo.md) · [ROADMAP](../ROADMAP.md) |
| M2.5, M3, M4, M5 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Achados do playtest

Um item por problema: o que a pessoa não entendeu ou não conseguiu, a tarefa ou pergunta do
[PLAYTEST.md](../PLAYTEST.md) que mostrou, e quantas pessoas tropeçaram nele.

- **Sessão 1 (dono, 2026-11-14):** `npm run dev:multi -- --clients 3 --mult 36` (padrão de 3 dias de mundo), sem
  ir até o fim do mundo (o fim já é coberto pelo `npm run soak`). Replay testado pelo dono: ok, o pendente do F8
  está resolvido. **Nenhum problema reportado.** Ainda sem uma pessoa que nunca viu o jogo (ver "Pendências vivas", no topo).

- **Sessão 2 (dono, 2026-11-14):** `dev:multi` com o fog, na branch da F5. **O fog e a exploração cumprem o papel
  esperado.** Achados, todos levados à F6 ([tasks](../specs/m1.5-fog/tasks.md)) e resolvidos (sessão 3):
  - **o batedor varria a borda do escuro uma linha de visão por vez** (vídeo do dono): resolvido na F5, com o alvo
    de explorar desempatado pelo ganho;
  - **coletores de matéria disputam o depósito mais perto do Núcleo e esperam a regeneração, 1 a 1,** em vez de
    pegar a estrada pronta até um depósito cheio um pouco mais longe (nos 3 dias do seed 42, os creeps passam
    29–51% do tempo parados a partir da 12ª hora);
  - **o cristal se esgota rápido demais** (o mapa inteiro em 8,6 h de 72);
  - **com o zoom afastado, o clique numa "bola" sobreposta a outros creeps não seleciona o que se quer:** a área
    de clique é de meia célula pelo centro mais próximo;
  - **falta feedback de qual ação o clique vai gerar:** pedido de cursor com o ícone da ação.

- **Sessão 3 (dono, 2026-11-14), checkpoint da F6:** branch da F6. **Os coletores ficaram mais produtivos, circulando
  entre os depósitos, e a seleção por área (em vez de célula) melhorou bastante a UX de clique e toque.** Nenhum
  problema novo. Fecha o M1.5.

## Registro das fases

Medições, interpretações e decisões de cada fase, da mais recente para a mais antiga.

- **M2 A F3, 2ª rodada do checkpoint** (2026-11-15). Decisões do dono na 1ª rodada no [plan §11.1](../specs/m2-encontro/plan.md)
  (C1–C5): os salteadores do bot voltam a coletar sem nada para explorar (C1); os coletores do bot ganham postura
  de reação pelo DNA (C2). 2 278 testes. Relatórios `runs/m2-encontro-f3/f3b-*`.

  | Medida | F6 do fog | F3, 1ª rodada | F3 com C1 e C2 |
  |---|---|---|---|
  | `geo sim` de 3 dias, seed 42 (intercalado) | 12,2–12,4 s | 17,9–18,6 s | **13,4–13,7 s (1,10×)**; só com o C1: 9,2–9,8 s |
  | Matéria entregue, seed 42, 3 dias (time 0 / time 1) | 177 310 / 177 310 | 175 821 / 175 821 | **140 230 / 185 830** |
  | Creeps parados, seed 42 (time 0 / time 1) | 24% / 24% | 41% / 41% | 49% / 22% |
  | Encontros, seed 42, 3 dias (abordou, time 0 / time 1) | — | 32 / 32 | 8 / 52, todos nas primeiras 6 h |
  | Seeds 1–20 × 6 h: encontros por time por hora | — | 0,8 | 3,4 (0,3–9,6) |
  | pagos / com fuga / com morte | — | 97% / 1% / 1% | 1% / 90% / 9% |
  | fugas que escaparam | — | 25% (18 seeds sem fuga) | 53% (6–82%) |
  | na zona do Núcleo da vítima | — | 65% | 90% (50–100%) |
  | mortes por time; diferença em matéria | — | 0,1; 38 | 0,9; 273 (15–1 090) |

  - **Encontros só no começo.** Com o C1, os salteadores existem enquanto há o que explorar (~8 h no seed 42);
    depois não há mais nenhum encontro. Nas primeiras horas eles extorquem perto do Núcleo inimigo, onde passam os
    coletores carregados (90% dos encontros na zona do Núcleo da vítima).
  - **A postura em ação:** quase toda vítima tenta fugir (o ● é o mais abordado: 74 tentativas no time 0, 58%
    escapam); fugir pela estrada escapa mais que pela selva (67% × 47% no time 0). **O ▲ quase nunca paga:** a
    exigência costuma ser a carga inteira (o salteador está vazio), acima dos 500‰ da regra.
  - **O espelho do seed 3 acaba no 1º sorteio** (tick 7040, duas fugas no 7039), como o plan §4 aceita; o teste de
    espelho vale até ali. No seed 42, até as 2 h não há sorteio.
  - **A diferença de 25% no seed 42 não vem dos encontros** (o saldo deles é de 141 de matéria). Vem da memória do
    fog: o time 0 lembra o depósito nº 2 (a 10 células do Núcleo dele, fora da visão) como vazio, e o piloto só
    escolhe depósito com quantidade lembrada acima de zero; ele regenera até 133 e os coletores do time 0 esperam em
    depósitos secos, enquanto o time 1, que tem creeps ali, o explora. Com os times espelhados (F6, seed 42) isso
    não aparecia; o primeiro sorteio os separa e a diferença cresce a partir da 30ª hora. Os dois chegam ao teto de
    30 creeps (44,2 h × 41,1 h); B-2 continua OK.
  - Interpretação, a validar: as regras de reação não distinguem o diálogo da luta, então o ▲ e o ● tentam fugir
    também a cada rodada.

- **M2 A F3 — Bots e harness** 🟡 checkpoint do dono (2026-11-15). 2 276 testes; `geo verify` OK nas seeds 1, 42 e
  649, agora com o hash dos eventos. Relatórios em `runs/m2-encontro-f3/` (`f3-*`: atual; `f6-base-*`: a F6 do
  fog, worktree em `b36df57`, rodada na mesma máquina, intercalada).

  | Medida | F6 do fog | F3 |
  |---|---|---|
  | `geo sim` de 3 dias, seed 42 (3 execuções cada, intercaladas) | 12,0–12,5 s | 17,9–18,6 s (**1,47–1,55×**; alvo ≤ 1,5×) |
  | Hash de 3 dias, seed 42 | `b64579c3…` | `cdc25785…` |
  | Matéria entregue, seed 42, 3 dias (por time) | 177 310 | 175 821 (−0,8%) |
  | Matéria entregue, seeds 1–20, 6 h (média por time) | 6 181 | 4 969 (−20%: 1 dos 3 coletores de matéria vira salteador) |
  | Teto de 30 creeps, seed 42 | 39,4 h | 40,1 h |
  | Creeps parados, seed 42, 3 dias | 24% | 41% (47–49% depois da 42ª hora) |
  | Cristal do mapa esgotado, seed 42 | 9,4 h | 7,6 h |
  | Cristal parado no estoque, seed 42 / seeds 1–20 × 6 h | 68% / 78% | 68% / 81% |
  | Mapa explorado, seeds 1–20 × 6 h | 37% | 95% (o salteador explora) |
  | Núcleo inimigo visto, seeds 1–20 × 6 h | 3,7 h (18× nunca) | 1,8 h (2× nunca) |

  **Encontros.** Seed 42, 3 dias: 32 por time (0,4 por hora), todos extorsões, **todos pagos pelo padrão** (D13),
  nenhuma luta, nenhuma morte; 422 de matéria e 15 de cristal mudaram de mão por time (0,24% da matéria entregue);
  os times terminam idênticos (nenhum sorteio aconteceu, o espelho vale os 3 dias). Seeds 1–20 × 6 h: 0,8 por time
  por hora (0,3–1,4); 97% pagos, 1% com fuga, 1% com morte; 0,1 morte por time; 25% das fugas escaparam (18 seeds
  sem fuga nenhuma); diferença entre os times de 0–1 creep e 38 de matéria (0–269). **Sem bola de neve** (B-2 OK).
  **Acampamento** (D21): 65% dos encontros das 6 h na zona do Núcleo da vítima (0–100%); 9% nos 3 dias do seed 42.

  **Por quê** (seed 42, eventos e estado): até ~8 h os salteadores exploram, chegam ao lado inimigo e extorquem
  coletores perto do Núcleo deles (a 4–10 células). **Com o mapa explorado, o preset não tem o que fazer:** os 5
  salteadores de cada time voltam e ficam parados no próprio Núcleo (`stop`) até o fim. Só há encontro quando um
  coletor inimigo passa a até 10 células desse Núcleo (30–38 h, quando os depósitos do lado dele secam; 26
  encontros por time); depois da 42ª hora, nenhum. Os parados a mais são esses 5 e coletores esperando em depósito
  seco (média de 9 por depósito no fim, contra 78 na F6).

  **Custo do tick.** O 1º `geo sim` de 3 dias levou 189 s: o salteador sem nada para explorar varria o mapa todo
  atrás de célula nunca vista, a cada tick (sobram 11, todas pedra no miolo de blocos de rocha). Corrigido sem
  mudar o resultado (`perf(sim)`: sem célula nunca vista vizinha de uma vista transitável, nenhuma é alcançável;
  teste de propriedade contra a busca completa). O que sobra é essa verificação (~4 µs, ~2 milhões de vezes em 3
  dias): cortá-la pede um cache no estado (muda o hash) ou que o salteador pare de tentar explorar (pergunta 1).

  Interpretações, a validar:
  - Os salteadores saem dos coletores de matéria de menor id **depois** dos coletores de cristal e do construtor
    de estrada (com 6 creeps: 2 cristal, 1 estrada, 1 salteador, 2 matéria).
  - **Dois desempates por id quebravam o espelho entre os times** e o salteador explorando os expôs (seed 3 se
    separava em 1,3 h): o alvo de estrada do bot e o depósito (ou despojo) alcançado com o mesmo custo no piloto.
    Agora desempatam pela célula no referencial do time, como o `explore` e o `approach` (`fix(sim)`). O hash de 6
    h sem salteadores não mudou.
  - Métricas na CLI (P6): `encounters.json` no run; o desfecho conta "escapou no diálogo" e "escapou na luta"
    (de qualquer um dos dois); a reação conta só a da vítima no diálogo; a fuga por terreno usa a célula de quem
    foge, com estrada valendo sobre o terreno; o que um morto larga no despojo é a carga dele no fim do tick
    anterior menos o saque (o evento `looted` não traz o resto).
  - O HP médio entra nas amostras do `sampleMetrics` como somas (`hp`, `hpMax`), fora do estado.
  - O mundo de 6 h do `bot-world.test.ts` leva ~30 s com a suíte inteira: timeout de 60 s.

- **M2 A F2 — O encontro no `sim`** ✅ (2026-11-15). 2 263 testes; `geo verify` OK; `geo sim` de 3 dias do seed
  42 em 14,2 s (F1: 12,1 s; o bot ainda não aborda ninguém), hash `e15dcec1…`. Rascunho com salteadores (1 em 4
  e 1 em 2 creeps, seeds 42, 1, 7 e 649, 6 h e 24 h): nenhuma exceção, nenhum encontro órfão; de 6 a 17
  encontros por mundo, quase todos pagos (o padrão do coletor é pagar), 1–2 mortes. Interpretações, a validar:
  - **`SIM_VERSION` 7**, não 6 como na spec D20: a F1 já estava em `main` com o 6, e a F2 muda o comportamento.
  - As tasks de diálogo, luta e fuga saíram num commit só: são uma máquina de estados (a fuga que falha abre a
    luta; a luta tem fuga).
  - A 1ª rodada vem `fight.roundSeconds` depois do início da luta, não no mesmo tick.
  - O `Encounter` ganhou `aggressorReply` (o plan só tinha `reply`): na luta, o jogador que domina o agressor
    também pode pedir a fuga.
  - Abordagem do jogador a um alvo engajado, com salvo-conduto contra o time ou (na extorsão) em fuga: a ordem
    continua perseguindo e espera. Par bloqueado, como exigência 0: a ordem termina.
  - No encontro mútuo, se quem escolhe primeiro não pode abrir (ex.: extorsão sem exigência), o outro tenta.
  - Na luta, o evento `reaction` sai só quando alguém tenta fugir; o creep dominado sem resposta segue as regras
    dele (ex.: o salteador foge abaixo de 400‰).
  - A ação `approach` mantém o alvo enquanto ele passa em todo o filtro, raio incluído; `minCargo` é a carga
    total; o empate é pela célula no referencial do time e depois pelo id.
  - O `pickup` anda pela memória e cata no tick em que chega; a ação mantém o despojo enquanto o time lembra dele.
  - O creep em fuga regenera HP (não está em encontro).
  - A fuga sorteia a fração dos dois recursos sempre (a sequência do `rng` não depende da carga).
  - O próprio creep na visão mostra o `safeConduct` (o `protocol` o compara por valor); `extortBlocks` fica fora da
    visão.
  - O cliente ganhou só o mínimo para compilar (rótulos, textos, botão "Salteador"); o editor e o mapa são da F5.

- **M2 A F1 — Identidade, HP e eventos** ✅ (2026-11-15). 2 205 testes; `geo verify` OK
  (`cbeb5ef5…`, 50 000 ticks); `geo sim` de 3 dias do seed 42 em 12,1 s (a F6 do fog: 13–14 s), hash novo
  `34b29d28…` (o estado tem campos novos; nenhum creep perde HP ainda, então o comportamento é o da F6).
  Interpretações, a validar:
  - O `engagement` entrou no `Creep` já na F1 (sempre `null`), porque a visão (D18) e a regeneração ("fora de
    encontro") dependem dele; a entidade `Encounter` é da F2.
  - O `name` foi para o creep inimigo na visão já na task dos nomes (o cliente desenha o nome de todos).
  - A regeneração do HP acontece no tick que fecha o minuto de mundo, como a dos depósitos; os params passam a
    exigir que `world.tickSeconds` divida 60.
  - Os nomes mudam em relação ao M1.5 (P5): os 12 creeps iniciais pegam os nascimentos 0 a 11, e o `createWorld`
    não emite `born` (não é um `step`).
  - O union dos eventos já tem os nove tipos do plan §7; só o `born` é emitido na F1.

- **Checkpoint da F6 do fog** ✅ (fechou o M1.5; spec §11, decisões no [plan §10](../specs/m1.5-fog/plan.md)). Relatórios em `runs/m1.5-fog-f6/`; a F5 rodada de novo
  na mesma máquina (`f5-base-sweep`, worktree em `70b5457`).

  | Medida | F5 | F6 |
  |---|---|---|
  | Creeps parados, seeds 1–3 (3 dias) | 55% (42–64) | 34% (25–40) |
  | Creeps parados, seed 42 | 35% / 39% | 24% / 24% |
  | Matéria entregue, seeds 1–3 (média por time) | 160 966 | 176 715 (+10%) |
  | Matéria entregue, seed 42 | 146 535 / 156 495 | 177 310 / 177 310 |
  | Teto de 30 creeps, seeds 1–3 / seed 42 | 44,1 h / 42,6 e 42,0 h | 38,9 h / 39,4 h |
  | Upgrade comprado, seeds 1–3 / seed 42 | 1,2 h / 1,4 h | 1,3 h / 1,5 h |
  | 1ª matéria / 1ª cristal do time mais lento, seeds 1–3 | 3 / 31 min | 3 / 33 min |
  | **Cristal do mapa esgotado**, seeds 1–3 / seed 42 | 9,8 h / 8,6 h | 9,7 h / 9,4 h |
  | Diferença entre os times na matéria, seeds 1–3 | 4 565 | 3 150 |
  | `geo sim` de 3 dias, seed 42 (2 execuções cada, em sequência) | 9,6–10,5 s | 13,0–14,0 s (~1,35×) |

  - **O cristal:** o ritmo de coleta quase não adia o esgotamento. Varredura de `gather.cristal.everySeconds`
    (seeds 1–3, só com o E1; `e2-sweep-cristal`): 1 s → 8,7 h; 5 s → 9,1 h; 10 s → 10,2 h; 20 s → 12,4 h; 30 s →
    12,6 h; a 1ª entrega de cristal atrasa (31 → 45 min) e o upgrade também (1,2 → 1,8 h). O E1 deixou os
    coletores mais rápidos, e isso come o ganho do ritmo (F6 com 5 s: 9,7 h, igual à F5). O motivo está nos
    números: cada time coleta os 1 200 do seu lado, gasta ~390 e termina com 810 parados no estoque (68%). Quem
    esgota o mapa é o bot, que nunca para de coletar cristal; o ritmo só muda quanto tempo isso leva.
  - **Espelho entre os times:** o E1 pesava esperar × andar num tick escolhido pelo id do creep, e o creep espelhado
    tem outro id; os times se separavam em 0,5–1,3 h. Corrigido (o mesmo segundo para todos): voltam a se separar
    só em 13,5–32 h, pelo desempate por id em depósito disputado (aceito na F2). No seed 42, os dois times terminam
    iguais.
  - **Critérios da §7:** `geo verify` OK; `geo net` 206 B/s (pico 1 897 B), 126 µs por envio, 0 divergências em
    518 400 verificações (`f6-net`); hash de 3 dias `b64579c3…`; 2 188 testes. **Soak com o `SIM_VERSION` 5**
    (`runs/soak-20261115-011201-s42/summary.md`): OK, 12,4 min; 0 hashes divergentes em 14 360, as 4 visões
    finais iguais às do servidor, replay com o hash do servidor, 6 interrupções de volta em 1,5–2,3 s; banda
    10,8–11,2 KB/s (pico 39,3); laço com mediana 100%, o tick mais lento a 4%; memória máxima 216 MB; SQLite
    117 MB.

  **Decisões do dono (2026-11-14)**, todas pelas recomendações do agente:
  1. **Cristal:** 1 a cada 5 s fica como provisório; o esgotamento fica para o M2, com o papel do cristal (GDD 03).
  2. **Sessão de legibilidade:** feita (sessão 3, acima); o M1.5 fecha. O teste com pessoas novas fica para o M2.
  3. **Interpretações da F4 e da F6:** ficam como estão.
  4. **Mundo só de humanos sem exploração sem ordem** (regra D3): mantida; observar no playtest do M2.
  5. **Tamanho do snapshot:** rever no deploy do M2.
  6. **Custo do tick** (~1,35× o da F5): aceito.

- **Interpretações da F6 do fog** (o plan não fixava; mantidas pelo dono no checkpoint):
  - **E1:** o tempo de viagem usa a velocidade do creep vazio e o mapa conhecido (o escuro conta como selva);
    esperar conta a carga livre dos colegas de id menor no mesmo depósito; o creep pesa uma vez por intervalo de
    regeneração (60 s), no segundo do meio, e só os depósitos com matéria para toda a sua carga livre são
    candidatos;
  - **E2:** a coleta segue o relógio do mundo, como a regeneração: quem chega ao cristal espera até 5 s pela 1ª
    unidade, e entre uma e outra o creep aparece como "coletando";
  - **E3:** área mínima de clique de 20 px de raio; "cai claramente num creep" = a menos de metade do raio
    desenhado do mais próximo; a lista diz "N creeps aqui" (podem estar em células diferentes);
  - **E4:** setas com um selo geométrico (coletar: seta para baixo numa bandeja, verde-matéria; entregar: seta
    entrando num quadrado; andar: chevron; estrada: três segmentos, cor de estrada ou vermelho sem estoque);
    selecionar e escolher no mapa usam a mãozinha e a mira do sistema; no replay não há cursor de ordem.

- **Fechamento do M1.5** ✅ (spec §8, "Critério para fechar o M1.5"; no checkpoint da F6, dono, 2026-11-14).
  Critérios da spec §7:

  | Critério | Resultado | Onde |
  |---|---|---|
  | Início de partida (seeds 1–20) | ✅ 1ª matéria em 2–7 min (alvo 30) | F2 |
  | Equivalência entre os times | ✅ diferença 0 na 1ª entrega; divergência depois de ~15 h aceita (rebalanceamento) | F2 |
  | Economia (3 dias, seed 42) | ✅ aceita pelo dono (matéria −13% a −20%) | F2 |
  | Determinismo | ✅ `geo verify` | F2–F4 |
  | Correção do diff | ✅ 0 divergências (6 h × 3 seeds no CI; 518 400 verificações no `geo net`) | F3 |
  | Banda e CPU | ✅ 195 B/s, 121 µs por envio | F3 |
  | Custo do tick | ❌ 2,2× (alvo 2×), **aceito** pelo dono | F2 |
  | Sem divergência (soak) | ✅ com o `SIM_VERSION` 5 (checkpoint da F6) e antes | F5, F6 |
  | Linha de visão; nada vaza | ✅ testes do `sim` | F1 |
  | Hipótese (sessão do dono) | ✅ o fog e a exploração cumprem o papel (sessões 2 e 3); pessoas novas no M2 | F5, F6 |

  **Soak com o `SIM_VERSION` 4** (depois do alvo por ganho, `runs/soak-20261115-000828-s42/summary.md`): OK; 0
  hashes divergentes em 14 372, as 4 visões finais iguais às do servidor, replay com o hash do servidor; banda
  10,9–11,2 KB/s (pico 40,9); laço com mediana 100% e o tick mais lento a 10% (um instante, como antes do fog);
  memória máxima 220 MB; SQLite 115,8 MB.

  **Soak com o `SIM_VERSION` 3** (`npm run soak`, `runs/soak-20261114-230613-s42/summary.md`; antes do fog,
  `runs/soak-20261114-172301-s42/`): resultado OK, 12,3 min reais; 6 interrupções (5 `kill -9` e 1 SIGTERM), cada
  uma de volta em 1,5–2,3 s; replay reconstruído no Node com o hash do servidor; 4 clientes, **0 hashes
  divergentes** em 14 364 conferidos, as 4 visões finais iguais às do servidor, 0 resyncs. Banda a ×360: 10,6–10,8
  KB/s em média por cliente, pico 32,7 KB/s (antes 12,9 e 47,9). Laço: mediana 100% do ritmo, o tick mais lento a
  95% (antes 10%). Memória: máximo 212 MB (antes 202). **SQLite no fim: 115 MB (antes 55 MB):** a memória dos
  times (bitmaps de 4 096 células por time: `explored`, `visible`, `terrain`, `road`) é 71% de cada snapshot (66 de
  93 KB na 1ª hora do seed 42), e há um snapshot a cada 300 ticks.

  **Alvo de explorar desempatado pelo ganho** (dono, 2026-11-14, depois do vídeo do batedor varrendo a borda do
  escuro uma linha por vez; [plan §10](../specs/m1.5-fog/plan.md), GDD 07, spec D4; `SIM_VERSION` 4). Medido de novo
  (relatórios em `runs/m1.5-fog-f5-explore/`, comparados com `runs/m1.5-fog-f2-checkpoint/`):
  - **batedor sozinho** (seeds 42, 7, 649, células conhecidas pelo time em 60 min): círculo 840–1 217 → 2 193–2 659;
    quadrado 316–351 → 773–918; os mesmos ~600 passos em 2 h;
  - **sweep de 6 h, seeds 1–20:** 1ª matéria do time mais lento em 2–6 min (✅, antes 2–7); 1ª entrega de cristal do
    time mais lento em 44 min na média (20–69; antes 90, 17–219); cristal entregue 733 (antes 563); upgrade em 1,8 h
    (antes 2,5); mapa explorado 38% (antes 34%); diferença entre os times 0;
  - **3 dias, seed 42** (hash `8df206ba…`): matéria 146 535 / 156 495 (antes 151 065 / 140 175; sem fog 174 540),
    cristal 1 200 por time nos dois, teto de 30 creeps em 42,6 / 42,0 h (antes 43,2 / 43,3), Núcleo inimigo visto
    em 8,9 h (antes 13,6); neste seed a 1ª entrega de cristal saiu mais tarde (39 min, antes 19) e o upgrade também
    (1,4 h, antes 0,9);
  - **custo do tick:** `geo sim` de 3 dias em 9,3–10,0 s (antes 8,4–9,6; sem fog 4,0–4,3): ~2,3×, já aceito;
  - `geo verify` OK; 2 161 testes. A propriedade do diff baixou o piso de creeps inimigos à vista em 6 h de 100 para
    20 (no seed 42 os times se cruzam menos: 68).

  As perguntas desta seção foram respondidas no checkpoint da F6, acima.

- **Interpretações da F4 do fog** (o plan não fixava; mantidas pelo dono no checkpoint da F6):
  - **nomes de creep pelo id**, não pela posição na lista da visão: com o fog a lista só tem os inimigos à vista, e
    um inimigo de id menor entrando na visão renomeava os próprios creeps. Continua a ordem de nascimento, igual em
    todos os clientes e no replay; como os ids também contam depósitos, os últimos ~30 creeps de um mundo de 3
    dias ganham sufixo ("Taro II");
  - véu com opacidade 0,55 sobre o lembrado; negro `#050608` no nunca visto; a borda do mapa é desenhada por cima
    da névoa. O contraste entre véu e visível é baixo na selva e bom nas estradas;
  - sobre célula nunca vista, o modo estrada mostra "nunca vista · custo desconhecido" e **continua desenhando o
    traçado** (pelo mapa conhecido, com o escuro como selva);
  - o inspetor de depósito fora da visão diz "último valor visto"; o de creep inimigo que saiu da visão diz "saiu
    da visão do seu time";
  - 2 160 testes.

- **Medições da F3 do fog** (`npm run geo -- net --seed 42 --days 3`, relatório em
  `runs/m1.5-fog-f3-checkpoint-net/net.md`; antes do fog, [viability §2](../specs/m1.5-rede/viability.md)):
  - **banda ✅** 195 B/s por cliente a ×1 (antes 227; alvo 2 048): o creep inimigo fora da visão não vai mais, e
    `known`/`visible` custam menos que ele. Pico de 2 509 B por delta; na última janela, 240 B/delta com 60 creeps;
  - **CPU ✅** 121 µs por envio na mediana (antes 83; alvo 250): visão 37 µs (antes 11; monta o `known` de 4 096
    células por time a cada envio), diff 60 µs, hash amortizado 21 µs (638 µs por hash, antes 390: o `known` entra
    no `viewJson`). Candidato se apertar: guardar o `known` no cache derivado e só copiá-lo quando a memória muda;
  - **correção ✅** 0 divergências em 518 400 verificações; hash do mundo `a6bde918…`, o mesmo da F2 (a F3 não
    mexeu no `sim`); `geo sim` de 3 dias em 8,4–9,1 s (igual à F2); `geo verify` OK (`d4fd490f…`);
  - `welcome` no fim do mundo: 28 KB de visão (antes 23 KB de visão + o terreno inteiro à parte);
  - 2 150 testes.
- **Interpretações da F3 do fog** (o plan não fixa):
  - o cliente desenha o terreno a partir de `known` já na F3 (sem a névoa): sem o terreno no `welcome`, era isso ou
    um mapa vazio até a F4;
  - a seed de mundo encerrado volta à lista (D9 só esconde a de mundo vivo); o replay de mundo encerrado continua
    igual;
  - no lobby, o botão "Assistir replay" some de mundo rodando (antes ficava e o replay dava 409).

- **Decisões do checkpoint da F2 do fog** (dono, 2026-11-14; registro no [plan §10](../specs/m1.5-fog/plan.md)):
  economia aceita; regra de cristal do estrategista mantida; custo do tick 2,2× aceito (o dono deixou com o agente:
  a F3 e a F5 medem de novo); **divergência entre os times aceita, a rever numa rodada de rebalanceamento** (pergunta
  aberta no [GDD 03](../gdd/03-economia-e-logistica.md)).
- **Interpretações da F2 do fog** (o plan não fixa):
  - **o estrategista mantém a fatia de cristal enquanto o time conhece cristal com sobra _ou_ ainda alcança célula
    nunca vista** (busca em largura no mapa conhecido, a partir do Núcleo). Ao pé da letra ("enquanto há cristal",
    que agora é o que o time conhece), ninguém recebia o papel de cristal no início, ninguém explorava (a matéria
    regenera, então o coletor de matéria nunca explora) e os bots nunca produziam (6 h do seed 42: 6 creeps, 0
    cristal, 4% do mapa explorado). Não é lógica de batedor (N8): os coletores de cristal exploram pelo preset;
  - o estrategista monta o mapa a partir de `seen.known` (nunca visto = selva, como o mapa conhecido do `sim`) e
    recebe o **tamanho** do mapa (o que o `welcome` sem terreno dá), não `params.map`: os mapas de teste têm outro
    tamanho;
  - `explore` como ordem do dominador: termina quando a célula é vista ou o caminho some, como o `moveTo`;
  - recusas: creep de outro time recebe `unknownCreep` também na ordem do dominador (antes `notDominating`); a
    coleta só aceita depósito da memória do time (`invalidOrder`);
  - métricas: `firstDeliveryTick` por recurso e `enemyCoreSeenTick` no estado (stats); células exploradas e creeps
    com ordem `explore` só nas amostras. No `geo sweep`, a 1ª entrega é a do **time mais lento** (o critério é "os
    dois times"), mais as diferenças entre os times.
- **Medições da F2 do fog** (relatórios em `runs/m1.5-fog-f2-checkpoint/`, parâmetros `default.json`):
  - **início de partida ✅:** `geo sweep` seeds 1–20 × 6 h: 1ª matéria do time mais lento em 2–7 min (alvo ≤ 30),
    diferença 0 entre os times em todas as seeds. Contra o mesmo sweep sem fog: matéria 5 782 × 6 003 (−4%),
    cristal 563 × 914 (−38%), upgrade em 2,5 h × 1,2 h; 1ª entrega de cristal do time mais lento em 17–219 min;
    34% do mapa explorado em 6 h. Nenhum time produz em 6 h, com ou sem fog (creep custa 3 000 de matéria);
  - **economia (3 dias, seed 42):** hash sem fog `10662729…` conferido; com fog `a6bde918…`. Matéria 151 065 /
    140 175 (sem fog 174 540 por time), cristal 1 200 por time nos dois, teto de 30 creeps em 43,2 h / 43,3 h (39,8
    h), mapa 100% explorado, Núcleo inimigo visto em 13,6 h, viagens de 34,8 / 38,9 células (24,1);
  - **os times divergem no tick 52 867 (~14,7 h):** creeps dos dois times coletam no mesmo depósito quase vazio e o
    de id menor (time 0) leva a unidade. Regra do M1; sem fog não acontecia em 3 dias;
  - **custo do tick ❌:** `geo sim` de 3 dias em 9,4–9,6 s contra 4,0–4,3 s sem fog (2,2×; orçamento absoluto de 10
    min longe). Perfil: `step` 2,1 → 5,5 s (visão ~1,2 s; A* ~1,5 s a mais, pelo mesmo número de caminhos, ~29 mil,
    porém mais longos), estrategista 1,4 → 3,5 s (mapa montado da visão e a busca de célula nunca vista, ~100 µs por
    chamada);
  - `geo verify --seed 42` OK (`d4fd490f…`); 2148 testes.
- **Interpretações da F1 do fog** (o plan não fixa):
  - **o Bresenham escolhido já é simétrico por rotação de 180°** (só depende do módulo e do sinal do deslocamento):
    o teste de espelho passa nas 4 096 células com ou sem o referencial do time. O referencial ficou, como o plan
    pede, para garantir a equivalência se o traçado mudar;
  - **a visão é incremental:** contagem de observadores por célula, refeita só para quem mudou de célula. Redesenhar
    todos os losangos a cada tick custava 15,5 µs por tick (3 dias de 4,4 s para 10,5 s, acima do critério de 2×);
    a contagem custa 1,5 µs. As listas de células à vista e as contagens ficam num cache derivado do estado (fora
    do `WorldState`, recriado depois de um restore com o mesmo resultado; um teste confere a cada 5 min de 2 h de
    mundo);
  - estrada concluída entra na memória na hora (em `completeRoadJob`) para o time que pagou **e para os times que
    têm a célula à vista** naquele momento; fora isso, o terreno e as estradas só são lidos quando a célula entra
    na visão;
  - a pedra só é "descoberta" (`blockRevision`) quando a célula é vista pela primeira vez; rio também conta;
  - no cliente (só para compilar; a tela é da F4): creep inimigo com inspetor reduzido (DNA, carga, posição) e carga
    contra a capacidade **base** do DNA (o upgrade do outro time é escondido); painel do Núcleo inimigo só com o
    nome; `+N`/`−N` só do próprio Núcleo; o replay já usa a `fullView`;
  - o delta de `known` a partir de um registro vazio compara com -1; o cliente que monta a visão do zero começa de
    `emptyView(time, células)` (`protocol`), com `known` todo -1.
- **Medição da F1:** `geo verify --seed 42` OK (hash `c8dcab74…`); `geo sim` de 3 dias do seed 42 em 4,8 s (sem
  produção, ver o interim acima: não é comparável). 2120 testes.

- **Interpretações da F5 do M1.5** (o plan não fixa):
  - os clientes do soak entram como jogadores humanos (`soak-<time>-<n>`, pelo `POST /join`): os `join` vão para o
    log e o replay os reproduz. Ficam parados (sem comandos);
  - além das quedas do servidor, cada cliente derruba a própria conexão a cada 60 s (escalonado, `--drop-every`),
    para o soak exercitar a retomada pelo buffer; "quedas" contam só conexões que chegaram a abrir;
  - a visão final de cada cliente é comparada com `view(estado reconstruído do replay, time)`;
  - o soak continua em inglês no `summary.md`, como no M1; o relatório de viabilidade é em PT-BR;
  - `dev:multi --net` abre as abas com `?net=1`, e o cliente mantém o `net=1` ao navegar entre o lobby e o mundo.
- **Medições da F5:** `npm run soak` completo (×360, seed 42): OK em 12,4 min; 4 clientes, 3 593 hashes ✓ e 0 ✗ cada,
  12,9 KB/s por cliente a ×360 (pico 48 KB/s); memória por processo até ~200 MB; SQLite 55,2 MB; velocidade do loop
  mediana 100%, **amostra mais lenta 10%** (no M1, 93%; uma amostra de 2 s, não investigada). 2093 testes.
- **Interpretações da F4 do M1.5** (o plan não fixa):
  - uma conexão que pediu retomada fica "conectado" ao abrir o socket; a retomada só conta no painel quando chega
    um delta sem `welcome` antes (uma retomada recusada depois de um restart vira "reconexão");
  - depois de pedir `resync`, os deltas são descartados até o `welcome`, e uma reconexão nesse meio pede
    `welcome`, não retomada. O incidente vai para o `console.warn` do navegador;
  - o hash é conferido de forma assíncrona; uma divergência descoberta depois de um `welcome` novo é ignorada;
  - protocolo diferente: aviso "O jogo foi atualizado. Recarregando a página…" e recarga depois de 1,5 s;
  - o painel mostra os bytes como o tamanho da string recebida (JSON é quase todo ASCII) e na velocidade real do
    mundo: a ×36, ~2,9 KB/s (cada envio cobre ~7 ticks);
  - entrada nova `@geometrix/protocol/stream` (versão do protocolo e deltas, sem o zod) para o bundle principal do
    cliente: 111 KB (40 KB gzip); o chunk do replay, 101,6 KB.
- **Teste no navegador da F4** (Chromium headless, ×36, seed 42, `?net=1`): em 8 s, 41 deltas e 4 hashes ✓; depois
  de `kill -9` e restart do servidor, a retomada é recusada (stream novo), chega um `welcome` de reconexão e os
  hashes seguem ✓ (9 ✓, 0 ✗). A tela é a do M1, com o painel no canto inferior direito. 2088 testes.
- **Interpretações da F3 do M1.5** (o plan não fixa):
  - **o `welcome` leva um id do stream** (`stream`, novo a cada processo do servidor) e a retomada é
    `/ws?token=…&stream=…&seq=…`, não só `&seq=` (R5): sem o id, depois de um restart um `seq` antigo do cliente
    poderia cair no buffer novo e o servidor mandaria deltas sobre a base errada. **Aprovado pelo dono
    (2026-11-14)**; plan R5 e regra 5 do ADR-0006 atualizados;
  - a troca de formato (protocolo, servidor e o store do cliente) foi num commit só, que também fez a 1ª task da
    F4;
  - os streams de um mundo nascem na primeira conexão a ele (a base é a visão daquele momento, `seq` 0); daí em
    diante todos os times avançam a cada envio, com ou sem socket (R7);
  - a última visão enviada é remontada do `Sent` quando um `welcome` sai (custo zero por envio), não guardada
    serializada a cada envio. O `status` do `welcome` é o da última visão enviada;
  - o delta leva o hash quando os ticks que ele cobre passam por um múltiplo de `viewHashEveryTicks`: a cada 60
    ticks a ×1, e uma vez a cada 60 ticks quando um envio cobre vários (×360);
  - o buffer é aparado pelo relógio real a cada envio; uma retomada com o `seq` atual não recebe nada; um `seq`
    à frente do atual, de outro stream ou malformado recebe `welcome`;
  - a linha do `resync` leva o tick do mundo no momento do pedido; o log do servidor é injetável (testes).
- **Interpretações da F2 do M1.5** (o plan não fixa):
  - o `Delta` leva o `tick`; a entidade nova vai inteira no `upsert`, a existente como `{id, ...campos}`; campos
    aninhados (`cargo`, `order`, `stock`, `upgrades`, `production`, `core`) vão inteiros quando mudam. Uma estrada
    que some faz o `diffView` lançar erro (no M1 estrada não some);
  - o teste de propriedade compara as visões como JSON simples em todo tick (mais estrito que o canônico e ~8×
    mais rápido) e como `viewJson` a cada minuto de mundo. Roda com o `test/params.json`; levou o `npm run check`
    de ~28 s para ~39 s;
  - `geo net`: um envio por tick (o caso ×1); os bytes são da mensagem inteira (`{type, seq, delta, hash?}`); a
    CPU não inclui o hash, que entra amortizado; sai com código 1 se um alvo falhar; grava também `net.json`;
    `--hash-every` (padrão 60);
  - `botsFor`/`botCommands` saíram do harness da CLI para o `sim` (`strategist.ts`), usados pelos testes do
    `sim`, do `protocol`, do cliente e pela CLI.
- **Medições da F2** (`geo net --seed 42 --days 3`, `runs/m1.5-f2-checkpoint-s42/`): 227 B por delta em média
  (mediana 111, p95 601, pico 4,6 KB); 0,8% dos deltas passam de 2 KB, todos no tick da regeneração dos depósitos
  (~50 creeps voltam a coletar juntos: carga e atividade). CPU por envio: mediana 70,5 µs (85 µs com 60 creeps),
  p95 127 µs, + 12,9 µs do hash amortizado. 72 s reais com a verificação do cliente. 2062 testes.
- **Interpretações da F1 do M1.5** (o plan não fixa):
  - a trava de 6 h (`packages/sim/test/bot-world.test.ts`) roda com o `test/params.json`, não com o
    `default.json`: assim ela não quebra a cada balanceamento. O `default.json` continua coberto pelo hash de 3
    dias do `geo verify`/`geo sim`;
  - a cópia rasa da visão vale para todas as entidades (times, depósitos, obras e jogadores também são objetos
    novos), não só para os creeps;
  - o estrategista recebe `(id, visão, mapa estático, parâmetros)`; ele ignora a camada de estradas do mapa que
    recebe e a remonta a partir de `view.roads` (o servidor e o harness passam o `state.map` direto).
- **Medição da F1:** `geo sim` de 3 dias do seed 42 em 4,4 s (antes 4,3 s), hash `10662729…`. 2042 testes.

- **Interpretações da F9** (o plan fixa o quê, não estes detalhes):
  - o `+N`/`−N` sobe do Núcleo com a **variação líquida** do estoque entre dois estados (5 por segundo): uma
    entrega e um pagamento no mesmo intervalo se somam (ex.: `−140`). O `−N` também aparece ao pagar produção e
    upgrade, não só estrada. Variações do mesmo time, recurso e sinal em até 700 ms viram um número só; o `+N`
    sobe acima do Núcleo (matéria à esquerda, cristal à direita), o `−N` ao lado. O estoque no painel pisca
    verde ao subir e vermelho ao descer;
  - nomes no mapa só em creeps fora de pilha, com 10 a 13 px na tela, numa camada acima de todos os creeps
    (nenhum vizinho cobre um nome);
  - carga cheia = matéria + cristal ≥ capacidade do creep; o brilho toca quando o anel cheio aparece: ao encher,
    mas também ao abrir a página ou quando o creep sai de uma pilha já cheio;
  - custo da estrada no modo estrada: segue o `sim` (caminho mais barato do Núcleo do time até a célula; cada
    célula sem estrada é um segmento; obra já paga não paga de novo; a estrada para na primeira célula que não
    aceita estrada, marcada com ✕). O texto mostra as células a construir e o custo total; fica **vermelho
    quando o estoque não cobre o total** (o `sim` constrói segmento a segmento enquanto houver estoque). "sem
    caminho", "sem estrada aqui" (bloqueada já na primeira célula) e "já tem estrada" quando não há o que pagar;
  - tempo da obra: acima da célula, numa camada sobre os creeps (o construtor fica em cima da obra), só com a
    célula ≥ 22 px na tela, em tempo de mundo (`2:00` com o `default.json`, 1 s real a ×120);
  - `npm run soak`: o tick de cada queda é sorteado por um LCG da seed, entre 5% e 95% do mundo; o SIGTERM limpo
    fica no meio da lista; a amostragem é a cada 2 s reais.
- **Medições da F9:** `npm run soak` completo (×360, seed 42, 5 `kill -9` + 1 SIGTERM): OK, mesmo hash no servidor
  e no Node, 12,4 min reais; velocidade do loop mediana 100% do multiplicador, mais lenta 93%; SQLite final
  55,1 MB; memória de cada processo estabiliza em ~200 MB (heap do V8 se acomodando, sem vazamento entre os
  restarts). O replay do banco do soak também dá ✓ no Chromium. Bundle principal 106 KB (+ a fonte, 10 KB woff2),
  chunk do replay 102,5 KB. 2033 testes.

- **Interpretações do F8** (o plan não fixa):
  - o `dev:multi` passa a sessão inteira no fragmento (`#token=…&player=…&team=…&name=…`, não só o token): o
    cliente precisa de id, time e nome antes de conectar. Usa o banco normal do servidor (`GEO_DB`), recusa subir
    se a porta já responde, e com mais de 6 jogadores o join falha (`teamFull`, 3 humanos por time) e o servidor
    para. `--no-build` e `--no-open` são extras;
  - o replay é visto como espectador (sem id de jogador): nada é "meu", o botão direito não ordena, os painéis ficam
    só para leitura. "Ver como Azul/Laranja" troca o painel do Núcleo fixo. Num replay de arquivo os jogadores
    aparecem como "jogador #N"; num do servidor, com os nomes do `GET /api/worlds`;
  - velocidade: cada frame simula no máximo 12 ms; se o navegador não acompanha a velocidade pedida, o replay
    descarta o atraso e a barra mostra os ticks/s reais. Um frame de mais de 250 ms (aba em segundo plano) conta
    como 250 ms;
  - linha do tempo: o salto acontece ao soltar o controle; para trás, restaura o checkpoint (a cada hora de mundo)
    e re-simula; para frente além do já simulado, simula em frames ("re-simulando…"). ▶ no fim recomeça do tick 0;
  - o hash é conferido toda vez que o replay chega ao último tick. Um arquivo de outra versão do `sim` ganha um
    aviso; os replays da versão 1 (os runs do F5 em `runs/`) são recusados porque o `join` mudou de formato;
  - o export do servidor sai de qualquer mundo hospedado (rodando ou encerrado), até o tick atual;
  - o replay carrega sob demanda (code splitting): bundle principal de 99,5 KB (35,8 KB gzip), chunk do replay
    de 102,5 KB (30,6 KB gzip). O principal cresceu de 77,8 KB porque os módulos do `sim` usados pelos dois ficam
    no chunk de entrada.
- **Medições do F8:** replay no "máximo" no Chromium headless: 3 dias de mundo em 5,7 s (35–73 mil ticks/s); no
  WebKit, 22 s (8–11 mil ticks/s). O `geo sim` de 3 dias leva 4,3 s com o `default.json` atual. 2007 testes.
- **Interpretações do F7** (a spec e o plan não fixam; checkpoint aprovado pelo dono em 2026-11-14, ficam
  registradas para o playtest do M2):
  - o lobby cria mundos (seed, multiplicador, bot por time; padrão ×36 com bot no Laranja) e entra com nome de
    convidado; o token fica no `localStorage` por mundo e por slot da URL;
  - interpolação um estado atrás: o creep desliza entre os dois últimos estados no intervalo entre as mensagens;
    um salto de mais de 4 células é instantâneo; a ×1 o creep anda uma célula em ~1 s e espera a próxima;
  - zoom afastado aumenta creeps e depósitos até 2× (mínimo de 22 px na tela);
  - creeps na mesma célula (pergunta aberta no GDD 02) continuam individuais: com zoom aproximado ficam lado a
    lado numa grade de posições dentro da célula; quando cada posição teria menos de 18 px na tela, a célula vira
    uma pilha com contador, que mostra o creep selecionado, ou o seu dominado, ou o de menor id. Clicar na pilha
    abre a lista dos creeps dela; o inspetor tem "Nesta célula ◀ ▶". Com a célula cheia, os creeps cobrem o
    depósito que está embaixo;
  - "esperando o depósito regenerar" = ordem `gather`, parado na célula do depósito, depósito com 0; o creep
    ganha uma ampulheta e o inspetor diz isso em amarelo;
  - o botão direito sempre ordena o creep que o jogador domina, esteja ele selecionado ou não; sem domínio, um
    aviso. O modo estrada vale para um clique e termina se o domínio acabar. Núcleo inimigo vira `moveTo`;
  - além do clique direito, o inspetor tem "Parar" e "Entregar" (ordens do vocabulário);
  - o painel do próprio Núcleo fica fixo à esquerda; o Núcleo, os creeps e as regras do outro time aparecem só
    para leitura (sem fog, D5);
  - o editor de regras trabalha num rascunho local e envia a lista inteira com "Aplicar"; avisa se as regras
    mudaram no servidor no meio; um preset aplica na hora e descarta o rascunho. Valores iniciais ao trocar a
    condição: raio 10, quantidade 100 (padrões do editor, não balanceamento); regra nova = "sempre → entregar";
  - os nomes dos jogadores vêm do `GET /api/worlds` (o estado só tem ids);
  - nomes de creep (dono, 2026-11-14): gerados no cliente pela ordem de nascimento, de uma lista de 179 palavras
    curtas inventadas (todas a pelo menos 2 edições umas das outras, sem gíria, sem inicial I); nascimentos
    seguidos ganham nomes distantes na lista. Estável só porque ninguém morre no M1; o nome no estado é
    proposta no GDD 02 para o M2;
  - os botões de produção usam o `productionRefusal` do `sim` (alargado para aceitar o estado da rede).
- **Replay no Safari/JSC (F8, 2026-11-14): o hash confere.** WebKit 27.2 do Playwright (WPE headless, engine
  JSC), com o build do cliente servido pelo `npm run server`: o replay.json de um `geo sim` de 6 h (seed 42) e o de
  3 dias (seed 7) terminam com ✓, assim como o export de um mundo do servidor de 3 dias com saltos para 80%, 30% e o
  fim. No Chromium os mesmos 3 dias levam 5,7 s (35–73 mil ticks/s no "máximo"); no WebKit, 22 s (8–11 mil
  ticks/s). Sem divergência, a verificação permanente com Bun não entra (plan §8). **Como repetir sem sudo:** o
  WebKit precisa de bibliotecas que o WSL não tem; `apt-get download` dos pacotes (`libgtk-4-1`,
  `libevent-2.1-7t64`, `libgstreamer-plugins-bad1.0-0`, `libavif16`, `libgav1-1`, `libyuv0`,
  `libcairo-script-interpreter2`, `libnice10`, `libabsl20220623t64`, `libgupnp-igd-1.6-0`, `libgssdp-1.6-0`,
  `libgupnp-1.6-0`), `dpkg-deb -x` num diretório do scratchpad, e `webkit.launch({ executablePath })` com um
  script que repete o `minibrowser-wpe/MiniBrowser` acrescentando esse diretório ao `LD_LIBRARY_PATH`, mais
  `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`. Com sudo, `npx playwright install-deps webkit` resolve de vez.
- **Interpretações do F6 a validar** (o plan não fixa):
  - a recuperação restaura o último snapshot e reaplica os comandos do log com `tick >=` o do snapshot até o
    último tick gravado (`worlds.tick`, coluna além do esquema do plan, como `players.bot`);
  - um crash perde os comandos aceitos (com ack) do tick em andamento (no máximo 1 tick); um desligamento limpo
    (SIGTERM) grava o snapshot, mas perde os comandos ainda na fila. Os `join` na fila não se perdem: a
    recuperação reenvia o `join` de quem está na tabela `players` e não está no estado;
  - depois de um restart, os relógios de desconexão e de inatividade começam quando o servidor sobe;
  - o `release` automático é um comando do próprio jogador, gravado no log;
  - `metrics`: uma linha por time e uma do mundo (`team_id` nulo, com estradas e depósitos), a cada 60 ticks;
  - mundo encerrado continua hospedado, só para leitura (status `ended` e snapshot final). O relatório final a
    partir do banco não entra no F6;
  - sem `seed`, o servidor sorteia um; `multiplier` vai de 1 a 10 000 (padrão 1). Nome de jogador não é único;
  - `join` na fila conta para o limite de 3 humanos por time;
  - mensagem inválida sem `ref` legível volta com `ref: -1`.
- **Interpretações do F5 a validar** (a spec e o plan não fixam):
  - tempo dos creeps em 5 atividades: as 4 da spec §7 (coletando, carregando, andando vazio, parado) mais
    **construindo**. "Andando" conta desde o tick em que o creep ganha pontos de movimento; esperar a obra de outro
    construtor conta como parado;
  - **viagem** = do primeiro tick em que o creep sai andando até entregar carga no Núcleo. Chegar vazio ao Núcleo
    descarta a viagem;
  - **disputa** de um depósito = tempo em que creeps dos dois times tinham ordem de coletar nele (tráfego, não só
    coleta simultânea);
  - **Núcleo ocioso** = tick que termina sem nada em produção (um creep de 10 min conta 599 s ocupado);
  - "zerou pela 1ª vez" é registrado para todo depósito, inclusive de matéria;
  - os bots entram no tick 0 e agem no tick 1 e depois a cada 60 ticks; os comandos deles contam nas métricas de
    "humanos" do time (no harness não há humanos);
  - o `geo sweep` guarda só o `run.json` de cada run (o `samples.jsonl` de 3 dias tem ~11 MB); `--keep-runs` guarda
    tudo.
- **Testes de mecânica** usam `packages/sim/test/params.json` (os valores do F5), não o `default.json`; o
  balanceamento não quebra mais os testes. O `default.json` continua no `geo verify` e no orçamento do CI.
- **Correção do A* (2026-11-14, branch `m1/f6-server`):** o time 1 desempata na ordem de células rotacionada, e
  a rota dele é o espelho da do time 0. Antes, os times construíam estradas diferentes no mapa simétrico (até ~19%
  de diferença na entrega). Com o `default.json` atual (candidato B, `teams.maxHumans`), o hash de 3 dias do seed 42 é `10662729…` (`SIM_VERSION` 2).
- **Sinais do relatório de 3 dias (checkpoint do F5, anterior à correção do A*):** com os parâmetros atuais e o `balanced`, a economia trava
  em ~4 h: teto de população em 4,2 h, todo o cristal esgotado em 2,5 h, estradas param em 113 células; depois os
  30 creeps disputam 6 depósitos de matéria que regeneram 1/min (andam vazios 58–76% do tempo), o Núcleo fica 94%
  ocioso e 91% da matéria entregue sobra no estoque. Análise em [balance.md](../specs/m1-ciclo-da-riqueza/balance.md).
  A diferença entre os times vinha do A* (corrigida); a hipótese dos desempates por menor id não se confirmou.
- **Interpretações do F4 a validar** (a spec não fixa):
  - jogadores entram no estado por um comando de sistema `join {team}`, que o servidor emite e grava no log como
    o `release` de desconexão;
  - o `step` revalida cada comando no estágio 1, na ordem recebida, contra o estado deixado pelos anteriores (ex.:
    dois `produce` no mesmo tick: o 2º é recusado com `busy`);
  - "possível" para as ações: `gather` precisa de carga não cheia e de um depósito não vazio do recurso;
    `moveTo` precisa de célula transitável; `buildRoad` precisa de alvo que aceite estrada, de um próximo segmento
    e de estoque (ou de uma obra já paga nele); `deliver` e `stop` são sempre possíveis;
  - comandos manuais (`order`) só checam limites do mapa e a existência do depósito; uma ordem para célula
    intransponível vira `stop` na execução;
  - um `applyPreset` recusado (ex.: `roadBuilder` sem alvo) não mexe nas regras.
- **Custo do piloto automático:** com o "construtor de estrada" travado (alvo na outra margem ou sem caminho), a
  regra refaz o A* a cada tick. O F5 confirmou que cabe no orçamento (3 dias em ~56 s, 10× abaixo do alvo); o cache
  do próximo segmento por `roadRevision` só se a medição piorar.

- **Interpretações do F3 a validar no playtest** (detalhes de implementação que a spec não fixa):
  - o tick em que o creep chega a um depósito ou a um segmento é gasto andando; a coleta e a obra começam no
    tick seguinte. A entrega é no próprio tick da chegada ("instantânea");
  - `gather` com o creep já cheio, depósito inexistente ou de cristal esgotado vira `stop` na hora. Num depósito
    de matéria vazio, o creep anda até lá e espera a regeneração (decisão do dono, 2026-11-14); esperar conta
    como **parado** nas métricas; `deliver` sem carga anda
    até o Núcleo e para;
  - a regeneração usa o relógio do mundo (a cada `everySeconds` desde o tick 0), não um contador por depósito;
  - uma obra de estrada pertence ao time que pagou, mas qualquer creep com `buildRoad` naquela célula a continua
    (inclusive do outro time) sem pagar de novo; obras abandonadas ficam no estado para sempre.

- **Interpretações do F2 a validar no playtest** (o plan não detalha): o modificador vale para a célula em que o
  creep **entra**; "carregado" = qualquer carga > 0; creeps não colidem; `moveTo` inalcançável vira `stop`; ao
  chegar ou parar, os pontos acumulados zeram.

- **Chutes de geração de mapa a calibrar no F5:** `map.crossingWidth`, `map.core`, `map.rocks`,
  `deposits.materia.{perSide, min/maxCoreDistance}`, `deposits.cristal.{minCoreDistance, contested*}`. Aprovados
  pelo dono como provisórios.
