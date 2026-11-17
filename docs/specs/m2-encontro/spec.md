# Spec M2 — O encontro

**Status:** Aprovada (2026-11-15) · **Data:** 2026-11-15 · **Marco:** M2 — A emboscada ([ROADMAP](../../ROADMAP.md)), fatia A de 5
**GDD relacionado:** [01](../../gdd/01-mundo.md) (o inimigo na visão), [02](../../gdd/02-creeps-e-dominio.md)
(HP, morte, nome), [03](../../gdd/03-economia-e-logistica.md) (extorsão, saque, despojo),
[06](../../gdd/06-batalhas.md) (encontro, salvo-conduto, fuga, sorteio descartável),
[07](../../gdd/07-piloto-automatico.md) (posturas), [08](../../gdd/08-cronica-chat-e-console.md) (crônica) ·
**Brainstorm:** [2026-11-15](../../brainstorm/2026-11-15-m2-m3.md) §2, §5 · **ADR:** [0007](../../adr/0007-eventos-do-sim.md) (eventos do
`sim`, `Accepted`)

## 1. Hipótese

> A batalha muda o rumo do mundo sem dominar o jogo? (ROADMAP, M2)

Esta fatia responde à parte do mundo, **antes de existir combate**: a luta ainda se resolve por um sorteio
descartável (GDD 06). Ela pergunta:

1. **O encontro cria conflito e história?** Abordar, extorquir, pagar, recusar e fugir são decisões que o jogador
   sente e entende pela crônica, sem olhar o estado.
2. **O encontro muda o que o jogador faz?** Rotas, escolta, que DNA carrega o cristal, as posturas do piloto.
   Esse é o sinal de "muda o rumo do mundo".
3. **Sem dominar o jogo:** num mundo bot × bot, os encontros acontecem com uma frequência que importa, e nenhum
   time desmorona por bola de neve.
4. A rede, o servidor e o determinismo continuam dentro dos alvos do M1.5, agora com morte, HP e eventos.

Esta é a primeira fatia de cinco (ROADMAP, "Fatias do M2"). Depois dela vêm o laboratório de batalha (B), o chat,
console e macros (C), a junção (D, com os errantes) e o cerco e o reparo (E).

## 2. O que o dono já decidiu (GDD, 2026-11-15)

Resumo; a fonte é o GDD. Inclui as decisões desta spec (§3), já registradas no GDD.

| Tema | Decisão |
|---|---|
| Encontro | Abordagem com diálogo. O agressor escolhe **atacar** ou **extorquir** na ordem de abordar e persegue o alvo. No ataque, ele declara a agressão e a vítima luta ou tenta fugir; na extorsão, a vítima **paga**, **recusa** (luta) ou **foge** |
| A luta até a junção | Um **sorteio descartável**, que ninguém balanceia. Cada regra de combate futura terá a própria mecânica de fuga |
| Quem vence | Level, stats, skills e micro, não o DNA ou a carga sozinhos. No M2, só stats base por DNA |
| Salvo-conduto | Depois de pagar: imune só a novas abordagens do time que extorquiu, por um tempo ou até a zona do próprio Núcleo; perde a proteção se abordar alguém. O mesmo agressor não extorque o mesmo creep de novo por um tempo |
| Fuga | Fugir não é fácil: a chance sai da velocidade relativa (DNA, carga, terreno). Quem escapa larga de 50% a 100% da bolsa num despojo e corre |
| Saque e despojo | Sem fuga, o vencedor fica com a carga dos mortos; o que não cabe vira **despojo**, uma pilha que qualquer creep cata |
| HP | Persiste no mundo e regenera devagar, mais rápido perto do Núcleo |
| Morte | Permanente; o domínio do creep morto termina |
| Crônica | Os diálogos e os eventos aparecem como texto na partida, para jogadores e bots. Sem LLM |

## 3. Decisões de escopo que esta spec assume

**Aceitas pelo dono na rodada interativa de 2026-11-15**, com a spec. As marcadas com
**(gameplay)** completam o GDD e já estão nele. Os números estão na §6 e são chutes.

