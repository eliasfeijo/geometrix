# CLAUDE.md — geometrix

Jogo multiplayer de navegador: **mundo persistente de estratégia/economia (RTS + sandbox + construção)** com
**batalhas em tempo real estilo MOBA** como tempero. Visual 100% geométrico (SVG/Canvas, formas como linguagem).

**Fase atual: M1 em implementação.** Spec, plan e tasks aprovados em `docs/specs/m1-ciclo-da-riqueza/`. O progresso
fica no `tasks.md`; a estrutura do repositório, no `plan.md` §1.

## Fontes de verdade

| O quê | Onde |
|---|---|
| **Onde estamos e próximos passos** | `docs/dashboard/current-status.md` (leia primeiro) |
| O que o jogo é e não é | `docs/PILLARS.md` |
| Vocabulário | `docs/GLOSSARY.md` |
| Design por sistema | `docs/gdd/` (um arquivo por sistema) |
| Decisões de arquitetura | `docs/adr/` |
| Specs de fatias (spec → plan → tasks) | `docs/specs/` |
| Ordem de construção | `docs/ROADMAP.md` |
| Skills do workflow (commit, ADR, GDD, fatia) | `.claude/skills/` |

## Comandos

Node 26 (`.nvmrc`). O Node roda `.ts` direto; só o cliente tem build (Vite).

| Comando | O quê |
|---|---|
| `npm install` | Instala as dependências de todos os workspaces |
| `npm run check` | Tudo o que o CI roda: typecheck, lint, format:check e testes. **Verde antes de concluir uma task.** |
| `npm run typecheck` | `tsc` em cada workspace |
| `npm run lint` | ESLint, incluindo as regras de determinismo do `sim` |
| `npm run format` | Prettier (não mexe em Markdown) |
| `npm test` | Vitest em todos os workspaces |
| `npm test -- --project @geometrix/sim` | Vitest num workspace só |
| `npm run geo -- verify --seed 42` | Determinismo: 2 execuções + snapshot → restore têm de dar o mesmo hash |

## Regras de trabalho

- **Decidido × proposto × aberto.** Cada arquivo do GDD separa `Decidido` (o dono aprovou), `Proposta` (sugestão
  ainda não aprovada) e `Perguntas abertas`. Nunca promova uma proposta a decidida sem o OK explícito do dono.
  Quando ele decidir algo, mova o item para `Decidido` e tire de `Perguntas abertas`.
- **Não invente gameplay.** Se algo não está no GDD, pergunte. Números (custos, tempos, stats) são provisórios até
  serem validados em playtest ou simulação.
- **Primeiro o concreto, depois o genérico.** Nenhuma abstração de "engine" sem uma necessidade do jogo. O código
  deve ser modular para que partes possam virar biblioteca depois, mas sem generalização especulativa.
- **Guarda de escopo.** Todo sistema novo entra no GDD com o marco do `ROADMAP.md` em que aparece. Avise quando
  uma ideia aumentar o escopo do marco atual em vez de só aceitá-la.
- **ADRs:** ao detectar uma decisão arquitetural, rascunhe o ADR com status `Proposed`. Ele só vira `Accepted`
  com a aprovação do dono. Atualize `docs/adr/README.md`.
- **Idioma:** documentação em PT-BR; identificadores de código e mensagens de commit em inglês.
- **Diagramas** em Mermaid, nunca ASCII art (árvore de pastas pode ser bloco de texto).

## Referência externa

`github.com/vitormartins1/go-multiplayer-control-plane`: control plane em Go (contas, matchmaking, sessão,
conquistas, ranking, analytics). Candidato a integração futura. Não reimplemente o que ele já oferece sem antes
discutir.
