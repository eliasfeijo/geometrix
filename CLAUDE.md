# CLAUDE.md — geometrix

Jogo multiplayer de navegador: **mundo persistente de estratégia/economia (RTS + sandbox + construção)** com
**batalhas em tempo real estilo MOBA** como tempero. Visual 100% geométrico (SVG/Canvas, formas como linguagem).

**Fase atual: M1.5 (A névoa): fatia de rede concluída (`docs/specs/m1.5-rede/`); fatia de fog
(`docs/specs/m1.5-fog/`) com F1–F3 concluídas, próxima F4.** O M1 está em `docs/specs/m1-ciclo-da-riqueza/` (o histórico fica no `tasks.md`; a estrutura do repositório, no `plan.md` §1).

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
| Skills do workflow (commit, fase, ADR, GDD, fatia) | `.claude/skills/` (implementar uma fase: `implement-phase`) |

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
| `npm run geo -- net --seed 42 --days 3` | Banda e CPU dos deltas da visão contra os alvos da spec M1.5 §7, com a propriedade do diff em todo tick. Relatório em `runs/<id>/net.md` |
| `npm run server` | Servidor em `http://localhost:8080` (`GEO_PORT`, `GEO_DB`, `GEO_PARAMS`); serve o build do cliente |
| `npm run build` | Build do cliente (Vite) em `apps/client/dist`, que o servidor serve |
| `npm run client` | Dev server do Vite (porta 5173) com proxy de `/api` e `/ws` para o servidor no `GEO_PORT` |
| `npm run dev:multi -- --clients 3` | Build + servidor + um mundo com K jogadores (Azul/Laranja alternados), uma aba por jogador (`--seed`, `--mult`, `--no-build`, `--no-open`, `--net` para o painel de rede `?net=1`) |
| `npm run soak` | Teste de resistência: mundo bot × bot inteiro (×360, ~12 min) com `kill -9` e restart, e 2 clientes WebSocket por time seguindo os deltas; o replay exportado tem de dar o hash do servidor e cada cliente, a visão do servidor. Relatório em `runs/soak-<id>/` |

## Convenções do `sim`

O `packages/sim` é puro e determinístico (ADR-0003). O tsconfig e o lint já barram APIs do runtime, `Math.random`,
funções transcendentais, `Date`, `for…in` e literais de ponto flutuante. Além disso:

- **Unidades inteiras:** posições em células, durações em segundos de mundo, modificadores em ‰, movimento em
  pontos (`CELL_COST`). Toda divisão tem de dar inteiro: `Math.floor`, ou divisibilidade garantida (ex.:
  `CELL_COST` é múltiplo de 60) ou validada nos params (ex.: largura par).
- **Parâmetro novo:** entra no `schema` de `params.ts` (o tipo `Params` deriva dele), em `params/default.json` e,
  se tiver relação com outros, em `checkConsistency`. Número de balanceamento nunca fica no código.
- **Campo novo no estado:** tipo em `world.ts`, valor inicial no `createWorld`, só dados JSON (nada de `Map`, `Set`
  ou classes; o `serialize` recusa). Atualize o hash fixo (ver skill `implement-phase`).
- **Estado:** arrays ordenados por id; ids do contador `nextId`, nunca reaproveitados. O `step` muta in place.
- **RNG:** só o `state.rng` (`nextInt`/`nextRange`), sempre na mesma ordem de chamadas.
- **Regras de um creep são substituídas inteiras, nunca mutadas no lugar** (`creep.rules = …`, como `setRules` e
  os presets). O delta da rede compara as regras por referência (plan M1.5, R4). A ordem, ao contrário, é recriada
  a cada tick pelo piloto automático com o mesmo valor e é comparada por valor.
- **Visão do time** (`view.ts`): o que um time enxerga, e a única entrada do estrategista (com o mapa estático e
  os parâmetros). Cópia rasa: aninhados compartilhados com o estado, que o `step` muta.
- **Pipeline do tick** (plan §5) em `step.ts`; ordens novas em `orders.ts`. Estrada concluída incrementa
  `state.roadRevision` (invalida os caminhos em cache).
- **Exports:** todo módulo público entra em `packages/sim/src/index.ts`; os outros pacotes importam de
  `@geometrix/sim`.
- **Testes** em `packages/<pacote>/test/`, com `test/helpers.ts` (`loadTestParams`: os parâmetros fixos de
  `test/params.json`, que não acompanham o balanceamento). Mapas pequenos de teste
  desenhados em texto (ver `pathfinding.test.ts`).

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
