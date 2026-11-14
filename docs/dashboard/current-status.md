# Status atual

**Atualizado:** 2026-11-14 · **Marco:** M1.5 — A névoa, fatia de rede · **Fase:** F4 ✅ concluída · **Próximo:** F5 (soak com clientes e viabilidade)

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
| M1 — F3 Economia | ✅ Concluída, merge em `main`. Ordens `gather`/`deliver`/`buildRoad`, regeneração, produção com "repetir", upgrade de capacidade. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F3](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{economy,production,roads,orders}.ts` |
| M1 — F4 Piloto automático e domínio | ✅ Concluída, merge em `main`. Vocabulário de comandos + `validate`, jogadores, domínio D-1..D-4, interpretador de regras, presets, `setRules`/`applyPreset`. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F4](../specs/m1-ciclo-da-riqueza/tasks.md) · `packages/sim/src/{commands,domination,autopilot,presets,rules}.ts` |
| M1 — F5 Harness | ✅ Concluída, merge em `main`. Checkpoint revisado pelo dono (2026-11-13): a economia precisa de balanceamento. Stats + `sampleMetrics`, estrategista `balanced`, `geo sim`/`report`/`sweep`, `geo verify` com bots e replay do log, orçamento de 6 h no CI. Detalhes decididos pelo dono no [plan §9](../specs/m1-ciclo-da-riqueza/plan.md) | [tasks.md §F5](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/cli/src/` · `packages/sim/src/stats.ts` |
| M1 — Balanceamento 1 | ✅ Decidido pelo dono (2026-11-14): candidato B no `params/default.json` provisório; DNAs economicamente equivalentes de propósito; playtest humano e deploy saem do M1. Assimetria entre os times corrigida (desempate do A*). Na branch `m1/f6-server` | [balance.md](../specs/m1-ciclo-da-riqueza/balance.md) |
| M1 — F6 Servidor | ✅ Concluída, merge em `main`. SQLite (log de comandos, snapshots, métricas), loop de tick com multiplicador, HTTP (criar, listar, entrar), WebSocket com ack/reject e broadcast ≤5/s, `release` automático, bots e limite de humanos, recuperação após restart. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F6](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/server/src/` · `packages/protocol/src/` |
| M1 — F7 Cliente | ✅ Concluída, merge em `main`. Checkpoint aprovado pelo dono (2026-11-14). Lobby, mapa SVG com pan/zoom, creeps interpolados com nomes gerados, pilhas de creeps com lista para escolher, inspetor, dominar/liberar, painel do Núcleo, editor de regras e presets, controle direto pelo botão direito. Detalhes decididos pelo dono na [spec §5](../specs/m1-ciclo-da-riqueza/spec.md) | [tasks.md §F7](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/client/src/` |
| M1 — F8 Replay e multi-cliente | ✅ Concluída, merge em `main`. Replay no navegador (arquivo do `geo sim` ou `GET /api/worlds/:id/replay`) com velocidades, linha do tempo e hash ✓/✗; hash confere no WebKit/JSC; `npm run dev:multi`. Detalhes decididos pelo dono no [plan §8](../specs/m1-ciclo-da-riqueza/plan.md) | [tasks.md §F8](../specs/m1-ciclo-da-riqueza/tasks.md) · `apps/client/src/replay/` · `apps/server/src/dev-multi*.ts` |
| M1 — F9 Legibilidade e playtest | ✅ Concluída, merge em `main`. Fecha o M1. Feito: `npm run soak` (teste de resistência comprimido, no lugar do mundo de 24 h), estrada × pedra, nomes no mapa (Chakra Petch), carga cheia, `+N`/`−N` no Núcleo, custo da estrada sob o cursor e tempo da obra, [PLAYTEST.md](../PLAYTEST.md). **Checkpoint** (dono, 2026-11-14): playtest parcial e replay validados, sem achados | [tasks.md §F9](../specs/m1-ciclo-da-riqueza/tasks.md) · [spec §8](../specs/m1-ciclo-da-riqueza/spec.md) |
| Deploy e playtest de diversão | Saíram do M1 (dono, 2026-11-14): abrem o M2 | [ROADMAP](../ROADMAP.md) |
| M1.5 — A névoa | 🟡 Em andamento (dono, 2026-11-14). Duas fatias: rede (deltas da visão de cada time, [ADR-0006](../adr/0006-sync-do-mundo.md), aceito) e depois fog of war | [ROADMAP](../ROADMAP.md) |
| M1.5 rede — spec | ✅ Aprovada (2026-11-14). Decisões D1–D8; critérios de viabilidade na §7 | [spec.md](../specs/m1.5-rede/spec.md) |
| M1.5 rede — plan | ✅ Aprovado (2026-11-14), com R1–R7 decididas | [plan.md](../specs/m1.5-rede/plan.md) |
| M1.5 rede — F0 Spike | ✅ Concluída, merge em `main`. Diff à mão em JSON por uma visão com cópia rasa: ~41 µs por mundo por envio (2 times), ~257 bytes por delta; o schema do Colyseus funciona, mas não foi adotado (R1) | [plan §1](../specs/m1.5-rede/plan.md) · [tasks.md](../specs/m1.5-rede/tasks.md) |
| M1.5 rede — F1 Visão no `sim` | ✅ Concluída, merge em `main`. `view(state, team)` e `TeamView`; o estrategista decide pela visão do time + mapa estático + parâmetros; hash de 6 h travado em teste e o de 3 dias (`10662729…`) inalterado | [tasks.md](../specs/m1.5-rede/tasks.md) · `packages/sim/src/view.ts` |
| M1.5 rede — F2 Delta no `protocol` | ✅ Concluída, merge em `main`. `diffView`/`applyDelta`/`viewJson`, propriedade de 6 h × 3 seeds no CI, `geo net`. **Checkpoint** (3 dias, seed 42): 227 B/s por cliente a ×1 (alvo ≤ 2 KB/s), 83 µs por envio (alvo ≤ 250 µs), 0 divergências em 518 400 verificações, hash `10662729…` igual | [tasks.md](../specs/m1.5-rede/tasks.md) · `packages/protocol/src/delta.ts` · `apps/cli/src/net.ts` |
| M1.5 rede — F3 Servidor | ✅ Concluída, merge em `main`. Protocolo 2: `welcome` com a última visão enviada ao time, `delta` numerado por time (inclusive sem socket), hash a cada 60 ticks, retomada pelo buffer de 30 s, `resync` com linha no log. O store do cliente já aplica os deltas (1ª task da F4) | [tasks.md](../specs/m1.5-rede/tasks.md) · `apps/server/src/{stream,ws}.ts` |
| M1.5 rede — F4 Cliente | ✅ Concluída, merge em `main`. Retomada com `&stream=…&seq=…`, `resync` por `seqGap` e por hash divergente (Web Crypto), recarga com outra versão do protocolo, painel `?net=1`. Conferido no Chromium com `kill -9` + restart do servidor | [tasks.md](../specs/m1.5-rede/tasks.md) · `apps/client/src/{connection,store,net-panel}.ts*` |
| M2–M4 | ⬜ Não iniciados | [ROADMAP](../ROADMAP.md) |

## Próximos passos imediatos

**M1 concluído (2026-11-14).** **M1.5 aberto** ([ROADMAP](../ROADMAP.md)): primeiro a fatia de rede
([spec](../specs/m1.5-rede/spec.md) · [plan](../specs/m1.5-rede/plan.md) · [tasks](../specs/m1.5-rede/tasks.md)),
depois a de fog of war. O repo está no GitHub e o CI passa lá.

1. **F5 — Soak com clientes e viabilidade**, pela skill `implement-phase`, na branch `m1.5/f5-soak` (criar a partir
   de `main`). O que a F5 precisa saber:
   - **O soak** está em `apps/server/src/soak.ts` (lógica) e `soak-main.ts` (processo); hoje ele sobe o servidor
     filho, derruba com `kill -9`, reinicia e compara o replay exportado com o hash do servidor.
   - **Clientes sem interface:** o protocolo está em `@geometrix/protocol` (tipos, `parseClientMessage`) e
     `@geometrix/protocol/stream` (`applyDelta`, `viewJson`, `PROTOCOL_VERSION`). A lógica de conexão do
     navegador (`apps/client/src/connection.ts`: retomada, `seqGap`, `resync`, contadores do `NetStats`) não
     depende do DOM além do `browserDeps`; dá para reaproveitar o raciocínio (ou a classe) com o `ws` do Node.
   - **A visão final** de cada cliente deve bater com a do servidor: o hash periódico vem nos deltas (a cada 60
     ticks); no fim, comparar `viewJson` do cliente com o da última visão enviada (o `welcome` de uma conexão
     nova, por exemplo).
   - **Checkpoint do dono:** `npm run dev:multi` com `?net=1` (o `dev:multi` ainda não acrescenta `net=1` às URLs).
2. **Rodada de design do fog**, em paralelo, pela skill `gdd-decision`: as perguntas do [GDD 01](../gdd/01-mundo.md)
   (o que dá visão e até onde, o que se vê do outro time, se o piloto automático respeita o fog, se o que já foi
   visto continua visível). Precisa estar decidida antes da spec da fatia de fog.
3. **Depois do M1.5, o M2 (A emboscada):** deploy e playtest de diversão primeiro (lista em "Fora do M1" no
   [tasks.md do M1](../specs/m1-ciclo-da-riqueza/tasks.md)), com uma rodada agrupada sobre as perguntas abertas de
   batalha antes da spec.
4. **Olhos novos na legibilidade:** o roteiro e o questionário do [PLAYTEST.md](../PLAYTEST.md) servem de base
   para os playtests do M1.5 e do M2, com pessoas que nunca viram o jogo.

**Push:** o Git do WSL não tem credencial do GitHub; o dono faz o push pelo PowerShell (`git push origin main`).

## Achados do playtest

Um item por problema: o que a pessoa não entendeu ou não conseguiu, a tarefa ou pergunta do
[PLAYTEST.md](../PLAYTEST.md) que mostrou, e quantas pessoas tropeçaram nele.

- **Sessão 1 (dono, 2026-11-14):** `npm run dev:multi -- --clients 3 --mult 36` (padrão de 3 dias de mundo), sem
  ir até o fim do mundo (o fim já é coberto pelo `npm run soak`). Replay testado pelo dono: ok, o pendente do F8
  está resolvido. **Nenhum problema reportado.** Ainda sem uma pessoa que nunca viu o jogo (ver próximos passos,
  item 3).

## Pendências e pontos a esclarecer

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
    poderia cair no buffer novo e o servidor mandaria deltas sobre a base errada. **Precisa do OK do dono**;
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
- **Servidor no `/mnt/c`:** subir o `npm run server` às vezes leva mais de 5 s (WSL). Scripts que sobem o
  servidor devem esperar a porta responder, não um `sleep` fixo.
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
- **`SIM_VERSION` vale desde o F6 (hoje 2):** mundos persistidos guardam a versão. Mudou o comportamento do `sim`?
  Suba a versão; um mundo de outra versão não é recuperado (o servidor loga e o pula).
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

- **`npm audit`:** aviso moderado (ReDoS no `minimatch`, dentro do typescript-eslint, só em dev). Sem correção
  que não quebre; reavaliar quando o typescript-eslint atualizar.
- **TypeScript fixado em `~6.0`:** o typescript-eslint ainda não suporta o TS 7.

## Workflow

- Branch por fase (`m<marco>/f<fase>-<slug>`), Conventional Commits por unidade lógica, merge `--no-ff` em `main`:
  skill [`commit`](../../.claude/skills/commit/SKILL.md).
- Implementar uma fase: skill `implement-phase`. Convenções de código: "Convenções do `sim`" no CLAUDE.md.
- Outras skills: `adr`, `gdd-decision`, `spec-slice`. Skills novas só quando uma necessidade aparecer na prática.
- Comandos: seção "Comandos" do [CLAUDE.md](../../CLAUDE.md). `npm run check` = o que o CI roda.
