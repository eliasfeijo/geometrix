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
| [M1.5 — Fog of war](m1.5-fog/spec.md) | Concluída (2026-11-14) |
| [M2 — O encontro](m2-encontro/spec.md) (fatia A de 5) | Aprovada (2026-11-15), com D1–D21 · ADR-0007 aceito · plan aprovado (P1–P11) · F1 a seguir |
| [M2 — O laboratório de batalha](m2-laboratorio/spec.md) (fatia B de 5) | Aprovada (2026-11-15), com D1–D19 · ADR-0008 aceito · plan aprovado (P1–P14) · F1 a seguir |
