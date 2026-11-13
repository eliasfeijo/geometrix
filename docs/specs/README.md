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
| [M1 — O ciclo da riqueza](m1-ciclo-da-riqueza/spec.md) | Spec aprovada · plan e tasks em rascunho |