| # | Decisão | Padrão | Por quê |
|---|---|---|---|
| D1 | Nome no estado **(gameplay)** | O creep ganha o nome ao nascer, no `sim`, da lista de 179 palavras que hoje está no cliente, pela mesma regra (ordem de nascimento, nascimentos seguidos com nomes distantes, sufixo "II" quando a lista acaba). **Sem comando de renomear** nesta fatia | GDD 02 pede o nome no estado no M2: com a morte, o nome gerado pela ordem trocaria. A crônica precisa de nomes estáveis. Renomear entra quando o creep tiver identidade de jogo (M2.5) |
| D2 | Stats base: só o HP **(gameplay)** | Cada DNA ganha `hp` máximo e um **peso de luta** nos params (D7). Dano, alcance e velocidade de batalha ficam para o laboratório (B), onde fazem diferença | O sorteio não usa dano nem alcance; pôr esses números agora seria balancear algo que ninguém usa |
| D3 | Regeneração do HP **(gameplay)** | Em ‰ do HP máximo por minuto de mundo, igual para os três DNAs: devagar no mapa, mais rápido a até um raio do próprio Núcleo. Não regenera durante um encontro ou uma luta | GDD 02 ("mais rápido perto do Núcleo"). Em ‰, um DNA não sara mais rápido que o outro só por ter menos HP |
| D4 | Morte e domínio **(gameplay)** | Com HP 0, o creep sai do estado; a carga vira saque ou despojo (D11). Se estava dominado, **o domínio termina**, como um `release`, sem cooldown | Responde à pergunta aberta do GDD 02 |
| D5 | Abordar **(gameplay)** | Ordem nova `approach`, com a intenção já escolhida (**atacar** ou **extorquir**): o creep entra no modo de perseguição e anda até um creep inimigo que o time vê, recalculando o caminho quando o alvo muda de célula. O encontro abre quando os dois ficam a até o raio do encontro (Manhattan). Se o alvo sai da visão do time, a ordem termina | Dono: a intenção vai na ordem, e a ordem faz o creep perseguir o alvo. Funciona igual para o humano e para o piloto |
| D6 | O diálogo e a janela **(gameplay)** | Só **1 × 1** nesta fatia. Um creep só está num encontro ou numa luta por vez, e não pode ser abordado nesse meio. **Mesmo o ataque abre com um diálogo:** o agressor declara a agressão e a vítima reage (luta ou tenta fugir). Na extorsão, a vítima paga, recusa ou tenta fugir. **O creep livre reage na hora**, pelas regras do piloto (D13); **o dominado** tem uma janela em segundos de mundo para o jogador responder, e sem resposta valem as regras dele. Os dois ficam parados durante a janela | Dono: o ataque também confirma a agressão num diálogo antes da luta. Mais de dois lados e a entrada no meio da luta são da junção (D). Num playtest comprimido, a janela dura pouco: as sessões de encontro rodam a ×6 (§8) |
| D7 | O sorteio descartável **(gameplay, provisório)** | A luta é uma série de rodadas, uma a cada N segundos de mundo, com os dois parados. Em cada rodada, o `state.rng` escolhe quem acerta, com a chance de cada um **proporcional a (HP atual ÷ HP máximo) × peso do DNA** (params; começa igual para os três). O golpe tira uma fração fixa do HP **máximo** de quem é atingido. A luta termina quando um dos dois morre ou foge (D10) | Dono: o acerto relativo ao DNA, aos stats e ao HP. Nesta fatia o único stat é o HP; o peso do DNA fica pronto para ajustar sem mudar código. Quem já entra ferido perde mais: o HP persistente pesa. O laboratório (B) e a junção (D) substituem o sorteio |
| D8 | Extorsão **(gameplay)** | A exigência é a **carga da vítima até a capacidade livre do agressor**, cristal primeiro. Não dá para extorquir quem está vazio nem estando cheio. Pagar passa a exigência da carga da vítima para a do agressor | Dá a "quantidade relativa ao DNA" sem número novo: o quadrado extorque muito e é lento; o círculo extorque pouco e alcança. Cristal primeiro porque é o que vale emboscar (GDD 03) |
| D9 | Salvo-conduto **(gameplay)** | Imune a abordagens do time que extorquiu, por um tempo ou **até entrar na zona do próprio Núcleo** (um raio). Perde a proteção ao abordar alguém. O par agressor–vítima não repete a extorsão por um tempo maior | Dono, no lugar de "até a própria rede de estradas": a estrada pronta é neutra e não guarda quem a construiu |
| D10 | Fuga **(gameplay, provisório)** | Vale nos três momentos: na resposta ao ataque, na resposta à extorsão e no meio da luta. A **chance de escapar** é `v_fugitivo ÷ (v_fugitivo + v_oponente)`, com a velocidade que o `sim` já calcula para cada um na célula atual e com a carga atual (DNA, carregado, vau, estrada). **Falhou:** não larga nada e a luta começa, ou segue. **Escapou:** larga uma fração sorteada pelo `state.rng`, por recurso, entre um mínimo e 100% da carga, num despojo na própria célula, e corre para o Núcleo com um bônus de velocidade por um tempo. Em fuga, pode ser abordada para atacar, mas não extorquida; se o agressor a alcança, o encontro abre direto na luta | Dono: dentro do combate, fugir não deve ser fácil (um quadrado carregado até o talo, sozinho, longe de estrada ou cruzando o vau quase nunca escapa), e nem toda fuga perde 100% da bolsa, sem pegar leve com quem foge. Esta é a fuga do sorteio; cada regra de combate futura terá a sua |
| D11 | Saque e despojo **(gameplay)** | O vencedor recolhe a carga do morto até a capacidade livre, cristal primeiro; o resto vira despojo na célula do morto. Despojos na mesma célula se somam. O despojo **não expira** nesta fatia. Ordem nova `pickup` e ação "catar despojo": cata na hora, até a capacidade livre. O despojo entra na visão e na memória do time como um depósito (último valor visto) | GDD 03. Expirar seria um sumidouro, mas é uma regra nova; fica para a rodada de balanceamento, se o mapa encher de despojo |
| D12 | Encontro mútuo **(gameplay)** | Quando os dois se abordam no mesmo tick, escolhe primeiro quem **não está no rio nem num vau** e, depois, quem tem **menos carga relativa** (carga ÷ capacidade); o que empatar, pelo `state.rng`. Nunca pelo id | Ideia do dono. O id quebra o espelho entre os times (F6 do fog) |
| D13 | Posturas no piloto **(gameplay)** | Vocabulário novo. Condição **inimigo à vista** (raio, DNA, carga mínima). Ações **abordar** (atacar ou extorquir o inimigo à vista mais próximo que passa no filtro) e **catar despojo**. **Regras de reação**, avaliadas só no encontro e na luta: condições **exigência até X‰ da carga** e **HP abaixo de X‰**; ações **pagar**, **lutar** e **fugir**. Sem regra de reação que valha: **paga** a extorsão, **tenta fugir** do ataque e, **no meio da luta, continua lutando** | Proposta "posturas de encontro" do GDD 07. Quase todo encontro acontece sem humano olhando (pilar 4). Os padrões preservam o creep de quem não configurou nada |
| D14 | Presets **(gameplay)** | Os coletores usam os padrões de D13. Preset novo, **salteador**: extorquir um inimigo carregado à vista → catar despojo à vista → entregar se cheio → explorar; luta quando é atacado; foge com o HP abaixo de um limite | O jogador precisa de um jeito de um clique para começar a emboscar, como o batedor deu para explorar |
| D15 | Bots | O estrategista põe uma fração dos creeps como salteadores (§6) | Sem bot que aborde, a sessão solo do dono continua sem conflito |
| D16 | Eventos do `sim` | O `step` passa a emitir **eventos estruturados** (quem, o quê, quanto), fora do estado e do hash. O replay e a recuperação os recalculam, como fazem com o resto. É um contrato novo: o ADR-0007 | O `sim` não emite eventos hoje, e a crônica precisa deles. Fora do estado, o snapshot não cresce |
| D17 | Crônica **(gameplay)** | O cliente narra os eventos com modelos de frase em PT-BR, com a **voz pelo DNA** e a variante escolhida por um número do próprio evento (todos leem a mesma frase). Entram os encontros (com a declaração do agressor), as fugas, as lutas, as mortes, os saques e os nascimentos. Um time vê o evento em que um creep dele participa ou que acontece na visão dele. O texto fica fora do `sim`. **O agente escreve o banco inicial e o dono revisa o tom no checkpoint** | GDD 08. O texto muda sem mudar o `SIM_VERSION` |
| D18 | O inimigo na visão **(gameplay)** | O creep inimigo à vista passa a mostrar também o **nome**, o **HP** e se está num encontro ou numa luta | Ferido, ele vira alvo (GDD 02), e o jogador precisa ver isso para escolher a vítima |
| D19 | Comandos sobre o desconhecido | Abordar um creep que o time não vê, ou catar um despojo que ele não conhece, é recusado com a recusa de id inexistente | A regra D6 da spec do fog |
| D20 | O que muda de propósito | `SIM_VERSION` 6, `PROTOCOL_VERSION` 4, vocabulário de comandos novo (`BREAKING CHANGE`), e os hashes fixos (3 dias do seed 42, 6 h do `bot-world.test.ts`) mudam | Gameplay novo: snapshots e replays antigos ficam inválidos (ADR-0004) |
| D21 | Sem zona segura **(gameplay)** | Nesta fatia, ninguém está a salvo perto do Núcleo. O harness mede se os bots acampam na saída do Núcleo inimigo | Dono: sem zona segura, mas com previsão para os acampamentos e as estruturas neutras (ideia do dono no GDD 01, a decidir no momento adequado) |

