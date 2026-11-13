---
name: spec-slice
description: Cria e conduz uma fatia do geometrix pelo fluxo spec → plan → tasks em docs/specs/<marco>-<slug>/, respeitando as aprovações do dono em cada etapa. Use ao começar a próxima fatia de um marco ou ao avançar uma fatia de etapa.
---

# Fatia: spec → plan → tasks

Fontes: `docs/specs/README.md` (fluxo e regra), `CLAUDE.md` e a fatia M1 (`docs/specs/m1-ciclo-da-riqueza/`), que
serve de modelo.

## Regra principal

A spec é a fonte de verdade. Diante de uma ambiguidade que ela não cobre, **pare e pergunte**. Não preencha a
lacuna com um palpite.

## Etapas e portões

| Etapa | Arquivo | Pode começar quando | Termina quando |
|---|---|---|---|
| 1 | `spec.md` (**o quê**) | O marco está no `docs/ROADMAP.md` | O dono aprova a spec |
| 2 | `plan.md` (**como**) | Spec aprovada **e** ADRs pré-requisitos `Accepted` | O dono aprova o plan |
| 3 | `tasks.md` | Junto com o `plan.md` | Todas as tasks `[x]` |

- `plan.md` e `tasks.md` só são obrigatórios em fatias substanciais. Em fatias pequenas, pergunte ao dono se
  bastam a spec e o código.
- **Nenhum código antes da spec aprovada.**
- Atualize a coluna de status da tabela em `docs/specs/README.md` a cada portão.

## 1. spec.md

Pasta: `docs/specs/<marco>-<slug>/` (ex.: `m1-ciclo-da-riqueza`). Cabeçalho:

```markdown
# Spec <MARCO> — <Nome>

**Status:** Rascunho · **Data:** AAAA-MM-DD · **Marco:** <MARCO> ([ROADMAP](../../ROADMAP.md))
**GDD relacionado:** <links para docs/gdd/>
```

Precisa cobrir (o `docs/specs/README.md` exige): **hipótese, escopo, comportamento, critérios de aceite e
métricas**. Use a spec do M1 como referência de seções:
hipótese · decisões de escopo assumidas · escopo (dentro/fora) · comportamento · parâmetros iniciais · harness ·
protocolo de teste · pré-requisitos antes do `plan.md` · perguntas abertas.

- Gameplay só do GDD. O que faltar vira pergunta aberta ou proposta marcada como tal.
- Decisões de escopo que a spec assume ficam numa tabela (`D1`, `D2`, ...) e só valem com o aceite do dono.
- Números são chutes provisórios e devem ser marcados assim.
- ADRs necessários entram na seção de pré-requisitos e são feitos com a skill `adr`.

## 2. plan.md

```markdown
# Plan <MARCO> — <Nome>

**Status:** Rascunho · **Data:** AAAA-MM-DD
**Spec:** [spec.md](spec.md) · **ADRs:** <links>
```

- Decisões técnicas, módulos e arquivos.
- Toda decisão que precisa do OK do dono é marcada e listada numa tabela própria (no M1: `P1`..`P6`, com
  proposta e alternativa).
- Termina com a ordem de implementação em fases (`F0`, `F1`, ...) e os checkpoints.
- Se o plan responder uma pergunta aberta da spec, quando o dono aprovar mova a resposta para a tabela de
  decisões da spec e tire-a das perguntas abertas.

## 3. tasks.md

- Uma seção por fase do plan (`## F<n> — <nome>`), com tasks atômicas em checkbox `- [ ]`.
- Cada task termina com os testes verdes. Marque `[x]` ao concluir, no mesmo commit (skill `commit`).
- Checkpoints com o dono aparecem como task em negrito (`**Checkpoint:** ...`).
- Cada fase é implementada na sua branch `m<marco>/f<fase>-<slug>` (skill `commit`).

## Aprovação

Quando o dono aprovar uma etapa:
1. Status do arquivo → `Aprovada (AAAA-MM-DD)` / `Aprovado (AAAA-MM-DD)`.
2. Itens que dependiam do OK dele deixam de ser marcados como pendentes.
3. Atualize `docs/specs/README.md`.
4. Commit com a skill `commit` (ex.: `docs: approve M2 spec`).
