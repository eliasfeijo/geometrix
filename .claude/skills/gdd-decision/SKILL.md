---
name: gdd-decision
description: Registra no GDD do geometrix uma decisão do dono, movendo o item de Proposta/Perguntas abertas para Decidido, ou acrescenta uma proposta, pergunta ou sistema novo. Use quando o dono decidir algo de design ou quando surgir gameplay que não está no GDD.
---

# Decisão no GDD

Fontes: `CLAUDE.md` (regras "Decidido × proposto × aberto", "Não invente gameplay" e "Guarda de escopo") e
`docs/gdd/README.md`.

## Estrutura de cada arquivo do GDD

| Seção | O que entra |
|---|---|
| `## Decidido` | Só o que o dono aprovou explicitamente. |
| `## Proposta` | Sugestões ainda não aprovadas. |
| `## Ideias em incubação (...)` | Opcional. Ideias adiadas para um marco futuro (ex.: `02-creeps-e-dominio.md`). |
| `## Perguntas abertas` | O que ainda não tem resposta. |

## Regras

- **Nunca promova uma proposta a decidida sem o OK explícito do dono.** "Parece bom" dito por você não conta.
  Na dúvida se o dono aprovou, pergunte.
- **Não invente gameplay.** Se o que você precisa não está no GDD nem na spec, pergunte. Se quiser sugerir algo,
  ele entra em `Proposta`, nunca em `Decidido`.
- **Números** (custos, tempos, stats) são provisórios até serem validados em playtest ou simulação. Mesmo
  decididos, devem continuar marcados como provisórios no texto.

## Registrar uma decisão do dono

1. Ache o item em `Proposta` e/ou em `Perguntas abertas` (pode estar nos dois, ou em mais de um arquivo).
2. Escreva a decisão em `Decidido`, com as palavras do que o dono decidiu. Não acrescente detalhes que ele não deu.
3. **Remova** o item de `Proposta` e de `Perguntas abertas`.
4. Se a decisão mudou o que a proposta dizia, o texto em `Decidido` segue a decisão, não a proposta.
5. Procure a mesma pergunta em specs (`docs/specs/*/spec.md`, seção "Perguntas abertas") e em outros arquivos do
   GDD (`grep`), e atualize-os também.
6. Se a decisão tiver impacto arquitetural, use a skill `adr`.

## Acrescentar um sistema novo ao GDD

1. **Guarda de escopo:** antes de tudo, diga ao dono em qual marco do `docs/ROADMAP.md` o sistema entraria e se
   ele aumenta o escopo do marco atual. Não aceite em silêncio.
2. Com o OK do dono: crie `docs/gdd/NN-<slug>.md` com as seções acima e acrescente a linha no índice
   `docs/gdd/README.md`, com o marco.

## Commit

Use a skill `commit`: type `docs`, sem scope (ex.: `docs: decide domination cooldown in GDD 02`).