## 4. Escopo

### Dentro
- **`sim`:** nome ao nascer (D1); HP, regeneração e morte (D2–D4); a ordem `approach`, a perseguição, o encontro,
  o diálogo, a janela e as reações (D5, D6, D8); o sorteio (D7); a fuga (D10); salvo-conduto e o bloqueio do par
  (D9); despojo, `pickup` e saque (D11); o encontro mútuo (D12); o vocabulário do piloto e os presets (D13, D14); os
  eventos (D16); a visão com os campos novos e os despojos na memória (D11, D18); recusas sem vazamento (D19); os
  params.
- **Estrategista dos bots:** os salteadores (D15).
- **Protocolo:** os comandos novos (abordar, reagir ao encontro, fugir da luta, catar); os eventos do time no
  delta; o `welcome` com as entradas recentes da crônica.
- **Servidor:** manda a cada time os eventos que ele vê; guarda a crônica para que um cliente que reconecta, ou
  um servidor que reinicia, não a perca (§5, N-2).
- **Cliente:** barra de HP; nome vindo do estado; despojo no mapa; marca de perseguição, de encontro e de luta
  entre os dois creeps; painel da crônica; painel de reação para o creep dominado (lutar ou fugir no ataque;
  pagar, recusar ou fugir na extorsão; com o tempo restante); botão de fugir no meio da luta; clique direito num
  inimigo com a escolha atacar ou extorquir; inspetor com HP, salvo-conduto e estado do encontro; o editor de regras
  com as condições, ações e o preset novos; o replay com a crônica.
