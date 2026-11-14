# Specs

Uma pasta por fatia: `docs/specs/<marco>-<slug>/`.

| Arquivo | Conteúdo | Quando |
|---|---|---|
| `spec.md` | **O quê**: hipótese, escopo, comportamento, critérios de aceite, métricas | Sempre. Precisa ser aprovada pelo dono antes de qualquer código. |
| `plan.md` | **Como**: decisões técnicas, módulos, arquivos | Fatias substanciais, depois da spec aprovada e dos ADRs pré-requisitos |
| `tasks.md` | Tarefas atômicas, marcadas `[x]` conforme são implementadas | Junto com o `plan.md` |

Regra: a spec é a fonte de verdade. Diante de uma ambiguidade não coberta, pare e pergunte.

| Spec | Status |
|---|---|
| [M1 — O ciclo da riqueza](m1-ciclo-da-riqueza/spec.md) | Concluída (2026-11-14) |
| [M1.5 — Rede: deltas da visão de cada time](m1.5-rede/spec.md) | Concluída (2026-11-14): viabilidade aprovada pelo dono |
| [M1.5 — Fog of war](m1.5-fog/spec.md) | Rascunho (2026-11-14): aguarda o aceite de D1–D12 |
