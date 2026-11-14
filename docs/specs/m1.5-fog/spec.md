# Spec M1.5 — Fog of war

**Status:** Aprovada (2026-11-14) · **Data:** 2026-11-14 · **Marco:** M1.5 — A névoa ([ROADMAP](../../ROADMAP.md)), fatia 2 de 2
**GDD relacionado:** [01](../../gdd/01-mundo.md) (Decidido, "Fog of war"), [02](../../gdd/02-creeps-e-dominio.md)
(visão por DNA), [07](../../gdd/07-piloto-automatico.md) (piloto pelo que o time sabe, ação "explorar") ·
**ADR:** [0006](../../adr/0006-sync-do-mundo.md) (`Accepted`) · **Fatia anterior:** [rede](../m1.5-rede/spec.md)

## 1. Hipótese

> Esconder informação cria decisões interessantes (explorar, proteger rotas) **sem tornar o mapa ilegível**
> (ROADMAP, M1.5).

Esta fatia muda o gameplay de propósito: cada time passa a ver só o que o Núcleo e os próprios creeps enxergam e a
lembrar o que já viu. Ela responde:
1. O jogador entende o que vê, o que lembra e o que não sabe? (playtest de legibilidade)
2. Sem nenhum depósito garantido à vista, o começo da partida funciona para os dois times, em qualquer seed?
3. A rede e o servidor continuam dentro dos alvos da fatia de rede com a visão filtrada e a memória?

## 2. O que o dono decidiu (GDD, 2026-11-14)

Resumo; a fonte é o GDD.

| Tema | Decisão |
|---|---|
| Quem dá visão | O Núcleo (raio 8) e cada creep, por DNA: círculo 6, triângulo 4, quadrado 3. Raio Manhattan. Provisórios |
| Mapa no início | Névoa negra: fora da visão, nada é conhecido (terreno, depósitos, Núcleo inimigo) |
| Do inimigo, na visão | Creeps (posição, DNA, carga), estradas e obras. Nunca estoque, produção, upgrades, regras ou ordem |
| Memória do time | Depósitos com o último valor visto; estradas e obras vistas; terreno explorado e Núcleo inimigo visto. Creeps inimigos somem fora da visão |
| Tela | Três estados: nunca visto (negro), lembrado (esmaecido, último valor), visível agora |
| Caminho | Pelo que o time sabe: célula nunca vista conta como jungle passável; recalcula ao descobrir pedra ou rio |
| Piloto automático | Condições e escolha de depósito usam só visão + memória; ação nova "explorar" (célula nunca vista mais próxima); nenhum depósito garantido à vista |

## 3. Decisões de escopo que esta spec assume

Aceitas pelo dono com a spec (2026-11-14). As marcadas com **(gameplay)** completam o GDD e já estão nele (01 e
07). Em D1 o dono escolheu a linha de visão, no lugar da proposta original (sem bloqueio).