- **Conteúdo:** o banco inicial de frases da crônica (D17).
- **Harness:** as métricas novas (§7); `geo net` e `npm run soak` de novo.
- **Playtest:** perguntas de encontro no [PLAYTEST.md](../../PLAYTEST.md).

### Fora
Combate real e a instância de batalha (fatias B e D); mais de dois lados, grupos e entrada no meio da luta (D);
errantes e a facção neutra (D); HP de construções, cerco, reparo e vitória (E); acampamentos, torres e terreno de
batalha pelo entorno (ideia do dono, sem marco); chat livre, console e macros (C); a 3ª ação por DNA,
temperamentos, level, XP e skills (M2.5); renomear creep; despojo que expira; zona segura (D21); escambo entre
times; carga que freia em proporção ao peso (o freio de carregado continua o do M1); o esgotamento e o papel do
cristal, que esta fatia **mede** mas não decide (§7); deploy.

## 5. Comportamento

Formato: *Quando [gatilho], o sistema deve [resposta].*

### Identidade, HP e morte (`sim`)
- **H-1** Quando um creep nasce (no `createWorld` ou na produção), ele deve receber um nome pela regra de D1 e HP
  igual ao máximo do DNA.
- **H-2** A cada tick, um creep fora de encontro e de luta deve recuperar HP pela regra de D3, sem passar do
  máximo. A zona do Núcleo é um raio Manhattan a partir do Núcleo do time.
