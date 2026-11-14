---
name: implement-phase
description: Executa uma fase do tasks.md do geometrix (ex.: M1 F3), da abertura ao merge em main: levanta lacunas com o dono antes de codar, implementa task a task com testes e commits, fecha a fase com dashboard e merge, e reporta. Use ao começar ou retomar a implementação de uma fase.
---

# Implementar uma fase

Procedimento observado nas fases do M1 e do M1.5. Convenções de código: seção "Convenções do `sim`" do `CLAUDE.md`.
Commits e branches: skill `commit`.

Pedido de várias fases (ex.: "execute M1.5-fog", "F3 em diante"): uma fase por vez, cada uma com fechamento e
merge, até acabar ou até um checkpoint que precise do julgamento do dono (seção 4).

## 1. Abertura

1. Leia `docs/dashboard/current-status.md`: fase atual, o que ela precisa saber do código atual, pendências e
   interpretações a validar. Numa sessão nova, ele e o `CLAUDE.md` são todo o contexto: o que a fase anterior
   aprendeu tem de estar lá.
2. Leia a seção da fase no `tasks.md` e as seções do `plan.md` e da `spec.md` que ela cita ou de que depende
   (comportamento, parâmetros, pipeline). Leia o código que a fase vai estender.
3. Confira a branch: a que o `tasks.md` dá à fase (padrão `m<marco>/f<fase>-<slug>`). Se ainda não existir, crie a partir de `main`. Se já existir
   (pode ter commits de docs/harness entre fases), continue nela.

## 2. Lacunas antes de codar

Antes da primeira linha de código, liste o que a fase precisa e que **nem a spec nem o plan definem**:

- **Valores** (quantidades, distâncias, tempos, custos): proponha chutes e pergunte ao dono **numa única
  pergunta agrupada**, com os valores propostos visíveis (ex.: os valores do gerador de mapa no F1). Os aprovados
  entram em `params/default.json` como provisórios. Nunca como número no código.
- **Regras de gameplay** que mudam o que o jogador vê ou decide: pergunte (regra "Não invente gameplay").
- **Detalhes de implementação** que o plan deixa abertos e que não mudam decisões do jogador (ex.: qual célula
  dá o modificador de velocidade): siga com a interpretação mais literal ou mais simples, registre-a no dashboard
  em "Pendências" como "a validar no playtest" e cite-a no relatório final.
- Se precisar de um valor neutro para seguir (ex.: estoque inicial 0), use-o como parâmetro e marque como
  pendente de confirmação no dashboard.

## 3. Ciclo de cada task

1. Implemente no pacote certo (plan §1), seguindo as convenções do `CLAUDE.md`.
2. Testes junto com o código: comportamento pelo caminho real (`step`), casos de borda, e propriedade sobre
   muitas seeds quando a regra vale para qualquer mapa. Quando houver implementação de referência externa,
   compare com ela (ex.: os vetores do xoshiro128** em C).
3. Se o formato do `WorldState` mudou de propósito, atualize o hash fixo:
   `npx vitest run packages/sim/test/serialize.test.ts -u`, depois `npx prettier --write packages/sim`.
   Só esse teste leva `-u`; qualquer outra falha de snapshot é bug até prova em contrário.
4. `npm run check` verde.
5. Marque `[x]` no `tasks.md` e faça o commit (skill `commit`) com a task e o `[x]` juntos.

- **Ordem:** se uma task depende de outra listada depois (no F1, `createWorld` dependia do gerador de mapa),
  faça a dependência antes. Cada uma mantém o seu commit e o seu `[x]`.
- **Refatoração** que surgir (ex.: a terceira cópia de um helper de teste) vai num commit `refactor` separado.
- **Decisão do dono no meio da fase:** registre na spec/plan (e no GDD, via skill `gdd-decision`) num commit
  `docs` separado e tire o item das pendências do dashboard.
