# Tasks M1 — O ciclo da riqueza

Marque `[x]` ao concluir. Cada task deve terminar com os testes verdes. Referências: [plan.md](plan.md) ·
[spec.md](spec.md).

## F0 — Bootstrap
- [x] `git init`, `.gitignore`, `.nvmrc`, `package.json` raiz com workspaces
- [x] `tsconfig.base.json` (`strict`, `erasableSyntaxOnly`, ESM) + tsconfig de cada pacote; o do `sim` sem DOM e sem `@types/node`
- [x] ESLint + Prettier; regras de determinismo no `sim` (plan §2)
- [x] Vitest configurado nos workspaces
- [x] CI no GitHub Actions: typecheck, lint, test
- [x] Atualizar o CLAUDE.md com os comandos essenciais

## F1 — Núcleo do sim
- [x] RNG xoshiro128** com seed, cujo estado é serializável (teste: a sequência é estável)
- [x] Schema de parâmetros + `params/default.json` com os valores da spec §6
- [x] Tipos de `WorldState` e `createWorld(seed, params)`
- [x] Geração de mapa com simetria de ponto, rio, travessias, rochas e depósitos + validação de conectividade (teste de propriedade com 500 seeds)
- [x] `serialize` canônico e `restore`
- [x] `step(state, commands)` com o pipeline vazio e `tick++`
- [x] `geo verify` mínimo (2 execuções + snapshot→restore), rodando no CI

## F2 — Movimento
- [x] Pontos de movimento com modificadores de terreno, estrada e carga em ‰
- [x] A* em 4 direções com desempate determinístico e cache de caminho
- [x] Ordens `moveTo` e `stop`

## F3 — Economia
- [x] Coleta com capacidade (DNA × upgrade) e taxa por tick
- [x] Entrega no Núcleo e estoque do time
- [x] Regeneração de matéria; esgotamento de cristal
- [x] Produção de creep: custo, tempo, teto de população, opção "repetir" (P5)
- [x] Upgrade de capacidade
- [x] `buildRoad`: segmentos conectados, débito de matéria, tempo de construção, invalidação de caminhos

## F4 — Piloto automático e domínio
- [x] `validate(state, cmd, playerId)` para todos os comandos externos (plan §4)
- [x] `dominate`/`release` com as regras D-1..D-4
- [x] Interpretador de regras com o vocabulário P-2
- [x] Presets: coletor de matéria, coletor de cristal, construtor de estrada
- [x] `setRules` e `applyPreset`

## F5 — Harness
- [x] Acumuladores de stats + `sampleMetrics` puro
- [x] Estrategista bot `balanced`
- [x] `geo sim` → `runs/<id>/` (métricas, replay, `report.md`)
- [x] `geo sweep`
- [x] `geo verify` completo (incluindo o replay a partir do log)
- [x] Orçamento de performance: 6 h de mundo no CI; 3 dias em menos de 10 min medido manualmente
- [x] **Checkpoint:** primeiro relatório de 3 dias bot×bot revisado com o dono

## F6 — Servidor
- [x] Esquema SQLite + módulo de persistência
- [x] `world-host`: loop de tick com multiplicador, fila de comandos, snapshots
- [x] HTTP: criar mundo, join, estáticos
- [x] WebSocket: autenticação, comandos com ack/reject, broadcast limitado a 5 por segundo
- [x] `release` automático por desconexão (carência de 15 s) ou inatividade (5 min reais)
- [x] Bots opcionais por time no servidor; limite de 3 humanos por time no `join` (decisões do dono, 2026-11-14)
- [x] Recuperação após restart (teste de integração: o hash continua o mesmo)

## F7 — Cliente
- [x] Vite + Preact; conexão, `welcome`, reconexão
- [x] Mapa SVG com camadas estática e dinâmica; pan e zoom
- [x] Creeps por DNA e time, anel de carga, halo de domínio, interpolação
- [x] Inspetor do creep; dominar e liberar
- [x] Painel do Núcleo
- [x] Editor de regras e presets
- [x] Controle direto (moveTo, gather, deliver, modo estrada)
- [x] **Checkpoint:** sessão do dono: interface, legibilidade, editor de regras, domínio, multi-cliente local
  (spec §8, revista em 2026-11-14)

## F8 — Replay e multi-cliente
- [x] Modo replay no navegador (o `sim` roda no cliente)
- [x] Verificar o hash do replay no Safari/JSC
- [x] Script `npm run dev:multi -- --clients K`

## F9 — Legibilidade e playtest

Decidida pelo dono em 2026-11-14, no fim do F8 (spec §8, itens 3 e 4).

- [x] `npm run soak`: teste de resistência comprimido (quedas forçadas, restart, hash no servidor, no Node e no
  navegador; memória, SQLite e atraso do loop)
- [x] Estrada e pedra distinguíveis no mapa
- [x] Feedback do custo da estrada (modo estrada, pagamento, obra em andamento)
- [x] Sinal de carga cheia no creep
- [x] Feedback de entrega no Núcleo
- [x] Nome do creep no mapa
- [x] `docs/PLAYTEST.md`: acesso ao servidor local, roteiro e questionário de legibilidade
- [ ] **Checkpoint:** playtest humano de legibilidade e mecânica; replay validado pelo dono; melhorias seguintes
  registradas

## Fora do M1 — Deploy e playtest de diversão

**Fora do M1** (dono, 2026-11-14): vira a primeira etapa antes do playtest do M2. Fica aqui como referência.

- [ ] Dockerfile, `compose.yml`, Caddyfile, `litestream.yml`
- [ ] Workflow de deploy manual
- [ ] `docs/PLAYTEST.md`: túnel, protocolo, questionário
- [ ] **Checkpoint:** playtest comprimido (×36, 2 h)
