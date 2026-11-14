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
- [ ] Acumuladores de stats + `sampleMetrics` puro
- [ ] Estrategista bot `balanced`
- [ ] `geo sim` → `runs/<id>/` (métricas, replay, `report.md`)
- [ ] `geo sweep`
- [ ] `geo verify` completo (incluindo o replay a partir do log)
- [ ] Orçamento de performance: 6 h de mundo no CI; 3 dias em menos de 10 min medido manualmente
- [ ] **Checkpoint:** primeiro relatório de 3 dias bot×bot revisado com o dono

## F6 — Servidor
- [ ] Esquema SQLite + módulo de persistência
- [ ] `world-host`: loop de tick com multiplicador, fila de comandos, snapshots
- [ ] HTTP: criar mundo, join, estáticos
- [ ] WebSocket: autenticação, comandos com ack/reject, broadcast limitado a 5 por segundo
- [ ] `release` automático por desconexão ou inatividade
- [ ] Recuperação após restart (teste de integração: o hash continua o mesmo)

## F7 — Cliente
- [ ] Vite + Preact; conexão, `welcome`, reconexão
- [ ] Mapa SVG com camadas estática e dinâmica; pan e zoom
- [ ] Creeps por DNA e time, anel de carga, halo de domínio, interpolação
- [ ] Inspetor do creep; dominar e liberar
- [ ] Painel do Núcleo
- [ ] Editor de regras e presets
- [ ] Controle direto (moveTo, gather, deliver, modo estrada)
- [ ] **Checkpoint:** primeiro playtest local

## F8 — Replay e multi-cliente
- [ ] Modo replay no navegador (o `sim` roda no cliente)
- [ ] Verificar o hash do replay no Safari/JSC
- [ ] Script `npm run dev:multi -- --clients K`

## F9 — Deploy e playtest
- [ ] Dockerfile, `compose.yml`, Caddyfile, `litestream.yml`
- [ ] Workflow de deploy manual
- [ ] `docs/PLAYTEST.md`: túnel, protocolo, questionário
- [ ] **Checkpoint:** playtest comprimido (×36, 2 h)
