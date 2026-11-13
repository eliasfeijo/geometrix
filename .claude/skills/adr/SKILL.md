---
name: adr
description: Rascunha um ADR do geometrix (status Proposed), aceita ou substitui um ADR com o OK do dono, e mantém o índice docs/adr/README.md. Use ao detectar uma decisão arquitetural ou quando o dono aprovar/rejeitar um ADR.
---

# ADR

Fontes: `CLAUDE.md` (regra dos ADRs) e `docs/adr/README.md` (fluxo de status). O formato abaixo é o dos ADRs
0001–0005.

## Quando usar

- Ao **detectar uma decisão arquitetural** durante qualquer trabalho: pare, avise o dono e rascunhe o ADR. Não
  implemente a decisão como se estivesse aceita.
- Quando o dono **aprovar** um ADR: mude o status para `Accepted`.
- Quando uma decisão nova **substituir** uma antiga: a antiga vira `Superseded by NNNN`.

## Status

| Status | Quem decide |
|---|---|
| `Proposed` | O rascunho sempre entra assim. |
| `Accepted (AAAA-MM-DD)` | **Só com a aprovação explícita do dono.** A data é a da aprovação. |
| `Superseded by NNNN` | Quando um ADR aceito posterior substitui este. |

Nunca escreva `Accepted` por conta própria, mesmo que a decisão pareça óbvia.

## Criar um ADR

1. Próximo número: o maior `NNNN` em `docs/adr/` + 1, com 4 dígitos.
2. Arquivo: `docs/adr/NNNN-<slug>.md`, com slug curto em PT-BR, minúsculo e com hífens.
3. Conteúdo, em PT-BR:

```markdown
# ADR-NNNN: <Título>

**Status:** Proposed · **Data:** AAAA-MM-DD
**Relaciona:** ADR-XXXX (<por quê>), <spec/GDD/ROADMAP relacionados>

## Contexto
<O problema e as forças em jogo. Ordens de grandeza quando importarem.>

## Alternativas
- **A. <opção>** (recomendada).
  - Prós: ...
  - Contras: ...
- **B. <opção>.**
  - Prós: ...
  - Contras: ...

## Decisão
<O que se propõe e as regras que decorrem disso.>

## Consequências
<O que muda, o que fica mais caro, o que precisa ser verificado.>
```

- `**Relaciona:**` é opcional (omita se não houver relação).
- Enquanto o ADR for `Proposed`, marque a opção como **(recomendada)**. Quando o dono aceitar, troque para
  **(escolhida)**.
- Diagramas só em Mermaid.
- Uma escolha que fica para depois (ex.: "a decidir no `plan.md`") deve ser dita explicitamente.

4. Acrescente a linha na tabela de `docs/adr/README.md`:
   `| [NNNN](NNNN-<slug>.md) | <Título> | Proposed | AAAA-MM-DD |`
5. Apresente ao dono um resumo: a decisão, a alternativa recomendada e o que depende dela.

## Aceitar um ADR (com o OK do dono)

1. Status → `**Status:** Accepted (AAAA-MM-DD) · **Data:** <data original>`.
2. Opção recomendada → **(escolhida)**. Se o dono escolheu outra opção, reescreva a Decisão de acordo.
3. Atualize o status na tabela do `docs/adr/README.md`.
4. Se o ADR era pré-requisito de uma spec (ex.: seção "Pré-requisitos antes do `plan.md`"), avise o dono que o
   pré-requisito foi atendido.

## Substituir um ADR

1. O ADR novo segue o fluxo de criação e cita o antigo em `**Relaciona:**`.
2. Só depois que o novo for aceito: o antigo vira `**Status:** Superseded by NNNN`, aqui e no índice.

## Commit

Use a skill `commit`: type `docs`, sem scope (ex.: `docs: propose ADR-0006 <assunto>`,
`docs: accept ADR-0006`).
