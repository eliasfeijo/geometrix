# Roadmap

> Proposta, a validar. Cada marco precisa de uma pergunta de design respondida em playtest antes do próximo.

| Marco | Escopo | Pergunta que ele responde |
|---|---|---|
| **M0 — Design** | Pilares, GDD, ADRs, harness de DX (CLAUDE.md, fluxo de spec) | O que estamos construindo? |
| **M1 — O ciclo da riqueza** | Mundo mínimo: 2 Núcleos num mapa pequeno e simétrico, matéria + cristal, creeps que coletam e carregam até a base, produção de creeps, construção de estrada, piloto automático declarativo básico, dominar/liberar | Coletar, transportar e investir já é interessante sozinho? |
| **M1.5 — A névoa** | Sincronização por deltas da visão de cada time ([ADR-0006](adr/0006-sync-do-mundo.md)), com a viabilidade validada localmente; fog of war no mundo, em que clientes e bots só veem o que o próprio time enxerga (design decidido em 2026-11-14 no [GDD 01](gdd/01-mundo.md): névoa negra, visão por DNA, memória do time, piloto e caminho pelo que o time sabe) | Esconder informação cria decisões interessantes (explorar, proteger rotas) sem tornar o mapa ilegível? |
| **M2 — A emboscada** | Uma emboscada numa carga em trânsito abre uma instância de batalha; um humano domina um creep; o resultado volta ao mundo; auto-resolve quando não há humano | A batalha muda o rumo do mundo sem dominar o jogo? |
| **M3 — O time** | 3v3, impostos, votação com níveis de autoridade, genética e progressão | A governança gera decisões interessantes, ou só burocracia? |
| **M4 — O mundo vivo** | Jungle com tribos e diplomacia, piloto automático scriptável, construção ampla | — |

**M1 sem playtest de diversão** (dono, 2026-11-14): sem combate não há o que vencer. O M1 fecha com a sessão do
dono, bots, um teste de resistência comprimido (no lugar do mundo de 24 h) e uma rodada de **legibilidade e
playtest humano** local, sem deploy (F9) ([spec M1 §8](specs/m1-ciclo-da-riqueza/spec.md)). O deploy e o playtest
de diversão abrem o M2.

**M1.5 antes do M2** (dono, 2026-11-14): duas fatias, nesta ordem. (1) **Rede:** deltas da visão de cada time,
sem mudar o gameplay, com a viabilidade validada localmente antes de qualquer deploy (critérios na spec da fatia;
se reprovar, o ADR-0006 volta à mesa). (2) **Fog of war:** depois de uma rodada de design sobre as perguntas abertas
do GDD 01, com playtest local de legibilidade. Motivo: a emboscada do M2 pressupõe que nem tudo é visível. O deploy
e o playtest de diversão continuam abrindo o M2.

**Escopo da fatia de fog** (rodada de design, 2026-11-14): o dono escolheu a névoa negra e a visão por DNA, que vão
além de só filtrar a visão. A fatia passa a incluir a ação "explorar" do piloto automático, o caminho calculado pelo
que o time sabe (cache por time), o terreno explorado no delta da rede (hoje o mapa vai inteiro no `welcome`) e a
exploração no estrategista dos bots, e a linha de visão (pedras bloqueiam; spec do fog, D1).

O mapa completo de 3 lanes + 2 jungles entra conforme os marcos pedirem, não antes.