- **Decisão arquitetural** detectada: pare e use a skill `adr`.

## 4. Fechamento

1. Todas as tasks da fase `[x]`; o checkpoint da fase (se houver) cumprido. **Checkpoint que o dono julga**
   (critério reprovado, economia, decisão do plan adiada para o checkpoint): rode as medições, ponha os números e
   as perguntas numeradas no dashboard (commit `docs`), reporte e **pare antes do merge**. Com a resposta, registre
   a decisão no `tasks.md` (o `[x]` do checkpoint), no plan (seção de decisões) e no GDD se for gameplay (skill
   `gdd-decision`); então o fechamento segue.
2. Código em caminho quente (pathfinding, loop do tick): meça com um script no scratchpad e compare com o
   orçamento da spec §7 (3 dias de mundo em menos de 10 min). Cite o número no relatório. Para achar o custo:
   `node --cpu-prof --cpu-prof-dir=<scratchpad>/prof apps/cli/src/main.ts sim ...` e some o tempo por função do
   `.cpuprofile` (JSON) com um script.
3. Atualize `docs/dashboard/current-status.md`: fase concluída, próxima fase com o que ela precisa saber do
   código atual, pendências e interpretações novas. Commit `docs: update status dashboard for the end of F<n>`.
4. Merge em `main` (skill `commit`), depois `npm run check` em `main`.

## 5. Relatório ao dono

Curto, em PT-BR:
- **Entregue:** o que a fase faz agora, com números que provam (tempos, contagens de testes, medições).
- **Interpretações a validar:** as que você assumiu no passo 2.
- **Precisa do seu OK:** decisões pendentes, numeradas para resposta rápida.
- **Pontos de atenção:** fricções do workflow e avisos.
- **Próximo:** a fase seguinte e a branch.

## Pegadinhas já vistas

- `.git/index.lock` aparece de forma transitória (algo do lado Windows consultando o repo). Confira se ainda
  existe; se não, repita o comando. Nunca apague o lock sem verificar.
- O Vitest grava inline snapshots fora do padrão do Prettier: rode o Prettier depois de `-u`.
- O primeiro `lintText` do ESLint leva ~9 s no `/mnt/c`: testes que usam o ESLint aquecem num `beforeAll` com
  timeout longo.
- `parseArgs` do Node recusa `--opt -1` (ambíguo); use `--opt=-1`.
- **"Verde" é o código de saída do `npm run check`, não a saída filtrada.** Em `npm run check | grep ... && git
  commit`, quem decide o `&&` é o `grep`: um typecheck ou lint vermelho passa, porque o `grep` acha linhas. Rode
  `npm run check > <scratchpad>/check.log 2>&1; echo "exit $?"` e só commite com `exit 0`. Aconteceu no F4 (teste
  antigo sem os campos novos do `Creep` e um `no-useless-assignment` do lint). **Nem `; git commit` depois do
  check:** o `;` commita de qualquer jeito (fog F2). No mesmo comando, só com `rc=$?; [ $rc -eq 0 ] && git commit`.
- **Linha de base de outra revisão** (ex.: o hash e o tempo antes da fatia): `git worktree add --detach
  <scratchpad>/base <rev>`, `npm ci --prefer-offline --no-audit --no-fund` lá dentro (~1 min) e rode o `geo` nos
  dois, em sequência, duas vezes cada: o tempo no WSL varia ~±0,5 s em 10 s. No fim, `git worktree remove`.
- Teste de mundo bot × bot longo (6 h com produção) passa dos 5 s padrão do Vitest com a suíte inteira rodando:
  dê um timeout explícito (`test(..., 30_000)`).
- Mundo espelhado que diverge entre os times: ache o 1º tick com um script que compara as entidades do time 1
  espelhadas (`mirrorCell`) com as do time 0. Divergência de regra do jogo (ex.: desempate por id num depósito
  disputado) vai para o dono; de código, é bug.