- **H-3** Quando o HP de um creep chega a 0, ele deve sair do estado no mesmo tick, com a carga tratada por D11 e o
  domínio encerrado (D4). O id nunca é reaproveitado.

### Abordagem e diálogo (`sim`)
- **E-1** A ordem `approach` (do jogador que domina ou do piloto) deve ser aceita só para um creep inimigo que o
  time vê agora, com intenção `attack` ou `extort`. Fora disso, é recusada pela regra de D19.
- **E-2** Enquanto o alvo continua à vista, o creep deve persegui-lo, recalculando o caminho quando o alvo muda de
  célula. Quando o alvo sai da visão, a ordem deve terminar.
- **E-3** Quando o agressor e o alvo estão a até o raio do encontro, o alvo está livre (sem encontro nem luta) e
  não tem salvo-conduto contra o time do agressor, o encontro deve abrir: os dois param e sai o evento da
  declaração.
- **E-4** Com a intenção `attack`, a vítima reage: **lutar** (a luta começa) ou **fugir** (D10). O creep livre
  reage no mesmo tick, pelas regras de reação; o dominado, até o fim da janela, e sem resposta valem as regras dele.
  Sem regra que valha, tenta fugir (D13).
- **E-5** Com a intenção `extort`, a exigência é calculada por D8. Com exigência 0 (vítima vazia ou agressor
  cheio), a ação é impossível: a ordem termina e o piloto decide de novo. Senão, a vítima reage como em E-4, entre
  **pagar**, **recusar** e **fugir**; sem regra que valha, paga.
- **E-6** **Pagar** deve transferir a exigência para o agressor, dar o salvo-conduto à vítima e bloquear o par
  (D9), e encerrar o encontro.
- **E-7** **Recusar** deve começar a luta.
- **E-8** O salvo-conduto deve terminar pelo tempo, ao entrar na zona do próprio Núcleo, ou quando o creep abre um
  encontro como agressor.
- **E-9** No encontro mútuo, quem escolhe primeiro é decidido por D12. O outro vira a vítima.

### Fuga (`sim`)
- **F-1** Quando um creep tenta fugir (reação ao ataque ou à extorsão, regra de reação ou botão no meio da luta), o
  `state.rng` deve decidir se ele escapa, com a chance de D10.
- **F-2** Se escapa, ele deve largar no despojo a fração sorteada de cada recurso (D10) e correr para o Núcleo com o
  bônus de velocidade, até o fim do bônus; o encontro ou a luta se encerra.
- **F-3** Se não escapa, ele não larga nada: na reação, a luta começa; no meio da luta, a rodada segue normal.
- **F-4** Um creep em fuga não pode ser extorquido. Se for alcançado por uma abordagem de ataque, a luta começa
  sem diálogo.

### Luta (`sim`)
- **L-1** A cada rodada (D7), as regras de reação dos dois devem ser avaliadas (fugir abaixo de um HP, por
  exemplo); depois, se ninguém escapou, o `state.rng` deve escolher quem acerta, com a chance de D7, e o golpe deve
  tirar a fração do HP máximo de quem é atingido. As lutas são resolvidas em ordem de id, e a ordem das chamadas
  ao `rng` é fixa.
- **L-2** Quando um dos dois morre, o outro deve recolher o saque e o resto virar despojo (D11), e a luta acabar.
- **L-3** Durante a luta, nenhum dos dois anda, coleta, entrega nem recebe ordem que mude isso, fora a fuga. O
  domínio pode começar ou terminar.

### Despojo (`sim`)
- **S-1** Quando um creep com ordem `pickup` chega à célula do despojo, ele deve pegar o que couber, cristal
  primeiro; um despojo vazio deve sair do estado.

### Piloto automático e bots (`sim`)
- **A-1** As condições e ações novas (D13) devem decidir só pelo que o time sabe (visão e memória), como o resto do
  piloto.
- **A-2** As regras de reação só devem ser avaliadas durante um encontro ou uma luta; as outras regras, só fora
  deles.
