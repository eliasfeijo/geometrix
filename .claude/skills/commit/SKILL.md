---
name: commit
description: Cria commits no padrão Conventional Commits do geometrix, um por unidade lógica de trabalho, na branch da fase. Use sempre que for commitar neste repositório.
---

# Commit

Regras de commit do geometrix. Fontes: o pedido do dono (Conventional Commits, um commit por unidade lógica), o
`CLAUDE.md` (mensagens em inglês) e a estrutura de pacotes do [plan M1 §1](../../../docs/specs/m1-ciclo-da-riqueza/plan.md).

## Branches

- `main` é a branch padrão. Nela não se commita trabalho de fase.
- Cada fase do `tasks.md` tem a sua branch: `m<marco>/f<fase>-<slug>` (ex.: `m1/f0-bootstrap`).
- No fim da fase, com `npm run check` verde, a branch entra em `main` com **`git merge --no-ff`** (nunca squash
  nem rebase): cada fase vira um merge commit, `git log --first-parent main` mostra uma linha por fase, e os
  commits por unidade lógica ficam preservados. Mensagem: `merge: m1/f0-bootstrap (M1 F0 — Bootstrap)`, com um
  corpo resumindo a fase e os trailers. O `git merge` não lê `-F -`: grave a mensagem num arquivo do scratchpad e
  use `git merge --no-ff <branch> -F <arquivo>`.
- Antes do merge, atualize `docs/dashboard/current-status.md` na própria branch da fase.
- Trabalho entre fases (docs, decisões do dono, harness) entra como os primeiros commits da branch da **próxima**
  fase, criada a partir de `main` se ainda não existir.
- Antes de commitar, confira a branch atual. Se o trabalho não pertence a nenhuma fase nem à próxima (ex.: design
  de outro marco), **pergunte ao dono** onde commitar.

## Unidade lógica

Um commit = uma unidade lógica de trabalho, que dá para descrever numa frase sem "e também".

- Uma task do `tasks.md` costuma ser um commit. O `[x]` da task vai **no mesmo commit** que a conclui.
- Se uma task tiver partes independentes (ex.: refatoração preparatória + a mudança), separe-as em commits.
- Nunca misture no mesmo commit mudanças que não têm relação (ex.: uma correção de doc no meio de uma feature).
- Código e os testes dele vão juntos.
- A task só é marcada `[x]` com os testes verdes (regra do `tasks.md`).

## Formato

```
<type>(<scope>)!: <description>

<body>

<footers>
```

- **Idioma:** inglês, no texto todo (`CLAUDE.md`).
- **description:** modo imperativo, minúscula no início, sem ponto final.
- **`!`** e/ou o footer `BREAKING CHANGE: ...` quando quebra um contrato (ex.: o vocabulário de comandos, que é
  versionado pelo ADR-0002, ou o formato do log/snapshot do ADR-0004).
- **body:** opcional. Explica o **porquê** quando ele não é óbvio pelo diff.
- **footers:** os trailers de atribuição que o harness indicar.

### type

| type | Uso |
|---|---|
| `feat` | Comportamento novo do jogo, do servidor, do cliente ou da CLI |
| `fix` | Correção de bug |
| `refactor` | Mudança de código sem mudar comportamento |
| `perf` | Melhora de performance |
| `test` | Só testes |
| `docs` | Só documentação (GDD, ADR, spec, README, CLAUDE.md) |
| `build` | Dependências, `package.json`, tsconfig, Docker |
| `ci` | GitHub Actions |
| `style` | Só formatação |
| `chore` | Manutenção que não cabe acima (ex.: skills do harness em `.claude/`) |

### scope

Opcional. Lista fechada:

| scope | Onde |
|---|---|
| `sim` | `packages/sim` |
| `protocol` | `packages/protocol` |
| `server` | `apps/server` |
| `client` | `apps/client` |
| `cli` | `apps/cli` |
| `params` | `params/` |
| `infra` | `infra/` |
| `docs` | `docs/` |
| `repo` | Raiz do repositório: toolchain, configs, `.claude/`, `CLAUDE.md` |

- Omita o scope quando o commit é transversal a vários deles, ou quando ele só repetiria o type (`docs(docs)`).
- Precisa de um scope que não está na lista? **Pergunte ao dono** antes de inventar.

## Passo a passo

1. `git status` e `git diff`: entenda tudo o que mudou.
2. Agrupe as mudanças em unidades lógicas. Se houver mais de uma, faça mais de um commit.
3. Adicione os arquivos **pelo nome** (`git add <arquivos>`). Nada de `git add -A` ou `git add .` sem conferir.
4. `git diff --staged`: confira que só a unidade está staged.
5. Se o commit conclui uma task, rode antes os checks do `CLAUDE.md` e só siga com eles verdes.
6. Commit com a mensagem num heredoc (`git commit -F - <<'EOF' ... EOF`).
7. `git log --oneline -n 5` para confirmar.

Nunca use `--no-verify`, `--amend` em commit já publicado, nem `push`, sem o dono pedir.

## Exemplos

```
feat(sim): add seeded xoshiro128** rng with serializable state
build(repo): set up npm workspaces and pin node version
docs: approve M1 plan and decisions P1-P6
fix(server): release domination on websocket close
```
