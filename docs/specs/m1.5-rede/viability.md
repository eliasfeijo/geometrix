# M1.5 rede — Viabilidade do ADR-0006

**Data:** 2026-11-14 · **Status:** aguardando o dono (checkpoint da F5) · **Spec:** [§7](spec.md) ·
**ADR:** [0006](../../adr/0006-sync-do-mundo.md), regra 10

A regra 10 do ADR-0006 pede que os deltas da visão de cada time sejam validados localmente, antes do M2, contra os
critérios da spec §7. **Se algum reprovar, o ADR volta à mesa.** Este documento junta as medições das fases F2–F5.

## 1. Critérios

| Critério (spec §7) | Alvo | Medido | | Onde |
|---|---|---|---|---|
| Banda por cliente, ×1, 60 creeps | ≤ 2 KB/s em média | **227 B/s** (mediana 111 B, p95 601 B, pico 4,6 KB por delta) | ✓ | `geo net`, 3 dias, seed 42 |
| CPU de visão + diff, 2 times | ≤ 250 µs por envio, mediana | **83 µs** (70,5 µs + 12,9 µs do hash amortizado); com 60 creeps, 85 µs + hash | ✓ | `geo net`, 3 dias, seed 42 |
| Correção do diff | visão aplicada = visão nova, todo tick, 2 times | **0 divergências** em 518 400 verificações (3 dias); no CI, 6 h × seeds 1, 42 e 649 | ✓ | `geo net`; `packages/protocol/test/delta-property.test.ts` |
| Sem mudança de gameplay | hash de 3 dias do seed 42 = `10662729…` | **igual**, com o estrategista lendo a visão do time | ✓ | `geo verify --ticks 259200`, `geo net` |
| Sem divergência com quedas | 0 hashes divergentes; visão final de cada cliente = a do servidor | **0 divergentes** em 14 372 hashes conferidos (4 clientes); as 4 visões finais iguais à do estado reconstruído do replay | ✓ | `npm run soak` |
| Retomada | queda curta dentro do buffer retoma sem visão completa; depois de restart, visão completa | **11–13 retomadas por cliente** sem visão completa (quedas do próprio cliente); depois de cada um dos 6 restarts, um `welcome` de reconexão | ✓ | testes do servidor e do cliente; `npm run soak` |

**Recomendação:** todos os critérios verdes. **Seguir para a fatia de fog**, mantendo o ADR-0006 como está (com o id do stream do ponto 2 da §5, se o dono aprovar). A decisão é do dono (spec §8).

## 2. Banda e CPU (`geo net`)

`npm run geo -- net --seed 42 --days 3` (relatório em `runs/m1.5-f2-checkpoint-s42/net.md`, fora do git). Um envio
por tick, como o servidor a ×1; os bytes são da mensagem `delta` inteira.

| Janela | Creeps | Bytes/delta, média | Bytes/delta, máx. | CPU por envio, mediana | p95 |
|---|---|---|---|---|---|
| 0–6 h | 12 | 161 | 1 577 | 36,7 µs | 75,5 µs |
| 18–24 h | 30 | 207 | 2 548 | 50,6 µs | 90,2 µs |
| 36–42 h | 60 | 266 | 4 561 | 81,6 µs | 136,4 µs |
| 66–72 h | 60 | 249 | 4 614 | 87,4 µs | 143,3 µs |

- **Partes do envio** (medianas, 2 times): visão 11 µs, diff 58 µs, `JSON.stringify` 1 µs. O spike estimou ~41 µs
  para visão + diff; a medição final é da mesma ordem e ~3× abaixo do alvo.
- **Picos:** 0,8% dos deltas passam de 2 KB, todos no tick em que os depósitos regeneram: ~50 creeps que esperavam
  voltam a coletar ao mesmo tempo (carga e atividade mudam juntas). A média por segundo fica em 227 B.
- **Hash da visão** (`viewJson` + SHA-256): ~390 µs cada, por isso só a cada 60 ticks (12,9 µs por envio,
  amortizado). A ×360 um envio cobre 72 ticks e quase todo envio leva hash: ~0,8 ms por mundo por envio, 5 vezes
  por segundo.