- **A-3** Os presets de coletor devem seguir os padrões de D13, e o preset salteador deve existir (D14).
- **B-1** O estrategista deve manter uma fração de salteadores (D15), com os mesmos comandos de um humano.
- **B-2** Um mundo bot × bot de 3 dias deve chegar ao fim sem erros, com os dois times ainda com creeps e
  entregando matéria.

### Eventos e crônica
- **K-1** Cada declaração, reação, tentativa de fuga, fim de luta, morte, saque, catada de despojo e nascimento deve
  emitir um evento estruturado (D16), na mesma ordem em qualquer execução.
- **K-2** Um time deve receber só os eventos em que um creep dele participa ou que acontecem numa célula visível
  para ele naquele tick.
- **K-3** O mesmo evento deve virar a mesma frase em qualquer cliente e no replay (D17).

### Rede e servidor
- **N-1** O delta de cada time deve levar os eventos novos que o time vê; o `welcome`, as últimas entradas da
  crônica do time (quantidade na §6).
- **N-2** Depois de um restart do servidor, a crônica de cada time deve continuar com pelo menos as últimas
  entradas (N-1), as mesmas de antes do restart.
- **N-3** O teste de propriedade do diff (todo tick, os dois times) deve continuar verde com morte, HP e despojos.

### Cliente
- **C-1** Cada creep deve mostrar a barra de HP quando não está cheio; o inimigo à vista também (D18).
- **C-2** O despojo deve aparecer no mapa, lembrado sob o véu como um depósito.
- **C-3** A perseguição, o encontro, a fuga e a luta devem ser legíveis no mapa: quem persegue quem, a exigência e
  as rodadas.
- **C-4** O painel da crônica deve mostrar as frases do time, as mais novas por cima, com o nome dos creeps
  clicável (seleciona o creep, se ele ainda existir e estiver à vista).
- **C-5** Quando o creep dominado é abordado, deve abrir o painel de reação com a intenção, a exigência (na
  extorsão), as escolhas e o tempo restante em segundos de mundo; no meio da luta, o botão de fugir.
- **C-6** O clique direito num inimigo à vista, com um creep dominado, deve oferecer atacar ou extorquir; a
  extorsão mostra a exigência antes de confirmar.
- **C-7** O editor de regras deve oferecer as condições, as ações e o preset novos; o inspetor, o HP, o nome, o
  salvo-conduto e o estado do encontro.

## 6. Parâmetros iniciais (chutes, para serem quebrados)

Balanceamento nos params do `sim` (`schema`, `default.json` e `test/params.json`), salvo onde indicado.

| Parâmetro | Chute |
|---|---|
| HP máximo do quadrado / triângulo / círculo | 300 / 200 / 120 (nesta fatia, só a barra os usa) |
| Peso de luta do quadrado / triângulo / círculo | 1 000 / 1 000 / 1 000 (‰; igual de início) |
| Regeneração no mapa / na zona do Núcleo | 10‰ / 100‰ do máximo por minuto (de 0 a cheio em 100 min / 10 min) |
| Raio da zona do Núcleo (regeneração e salvo-conduto) | 8 (o raio de visão do Núcleo) |
| Raio do encontro | 1 |
| Janela de reação do creep dominado | 60 s de mundo |
| Rodada do sorteio | a cada 10 s de mundo; golpe de 250‰ do HP máximo (de cheio, 4 golpes matam) |
| Fuga | largar de 500‰ a 1 000‰ de cada recurso; 1 500‰ de velocidade por 60 s de mundo |
| Salvo-conduto | 600 s de mundo |
| Bloqueio do par agressor–vítima | 1 800 s de mundo |
| Limite de HP para fugir, no preset salteador | 400‰ (dado da regra, não param) |
| Carga mínima do alvo, no preset salteador | 1 até a F5; sobe na F6 (dono, 2026-11-17; plan §11.1, C11), dado da regra, não param |
| Salteadores do bot | 1 a cada 6 creeps (constante do estrategista, não do jogo) |
| Entradas da crônica no `welcome` | 100 (constante do servidor) |

## 7. Harness e critérios de aceite

Os alvos são chutes. Quando um reprovar, o dono decide no checkpoint.

