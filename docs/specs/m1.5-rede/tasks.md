# Tasks M1.5 — Rede: deltas da visão de cada time

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Regra: uma task só é marcada `[x]` com os testes verdes (`npm run check`), no mesmo commit que a conclui. Cada fase
na sua branch `m1.5/f<n>-<slug>` (skill `commit`), com merge `--no-ff` em `main`.

## F0 — Spike, spec e plan (`m1.5/f0-spike`)

- [x] Spike: diff à mão (direto do estado e por uma visão com cópia rasa), CPU e bytes (plan §1)
- [x] Spike: schema do Colyseus 5.0.48, CPU e bytes (plan §1)
- [x] Spec aprovada (2026-11-14)
- [x] **Checkpoint:** plan aprovado (decisões R1–R7, 2026-11-14)

## F1 — Visão no `sim` (`m1.5/f1-view`)

- [x] Teste com o hash de um mundo bot × bot de 6 h do seed 42, travando o comportamento do estrategista (plan §7)
- [x] `view.ts`: `CreepView`, `TeamView`, `view(state, team)`, exportados no `index.ts`, com testes (plan §3, §8)
- [x] `nextSegment`, `roadTarget` e o que mais o estrategista usa aceitam tipos estruturais (R3); hash de 6 h igual
- [x] Estrategista lê a visão do time + o mapa + os parâmetros, no harness e no servidor (spec V-3); hash de 6 h
      igual
- [x] Convenção no `CLAUDE.md`: regras são substituídas inteiras, nunca mutadas no lugar (R4)

## F2 — Delta no `protocol` (`m1.5/f2-delta`)

- [x] `delta.ts`: `Sent`, `diffView`, `applyDelta`, `viewJson`, com os casos pequenos do plan §8
- [x] Teste de propriedade: 6 h × seeds 1, 42 e 649, comparando cópias em JSON canônico (plan §7)
- [x] `geo net --seed --days`: bytes e CPU por delta (mediana, p95), propriedade em todo tick, `runs/<id>/net.md`
- [ ] **Checkpoint:** `geo net` de 3 dias no seed 42: banda, CPU e propriedade contra os alvos da spec §7; hash de 3
      dias igual a `10662729…`

## F3 — Servidor (`m1.5/f3-server`)

- [ ] Mensagens do plan §4 no `protocol` (`welcome` com `protocol`, `seq` e `view`; `delta`; `resync`);
      `PROTOCOL_VERSION`
- [ ] `Broadcaster` com um stream por time: `sent`, `seq`, `lastView`, delta a cada envio, inclusive sem socket
      (R7)
- [ ] Hash da visão a cada `viewHashEveryTicks`; `welcome` com `lastView`
- [ ] Retomada por `&seq=` com o buffer de `deltaBufferMs`; fora do buffer ou depois de restart, `welcome`
- [ ] `resync`: responde com `welcome` e registra a linha de incidente no log

## F4 — Cliente (`m1.5/f4-client`)

- [ ] Store aplica deltas com compartilhamento; interpolação igual à do M1
- [ ] Conexão guarda o `seq` e o manda só ao reconectar na mesma página
- [ ] `seqGap` e hash divergente pedem resync; versão do protocolo diferente recarrega a página
- [ ] Painel de rede com `?net=1`

## F5 — Soak com clientes e viabilidade (`m1.5/f5-soak`)

- [ ] Clientes WebSocket sem interface no soak (2 por time), com `applyDelta` e hash; seção por cliente no
      `summary.md`
- [ ] `npm run soak` completo; relatório de viabilidade em `viability.md` contra a spec §7
- [ ] Dashboard atualizado
- [ ] **Checkpoint:** sessão do dono com `npm run dev:multi` e `?net=1` (tela igual à do M1, retomada ao derrubar o
      servidor) e decisão sobre a viabilidade: segue para a fatia de fog, ou o ADR-0006 volta à mesa
