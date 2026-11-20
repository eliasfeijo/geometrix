# ADRs

Fluxo: o rascunho entra como `Proposed` e só vira `Accepted` com a aprovação do dono. Uma decisão substituída
vira `Superseded by NNNN`.

| # | Título | Status | Data |
|---|---|---|---|
| [0001](0001-mundo-e-batalha-separados.md) | Mundo e batalha como simulações separadas | Accepted | 2026-11-12 |
| [0002](0002-tudo-e-comando.md) | Toda ação na simulação é um comando | Accepted | 2026-11-12 |
| [0003](0003-stack-typescript-node.md) | TypeScript + Node LTS, com simulação pura e math inteira | Accepted | 2026-11-13 |
| [0004](0004-persistencia-sqlite-log-de-comandos.md) | Persistência do mundo: SQLite + snapshots + log de comandos + Litestream | Accepted | 2026-11-13 |
| [0005](0005-deploy-mvp-vps-websocket.md) | Deploy do MVP: VPS única + Docker Compose + Caddy; transporte por WebSocket | Accepted | 2026-11-13 |
| [0006](0006-sync-do-mundo.md) | Sincronização do mundo: deltas por campo da visão de cada time | Accepted | 2026-11-14 |
| [0007](0007-eventos-do-sim.md) | Eventos do `sim`: saída derivada do `step`, fora do estado | Accepted | 2026-11-15 |
| [0008](0008-pacote-de-batalha.md) | Pacote de batalha: simulação determinística própria e o contrato interno v0 | Accepted | 2026-11-15 |
| [0009](0009-predicao-no-laboratorio.md) | Predição do próprio creep como opção de experimento do laboratório | Proposed | 2026-11-20 |