| # | Decisão | Padrão proposto | Por quê |
|---|---|---|---|
| D1 | Linha de visão **(gameplay)** | **Pedras bloqueiam.** Visível = célula a até `r` (Manhattan) do Núcleo ou de um creep do time, sem pedra entre os dois; a pedra em si é vista. Rio e vaus não bloqueiam. O algoritmo da linha (só inteiros, equivalente para os dois times no mapa espelhado) fica para o plan | Escolha do dono: as pedras viram cobertura, o que serve à emboscada do M2. Custa regra e CPU a mais |
| D2 | Quando a visão é medida | No fim de cada tick, depois do movimento e da economia. A memória é atualizada nesse momento, e o piloto do tick seguinte decide por ela | Uma única leitura por tick, a mesma para a rede, o bot e o piloto |
| D3 | Como os creeps começam explorando **(gameplay)** | As duas coisas: (a) o preset coletor ganha a regra "explorar" logo depois de "coletar", e só vale quando o time não conhece depósito com o recurso; (b) um preset novo **batedor** (só explorar; quando não há mais nada a explorar, para no Núcleo) | Pergunta aberta do GDD 07. (a) faz o início funcionar sozinho, inclusive offline; (b) dá ao jogador o papel explícito, que o círculo (raio 6) pede |
| D4 | Alvo de "explorar" **(gameplay)** | A célula nunca vista mais próxima do creep **em passos no mapa conhecido** (célula nunca vista conta como passável; ajustado pelo plan, N4, no lugar de Manhattan) que nenhum outro creep do time já tenha como alvo de exploração; desempate pelo menor índice **no referencial do time** (como os caminhos, `isRotatedSide`) | Sem a exclusão, os 6 creeps iniciais andam em bando para a mesma célula. O referencial do time mantém os dois lados equivalentes no mapa espelhado |
| D5 | Estradas no escuro | `buildRoad` segue a regra do caminho: o traçado é calculado pelo que o time sabe (estradas conhecidas e terreno explorado); um segmento que se revela pedra ou rio faz o traçado ser recalculado | "Nenhuma ordem revela terreno escondido" (GDD 01) |
| D6 | Comandos sobre o desconhecido | `moveTo` e `buildRoad` para célula nunca vista são aceitos. Comando que cita um depósito ou creep que o time não conhece é recusado **com a mesma recusa** de um id inexistente | Aceitar ou recusar não pode revelar nada |
| D7 | O inimigo na visão | Por creep inimigo: `id`, `team`, `dna`, `x`, `y`, `cargo`. Do time inimigo: só o `id` e, depois de visto, a posição do Núcleo. Obras inimigas inteiras (posição, time e tempo restante) | GDD 01; a ordem, as regras, o domínio e a atividade ficam de fora |
| D8 | Elenco do inimigo | A lista de jogadores (nome, time, bot ou não) continua visível para todos, como no lobby; quem domina qual creep inimigo, não | Já é pública no lobby e na lista de mundos |
| D9 | Seed escondida | Enquanto o mundo não acaba, a seed (e a `mapSeed`) não sai do servidor para os jogadores: some da lista de mundos e do `welcome` | Com a seed e os params, o cliente (que embute o `sim`) regera o mapa inteiro e anula a névoa negra |
| D10 | Replay | O export de replay (`GET /api/worlds/:id/replay`) passa a valer só para mundos encerrados (pendente da fatia de rede). O replay continua mostrando o estado inteiro, dos dois times | Durante o mundo, o log revela tudo; depois, a visão completa é o que se quer rever |
| D11 | Ids | Os ids continuam globais (um contador para tudo); um time vê o id do creep inimigo, o que deixa adivinhar quantas entidades já existem | Trocar os ids por time é custo sem ganho no M1.5; vazamento aceito |
| D12 | O que muda de propósito | `SIM_VERSION` 3, versão do protocolo nova, e os hashes fixos (3 dias do seed 42; 6 h do `bot-world.test.ts`) mudam | Gameplay novo; snapshots e replays antigos ficam inválidos (ADR-0004) |

## 4. Escopo

### Dentro
- **`sim`:** visão por raio com linha de visão (D1, D2); memória do time no `WorldState`; a visão do time filtrada (inimigo, memória,
  terreno explorado); caminho e estradas pelo que o time sabe (D5); piloto automático pelo que o time sabe; ação
  "explorar" (D4) e os presets (D3); recusas que não vazam (D6); parâmetros de raio.
- **Estrategista dos bots:** decide só pela visão, que agora inclui o terreno explorado (sem o mapa estático
  completo), e usa os presets com exploração.
- **Protocolo:** o `welcome` deixa de levar o terreno inteiro e a seed (D9); o terreno explorado entra na visão e no
  delta.
- **Servidor:** seed escondida da lista de mundos (D9); replay só de mundo encerrado (D10).
- **Cliente:** os três estados na tela; o inimigo só como a visão mostra (D7); nada de dados do time inimigo nos
  painéis; custo de estrada e traçado sob o cursor só pelo que o time sabe; o preset batedor no painel de regras.
- **Harness:** métricas de exploração e de início de partida (seção 7); `geo net` e `npm run soak` de novo.
- **Playtest de legibilidade:** perguntas de névoa no [PLAYTEST.md](../../PLAYTEST.md).

### Fora
Estruturas ou estradas que dão visão; visão no replay por time; minimapa; idade da memória
na tela ("visto há X min"); depósito garantido à vista; mudar a velocidade ou a capacidade dos DNAs; batalha,
emboscada e morte (M2); deploy (M2).

## 5. Comportamento

Formato: *Quando [gatilho], o sistema deve [resposta].*

