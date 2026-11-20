# 08 — Crônica, chat e console

## Decidido
- **Rodada de design do M2** (dono, 2026-11-15; registro no
  [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §2):
  - **Crônica:** os diálogos dos encontros ([06](06-batalhas.md)) e os eventos do jogo aparecem como texto na
    partida, para jogadores e bots. O diálogo com uma tribo só aparece para o time que interagiu com ela
    ([05](05-tribos-e-diplomacia.md)).
  - **Chat livre** entre humanos, no M2.
  - **Linha de comando no chat**, no estilo do BYOND (em que o chat global se digitava como `OOC:"texto"` e um verbo
    invocava um comando sem interface): o campo do chat também aceita os comandos do vocabulário que já existe
    ([ADR-0002](../adr/0002-tudo-e-comando.md)) e outros complementares. Tira peso do painel lateral, que cresce a
    cada sistema (e o HP, os stats e o level ainda nem entraram).
  - **Macros de cliente** no M2: sequências de verbos num atalho, com **rate limit**. Os scripts personalizados no
    servidor ficam para o M4 ([07](07-piloto-automatico.md)).
  - **Sem LLM** para gerar o texto em tempo de execução.
- **Spec do M2, fatia A, o encontro** (dono, 2026-11-15; [spec M2 do encontro](../specs/m2-encontro/spec.md) D16, D17):
  - **O texto não mora no `sim`:** o `sim` emite eventos estruturados (quem, o quê, quanto) e o cliente os narra
    por modelos de frase em PT-BR, com a variante escolhida pelo próprio evento. Todos leem a mesma frase e o texto
    muda sem trocar o `SIM_VERSION`. Os bots leem o evento, não o texto.
  - **Voz pelo DNA no M2** (pelo temperamento, no M2.5).
  - Entram na crônica da fatia A: os encontros (com a declaração do agressor), as fugas, as lutas, as mortes, os
    saques e os nascimentos. Um time vê o evento em que um creep dele participa ou que acontece na visão dele.
  - **O agente escreve o banco inicial de frases e o dono revisa o tom.**
- **Fim do mundo** (dono, 2026-11-15; registro no
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §0): a crônica conta o apocalipse durante
  a partida e o final ([01](01-mundo.md)), com **humor** na vitória pírrica; e **a invasão tem crônica**, para que
  o mundo invadido saiba quem chegou e por quê.
- **Títulos na crônica** (dono, 2026-11-20, na rodada do [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md); tema "Os personagens"): quests,
  batalhas e a crônica de cada creep dão títulos, de início só simbólicos ("O Rei Batedor, Fulano"):
  **conquistados** (permanentes, por um feito único) e **disputados** (do melhor do mundo num feito agora; a crônica
  conta a troca). Os laços entre creeps também aparecem só na ficha e na crônica, por ora ([02](02-creeps-e-dominio.md)).

## Proposta
- **Um verbo, um comando** (agente): cada verbo do console vira um comando do mesmo vocabulário versionado, com as
  mesmas validações e recusas de quem clica. Nenhum verbo tem mais poder do que a interface.
- **LLM na autoria** (agente): gerar e revisar o banco de modelos offline, fora do jogo.
- **A crônica do fim do mundo: como fazer** (agente;
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §4.4, §4.5 e §4.7): uma voz de
  **narrador do mundo**, diferente da voz dos creeps, que conta as viradas de ato, os focos novos de corrupção, o
  ponto sem volta se aproximando (sem dar o número), a vitória e o epílogo (ex.: "O Azul venceu a guerra.
  Sobreviventes para contar a história: nenhum."). Cabe no ADR-0007 sem mudança: eventos com o público "todos os
  times" e modelos no cliente. O agente escreve as frases; o dono revisa o tom.
- **A crônica da invasão: o enredo** (agente): quando um mundo está morrendo, a fronteira com os outros afina e as
  fendas se abrem no ato 3. O invasor chega apresentado pela ficha da lenda (nome, DNA, mundo de origem, feitos),
  com o alvo declarado; a morte dele fica na crônica dos dois mundos.
- **Kits de crônica dos traits** (ideia do dono, 2026-11-20, não aprovada;
  [brainstorm do recrutamento, dos laços e dos traits](../brainstorm/2026-11-20-recrutamento-lacos-traits.md) §3):
  cada trait traz uma origem e um modelo de side-quest; a crônica também lê a fama e os laços dos creeps. Mesmo
  formato do ADR-0007: o `sim` guarda os ids e os parâmetros resolvidos, e o texto fica nos modelos do cliente.
- **O replay para mostrar aos amigos** (agente): marcadores dos eventos principais na linha do tempo (M2, fatia E),
  e depois uma velocidade que acelera nos trechos parados e desacelera nos eventos; tudo sai da lista de eventos.

## Perguntas abertas
- Que canais existem: time, global (o `OOC` do BYOND), sussurro? O que um bot "lê" no chat?
- Sintaxe dos verbos: `say`, `ooc`, `/comando`? Nomes em português, em inglês ou os dois?
- O rate limit: quantas mensagens e quantos comandos por janela? É igual para macro e para digitação?
- Onde as macros ficam guardadas: só no navegador, ou no servidor, por jogador?
- Com três ou mais lados num encontro, quem vê a crônica dele? Mostrar para todos revela a posição e a carga de
  creeps sob o fog.
- No deploy, o chat livre precisa de moderação (denúncia, silenciar, filtro)?
