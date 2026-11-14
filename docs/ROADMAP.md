# Roadmap

> Proposta, a validar. Cada marco precisa de uma pergunta de design respondida em playtest antes do próximo.

| Marco | Escopo | Pergunta que ele responde |
|---|---|---|
| **M0 — Design** | Pilares, GDD, ADRs, harness de DX (CLAUDE.md, fluxo de spec) | O que estamos construindo? |
| **M1 — O ciclo da riqueza** | Mundo mínimo: 2 Núcleos num mapa pequeno e simétrico, matéria + cristal, creeps que coletam e carregam até a base, produção de creeps, construção de estrada, piloto automático declarativo básico, dominar/liberar | Coletar, transportar e investir já é interessante sozinho? |
| **M2 — A emboscada** | Uma emboscada numa carga em trânsito abre uma instância de batalha; um humano domina um creep; o resultado volta ao mundo; auto-resolve quando não há humano | A batalha muda o rumo do mundo sem dominar o jogo? |
| **M3 — O time** | 3v3, impostos, votação com níveis de autoridade, genética e progressão | A governança gera decisões interessantes, ou só burocracia? |
| **M4 — O mundo vivo** | Jungle com tribos e diplomacia, piloto automático scriptável, construção ampla | — |

**M1 sem playtest humano** (dono, 2026-11-14): sem combate não há o que vencer, então o M1 fecha com a sessão do
dono, bots e o mundo de 24 h ([spec M1 §8](specs/m1-ciclo-da-riqueza/spec.md)). O deploy e o primeiro playtest
humano abrem o M2.

O mapa completo de 3 lanes + 2 jungles entra conforme os marcos pedirem, não antes.