### Visão e memória (`sim`)
- **V-1** No fim de cada tick, uma célula deve estar **visível** para o time quando está a até o raio do Núcleo
  (8) do Núcleo dele ou a até o raio do DNA de algum creep dele (Manhattan), sem pedra no meio da linha entre os
  dois (D1). Uma célula de pedra é vista, mas esconde o que está atrás. Raios nos params.
- **V-2** Quando uma célula fica visível, o time deve passar a conhecer o terreno dela para sempre (explorada).
- **V-3** Quando um depósito está numa célula visível, a memória do time deve guardar o depósito com a quantidade
  atual. Fora da visão, a memória mantém o último valor visto.
- **V-4** Quando uma célula com estrada fica visível, a memória deve guardar a estrada. Estradas nunca somem.
- **V-5** Quando uma célula visível tem uma obra, a memória deve guardá-la como está; quando uma célula visível
  não tem mais a obra lembrada, a memória deve esquecê-la.
- **V-6** Quando o Núcleo inimigo fica visível, a memória deve guardar a posição dele para sempre.
- **V-7** Os creeps, as estradas, as obras e o Núcleo do próprio time devem estar sempre na visão dele.
- **V-8** Um creep inimigo deve aparecer na visão só enquanto está numa célula visível, e só com os campos de D7.
- **V-9** A visão deve continuar sendo uma função pura do estado e do time (spec da rede, V-1); tudo o que ela
  mostra do que não está visível vem da memória do time, que faz parte do estado.

### Caminho, estradas e comandos (`sim`)
- **P-1** Quando um creep calcula um caminho, células nunca vistas pelo time devem contar como jungle passável, e
  estradas, como as que o time conhece.
- **P-2** Quando a próxima célula do caminho se revela intransitável (pedra ou rio sem vau), o creep deve
  recalcular o caminho no mesmo tick, com o que o time sabe agora.
- **P-3** `buildRoad` deve traçar e escolher o próximo segmento pelo que o time sabe (D5).
- **P-4** Um comando que cita um depósito ou um creep que o time não conhece deve ser recusado com a recusa de id
  inexistente (D6). `moveTo` e `buildRoad` para célula nunca vista devem ser aceitos.

### Piloto automático (`sim`)
- **A-1** A condição `resourceInRange` e a escolha do depósito de `gather` devem considerar só os depósitos da
  memória do time, com a quantidade lembrada.
- **A-2** Quando o creep chega ao depósito escolhido e o vê vazio (e sem regeneração, no caso do cristal), a
  memória se corrige e a regra decide de novo no tick seguinte, como hoje.
- **A-3** A ação **explorar** deve virar a ordem de ir à célula de D4; ela é impossível quando não sobra célula
  nunca vista alcançável.
- **A-4** O preset coletor deve ser `entregar se cheio → coletar → explorar (só sem depósito conhecido do recurso)
  → entregar o resto`; o preset **batedor**, `explorar → voltar ao Núcleo` (D3).
- **A-5** Os creeps continuam nascendo com o preset coletor de matéria.

### Bots
- **B-1** O estrategista deve decidir só pela visão do time (sem o mapa estático completo) e emitir os mesmos
  comandos de um humano.
- **B-2** Um mundo bot × bot de 3 dias deve chegar ao fim sem erros, com os dois times entregando matéria.

### Rede e servidor
- **N-1** O `welcome` não deve levar o terreno inteiro, nem a seed (D9); só as dimensões do mapa, os params e a
  visão do time, que traz o terreno explorado.
- **N-2** O delta deve levar as células exploradas novas, com o terreno.
- **N-3** O teste de propriedade da fatia de rede (`patch(anterior, diff) = nova`, todo tick, os dois times) deve
  continuar verde com o fog.
- **N-4** A lista de mundos não deve mostrar a seed de mundo em andamento; o replay de mundo em andamento deve ser
  recusado (D10).

### Cliente
- **C-1** O mapa deve mostrar os três estados: nunca visto em negro, lembrado esmaecido (com o último valor) e
  visível normal.
- **C-2** Nenhum painel deve mostrar estoque, produção, upgrades, regras ou ordem do time inimigo.
- **C-3** Custo de estrada e traçado sob o cursor devem usar só o que o time sabe; sobre célula nunca vista, o
  cursor não mostra terreno.
- **C-4** O painel de regras deve oferecer o preset batedor e a ação explorar.
- **C-5** O replay (mundo encerrado) continua mostrando o estado inteiro.