| Critério | Alvo | Como se mede |
|---|---|---|
| Encontros acontecem | No relatório: encontros por time e por hora de mundo, e a divisão entre pagou, lutou, recusou e fugiu (escapou ou não). O dono julga se a frequência importa | `geo sim` de 3 dias (seed 42) e `geo sweep` de 6 h (seeds 1–20) |
| Sem bola de neve | Em todas as seeds, os dois times terminam com creeps e entregando matéria (B-2); a diferença de população e de matéria entregue entre os times vai para o relatório | Mesmas execuções |
| Acampamento | Encontros a até o raio da zona do Núcleo da vítima, por time (D21) | Mesmas execuções |
| Economia | Matéria e cristal entregues, mortes, saque e extorsão por time, lado a lado com a F6 do fog (`b64579c3…`) | `geo sim`; o dono julga |
| Cristal | Quando o cristal do mapa se esgota e quanto fica parado no estoque, contra a F6 (9,7 h; 68%) | Mesma execução. A decisão fica para a rodada de balanceamento |
| Determinismo | 2 execuções e snapshot → restore dão o mesmo hash, com lutas, fugas e mortes | `geo verify` no CI |
| Correção do diff | Teste de propriedade verde (N-3) | CI, seeds 1, 42, 649 |
| Banda e CPU | Os alvos da [spec da rede §7](../m1.5-rede/spec.md) (≤ 2 KB/s por cliente; visão + diff ≤ 0,25 ms por mundo por envio, mediana), com os eventos | `geo net --seed 42 --days 3` |
| Custo do tick | No máximo 1,5× o da F6 do fog (`geo sim` de 3 dias, 13–14 s) | Harness |
| Sem divergência | 0 hashes divergentes; visão e crônica finais de cada cliente iguais às do servidor | `npm run soak` |
| Nada vaza | A visão e os eventos de um time não têm creep, despojo ou evento fora da visão ou da memória dele | Teste do `sim` com um mundo montado à mão |
| Regras | Cada regra de §5 com teste no `sim`, em mapas de texto | `npm run check` |

**Métricas novas no relatório:** encontros por time (abertos como agressor e como vítima) e por desfecho; fugas
tentadas e bem-sucedidas, por DNA e por terreno; mortes por time e por DNA; matéria e cristal que mudaram de mão por
extorsão, saque e despojo; despojos criados, catados e deixados no mapa; HP médio dos creeps ao longo do tempo;
população ao longo do tempo.

## 8. Protocolo de teste

1. **Testes** (`sim`, `protocol`, `server`, `client`): as regras de §5; o sorteio e a fuga com o `rng` fixo; a
   chance de fuga de um quadrado carregado num vau contra um círculo; o encontro mútuo nos dois lados de um mapa
   espelhado; nada vaza.
2. **Harness:** seeds 1 a 20 (6 h) e o mundo de 3 dias do seed 42, com as métricas da §7; `geo net`.
3. **Soak:** `npm run soak` completo.
4. **Sessão do dono:** `npm run dev:multi` contra o bot, **a ×6** (a janela de 60 s dura 10 s reais), com perguntas
   de encontro no PLAYTEST (ex.: "o que aconteceu com aquele creep?", "por que pagou?", "o que você mudou depois da
   primeira emboscada?"). O dono revisa também o tom da crônica (D17).

### Critério para fechar a fatia
- Critérios da §7 verdes, ou o dono decide o que fazer com o que reprovou.
- O dono responde às perguntas 1 a 3 da hipótese no checkpoint da sessão.

## 9. Pré-requisitos antes do `plan.md`

- Aceite do dono nas decisões D1–D21 ✅ (2026-11-15); as de gameplay estão no GDD (01, 02, 03, 06, 07, 08).
- **ADR-0007 — Eventos do `sim`** ✅ `Accepted` (2026-11-15): o `step` emite eventos fora do estado; como o servidor
  os filtra por time, guarda a crônica e a recupera depois de um restart; o versionamento do formato dos eventos
  com o vocabulário de comandos (ADR-0002).
- O sorteio é descartável e não pede ADR. O contrato mundo ↔ batalha (ADR-0001 com entrada no meio da luta) é da
  fatia D.

## 10. Perguntas abertas

Nenhuma no momento.