- **`welcome`:** a visão completa tem ~23 KB no fim do mundo (60 creeps). Sai só ao conectar, em reconexões que o
  buffer não cobre e em `resync`.
- **Antes (M1):** 26,5 KB por mensagem com 60 creeps, ~120 µs de `JSON.stringify` por mundo. A banda caiu ~115× e a
  CPU por envio caiu pela metade, mesmo com uma visão por time.

## 3. Quedas, retomadas e restarts (`npm run soak`)

`npm run soak` (×360, seed 42, 3 dias de mundo em 12,4 min reais; relatório em
`runs/soak-20261114-172301-s42/summary.md`, fora do git): 5 `kill -9` + 1 SIGTERM do servidor, e **2 clientes
WebSocket sem interface por time** conectados o mundo inteiro, cada um derrubando a própria conexão a cada 60 s
(escalonado). Os clientes seguem o stream como o navegador: retomada com `stream` e `seq`, `applyDelta`, hash e
`resync`.

| Cliente | Time | Visão final | Bytes/s, média | Pico | Deltas | Quedas | Retomadas | `welcome` (entrada · reconexão · resync) | `resync` | Hashes ✓ · ✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| soak-0-0 | 0 | igual à do servidor | 12,9 KB | 47,8 KB | 3 595 | 19 | 13 | 1 · 6 · 0 | 0 | 3 593 · 0 |
| soak-0-1 | 0 | igual à do servidor | 12,9 KB | 47,8 KB | 3 593 | 17 | 11 | 1 · 6 · 0 | 0 | 3 593 · 0 |
| soak-1-0 | 1 | igual à do servidor | 12,9 KB | 47,9 KB | 3 596 | 18 | 12 | 1 · 6 · 0 | 0 | 3 593 · 0 |
| soak-1-1 | 1 | igual à do servidor | 12,9 KB | 47,8 KB | 3 595 | 18 | 12 | 1 · 6 · 0 | 0 | 3 593 · 0 |

- **Servidor:** replay reconstruído no Node com o mesmo hash do servidor; voltou de cada queda em 1,3–8,9 s;
  memória por processo até ~200 MB (como no M1: o heap se acomoda, sem crescer entre restarts); SQLite final 55,2 MB.
- **Quedas** = as do próprio cliente (~12) + as 6 do servidor. As do cliente retomam pelo buffer (30 s); as do
  servidor dão `welcome` (o stream é novo). Nenhum `resync` foi preciso.
- **Velocidade do loop:** mediana 100% do multiplicador; a amostra mais lenta, 10%, contra 93% no soak do M1 (F9).
  É uma amostra de 2 s; não investiguei se veio de um restart ou dos clientes no mesmo processo do soak.
- A ×360 quase todo envio leva o hash (um envio cobre ~72 ticks): 3 593 hashes por cliente.

## 4. No navegador

Chromium headless, ×36, seed 42, `?net=1` (F4): em 8 s, 41 deltas e 4 hashes conferidos; depois de `kill -9` e
restart do servidor, a retomada é recusada (o stream é novo), chega um `welcome` de reconexão e os hashes seguem
conferindo (9 ✓, 0 ✗). A tela é a do M1. Bundle principal do cliente: 111 KB (40 KB gzip), antes 106 KB.

## 5. Pontos de atenção

1. **Banda a velocidades altas.** O alvo é a ×1. A ×36 o navegador recebe ~2,9 KB/s, e a ×360 o soak mede
   12,9 KB/s em média por cliente (pico 48 KB/s): cada envio cobre vários ticks. No jogo real (×1) não importa; em mundos acelerados de teste, sim.
2. **O id do stream na URL** (`&stream=…&seq=…`, não só `&seq=` como diz a R5) evita que, depois de um restart, um
   `seq` antigo caia no buffer novo e o cliente aplique deltas sobre a base errada. Precisa do OK do dono.
3. **O custo do hash** cresce com a visão. Com fog a visão encolhe; sem fog, a ×1, é desprezível.
4. **O que a fatia de fog muda:** só `view(state, team)` no `sim`. O diff, o protocolo, o servidor e o cliente já
   trabalham com uma visão por time, e o estrategista já decide só pelo que o time vê.