## 6. Parâmetros iniciais (chutes, para serem quebrados)

Balanceamento, nos params do `sim` (`schema`, `default.json` e `test/params.json`):

| Parâmetro | Chute |
|---|---|
| Raio de visão do Núcleo | 8 |
| Raio de visão do círculo / triângulo / quadrado | 6 / 4 / 3 |

## 7. Harness e critérios de aceite

Os alvos são chutes provisórios. Quando um reprovar, o dono decide no checkpoint (por exemplo, voltar à opção
"depósito garantido à vista" do GDD 01).

| Critério | Alvo | Como se mede |
|---|---|---|
| Início de partida | Em todas as seeds de 1 a 20, os dois times entregam a 1ª matéria em até 30 min de mundo | Harness: bot × bot de 6 h por seed; tempo até a 1ª entrega por time |
| Equivalência entre os times | Diferença de tempo até a 1ª entrega e de matéria entregue em 6 h entre os times, por seed, no relatório | Mesma execução |
| Economia | Matéria e cristal entregues em 3 dias (seed 42) no relatório, lado a lado com o hash anterior ao fog (`10662729…`) | `geo sim`; o dono julga no checkpoint |
| Exploração | % do mapa explorado por time ao longo do mundo, no relatório | Mesma execução |
| Determinismo | 2 execuções e snapshot → restore dão o mesmo hash, com o fog | `geo verify` no CI |
| Correção do diff | Teste de propriedade verde (N-3) | CI, seeds 1, 42, 649 |
| Banda e CPU | Os alvos da [spec da rede §7](../m1.5-rede/spec.md) (≤ 2 KB/s por cliente; visão + diff ≤ 0,25 ms por mundo por envio, mediana) | `geo net --seed 42 --days 3` |
| Custo do tick | O tick com fog custa no máximo o dobro do tick sem fog | Harness, tempo médio por tick no mundo de 3 dias |
| Sem divergência | 0 hashes divergentes; visão final de cada cliente igual à do servidor | `npm run soak` |
| Linha de visão | Mapas de teste em texto: o que fica atrás de uma pedra não é visto; a pedra é; rio não bloqueia; o resultado é o mesmo para os dois times em posições espelhadas | Teste do `sim` |
| Nada vaza | A visão de um time não tem nenhum campo de D7 a mais nem entidade fora da visão ou da memória | Teste do `sim` com um mundo montado à mão |

**Métricas novas no relatório do harness:** tempo até a 1ª entrega de cada recurso, por time; % do mapa explorado
por time ao longo do tempo; tempo até ver o Núcleo inimigo; creeps em "explorar" ao longo do tempo.

## 8. Protocolo de teste

1. **Testes** (`sim`, `protocol`, `server`, `client`): visão por raio e linha de visão, memória, caminho e estrada no escuro,
   explorar e os presets, recusas sem vazamento, filtro do inimigo, `welcome` sem terreno e sem seed, replay
   recusado em mundo vivo.
2. **Harness:** seeds 1 a 20 (6 h) e o mundo de 3 dias do seed 42, com as métricas da seção 7; `geo net`.
3. **Soak:** `npm run soak` completo.
4. **Sessão do dono (legibilidade):** `npm run dev:multi -- --clients 3` com os dois times, com as perguntas de
   névoa do [PLAYTEST.md](../../PLAYTEST.md) (ex.: "onde está o inimigo agora?", "o que é a área esmaecida?", "por
   que esse creep foi para lá?"). Se possível, uma pessoa que nunca viu o jogo.

### Critério para fechar o M1.5
- Critérios da seção 7 verdes, ou o dono decide o que fazer com o que reprovou.
- O dono responde à hipótese no checkpoint da sessão de legibilidade.

## 9. Pré-requisitos antes do `plan.md`

- Aceite do dono nas decisões D1–D12 ✅ (2026-11-14); as de gameplay (D1, D3, D4) já estão no GDD.
- Nenhum ADR novo previsto: o fog é a visão por time que o [ADR-0006](../../adr/0006-sync-do-mundo.md) já supõe,
  e o ADR não fixa o mapa no `welcome` (isso era do plan da rede). Se o plan mudar uma regra do ADR, vira emenda
  (skill `adr`).

## 10. Perguntas abertas

Nenhuma no momento.
