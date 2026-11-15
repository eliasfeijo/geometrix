# Spec M2 — O encontro

**Status:** Rascunho · **Data:** 2026-11-15 · **Marco:** M2 — A emboscada ([ROADMAP](../../ROADMAP.md)), fatia A de 5
**GDD relacionado:** [02](../../gdd/02-creeps-e-dominio.md) (stats base, HP, morte, nome),
[03](../../gdd/03-economia-e-logistica.md) (saque, despojo), [06](../../gdd/06-batalhas.md) (encontro,
salvo-conduto, fuga, sorteio descartável), [07](../../gdd/07-piloto-automatico.md) (posturas),
[08](../../gdd/08-cronica-chat-e-console.md) (crônica) · **Brainstorm:**
[2026-11-15](../../brainstorm/2026-11-15-m2-m3.md) §2, §5 · **ADR:** 0007 (eventos do `sim`, a rascunhar; §9)

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

Resumo; a fonte é o GDD.

| Tema | Decisão |
|---|---|
| Encontro | Abordagem com diálogo. O agressor escolhe a 1ª ação: **atacar** ou **extorquir**. A vítima reage se a ação não abrir luta na hora: **paga**, **recusa** (luta) ou **foge** |
| A luta até a junção | Um **sorteio descartável**, que ninguém balanceia |
| Quem vence | Level, stats, skills e micro, não o DNA ou a carga sozinhos. No M2, só stats base por DNA |
| Salvo-conduto | Depois de pagar: imune só a novas abordagens do time que extorquiu, por um tempo ou até a própria rede de estradas; perde a proteção se abordar alguém. O mesmo agressor não extorque o mesmo creep de novo por um tempo |
| Fuga | Larga a bolsa (parte ou toda) num despojo e fica mais rápida; o agressor escolhe entre catar e perseguir |
| Saque e despojo | Sem fuga, o vencedor fica com a carga dos mortos; o que não cabe vira **despojo**, uma pilha que qualquer creep cata |
| HP | Persiste no mundo e regenera devagar, mais rápido perto do Núcleo |
| Morte | Permanente |
| Crônica | Os diálogos e os eventos aparecem como texto na partida, para jogadores e bots. Sem LLM |

## 3. Decisões de escopo que esta spec assume

Propostas, **a aceitar pelo dono**. As marcadas com **(gameplay)** completam o GDD e entram nele depois do aceite
(skill `gdd-decision`); algumas respondem a perguntas abertas, indicadas na coluna "Por quê". Os números estão na
§6 e são chutes.

| # | Decisão | Padrão proposto | Por quê |
|---|---|---|---|
| D1 | Nome no estado **(gameplay)** | O creep ganha o nome ao nascer, no `sim`, da lista de 179 palavras que hoje está no cliente, pela mesma regra (ordem de nascimento, nascimentos seguidos com nomes distantes, sufixo "II" quando a lista acaba). **Sem comando de renomear** nesta fatia | Proposta do GDD 02, que pede o nome no estado no M2: com a morte, o nome gerado pela ordem trocaria. A crônica precisa de nomes estáveis. Renomear é um comando a mais sem valor para a hipótese |
| D2 | Stats base: só o HP **(gameplay)** | Cada DNA ganha `hp` máximo nos params. Dano, alcance e velocidade de batalha ficam para o laboratório (B), que é onde eles fazem diferença | O sorteio (D7) não usa dano nem alcance. Pôr esses números agora seria balancear algo que ninguém usa |
| D3 | Regeneração do HP **(gameplay)** | Em ‰ do HP máximo por minuto de mundo, igual para os três DNAs: devagar no mapa, mais rápido a até um raio do próprio Núcleo. Não regenera durante um encontro ou uma luta | GDD 02 ("mais rápido perto do Núcleo"). Em ‰, um DNA não sara mais rápido que o outro só por ter menos HP |
| D4 | Morte e domínio **(gameplay)** | Com HP 0, o creep sai do estado; a carga vira saque ou despojo (D11). Se estava dominado, **o domínio termina**, como um `release`, sem cooldown | Responde à pergunta aberta do GDD 02 ("o que acontece com o domínio quando o creep dominado morre?") |
| D5 | Abordar **(gameplay)** | Ordem nova `approach`: o creep anda até um creep inimigo que o time vê, com a intenção já escolhida (**atacar** ou **extorquir**). O encontro abre quando os dois ficam a até o raio do encontro (Manhattan). Se o alvo sai da visão do time, a ordem termina, como um `moveTo` sem caminho | GDD 06: o agressor escolhe a 1ª ação. Escolhida na ordem, a ação funciona igual para o humano e para o piloto, e o agressor não precisa de uma janela de resposta |
| D6 | Quem entra e a janela de resposta **(gameplay)** | Só **1 × 1** nesta fatia: o agressor e a vítima. Um creep só está num encontro ou numa luta por vez, e não pode ser abordado nesse meio. **O creep livre responde na hora**, pelas regras do piloto (D13). **O creep dominado** tem uma janela, em segundos de mundo, para o jogador responder; sem resposta, valem as regras do piloto dele. Os dois ficam parados durante a janela | GDD 06, perguntas abertas: "raio do encontro" e "janela de resposta". Mais de dois lados e a entrada no meio da luta são da junção (D), com a instância de batalha. Num playtest comprimido (×36), uma janela curta dura menos de 1 s real: ver §8 |
| D7 | O sorteio descartável **(gameplay, provisório)** | A luta é uma série de rodadas, uma a cada N segundos de mundo, com os dois parados. Em cada rodada, o `state.rng` escolhe quem acerta (50% cada), e o golpe tira uma fração fixa do HP **máximo** de quem é atingido. A luta termina quando um dos dois morre | Neutro quanto ao DNA (o golpe é em ‰ do próprio HP, então o quadrado não vence por ter mais HP), e quem já entra ferido perde mais vezes: o HP persistente pesa, como o GDD 02 quer. É o primeiro uso do `state.rng` durante a partida. O laboratório (B) e a junção (D) substituem o sorteio |
| D8 | Extorsão **(gameplay)** | A exigência é a **carga da vítima até a capacidade livre do agressor**, cristal primeiro. Não dá para extorquir quem está vazio nem estando cheio. Pagar passa a exigência da carga da vítima para a do agressor | A proposta do brainstorm (limitada pela capacidade livre) dá a "quantidade relativa ao DNA" que o dono pediu, sem número novo: o quadrado extorque muito e é lento; o círculo extorque pouco e alcança. Cristal primeiro porque é o que vale emboscar (GDD 03) |
| D9 | Salvo-conduto **(gameplay)** | Imune a abordagens do time que extorquiu, por um tempo ou **até entrar na zona do próprio Núcleo** (um raio). Perde a proteção ao abordar alguém. O par agressor–vítima não repete a extorsão por um tempo maior | **Muda um detalhe decidido:** o GDD diz "até a própria rede de estradas", mas a estrada pronta é neutra e não guarda quem a construiu. Alternativas: só o tempo, ou passar a gravar o time que construiu cada estrada |
| D10 | Fuga **(gameplay)** | A vítima larga **a carga toda** num despojo na própria célula e corre para o Núcleo com um bônus de velocidade por um tempo. Na fuga, ela pode ser abordada para atacar, mas não extorquida. Se o agressor a alcança, o encontro abre direto na luta, sem diálogo | GDD 06 ("parte ou toda"): toda é mais simples e deixa o dilema mais claro (catar a bolsa inteira ou perseguir). Largar a carga já tira o freio de carregado (`loaded`, 800‰); o bônus garante que fugir funcione contra um perseguidor do mesmo DNA |
| D11 | Saque e despojo **(gameplay)** | O vencedor recolhe a carga do morto até a capacidade livre, cristal primeiro; o resto vira despojo na célula do morto. Despojos na mesma célula se somam. O despojo **não expira** nesta fatia. Ordem nova `pickup` e ação "catar despojo": cata na hora, até a capacidade livre. O despojo entra na visão e na memória do time como um depósito (último valor visto) | GDD 03. Expirar seria um sumidouro, mas é uma regra nova; fica para a rodada de balanceamento, se o mapa encher de despojo |
| D12 | Encontro mútuo **(gameplay)** | Quando os dois se abordam no mesmo tick, escolhe primeiro quem **não está no rio nem num vau** e, depois, quem tem **menos carga relativa** (carga ÷ capacidade); o que empatar, pelo `state.rng`. Nunca pelo id | É a ideia do dono, na forma que o brainstorm propôs (ainda sem aprovação). O id quebra o espelho entre os times (F6 do fog) |
| D13 | Posturas no piloto **(gameplay)** | Vocabulário novo. Condição **inimigo à vista** (raio, DNA, carga mínima). Ação **abordar** (atacar ou extorquir o inimigo à vista mais próximo que passa no filtro). Ação **catar despojo**. Regras de reação, avaliadas só quando o creep é extorquido: condição **exigência até X‰ da carga**, ações **pagar**, **recusar** e **fugir**. Sem regra de reação que valha, **paga** | Proposta "posturas de encontro" do GDD 07. Quase todo encontro acontece sem humano olhando (pilar 4). Pagar por padrão é o que menos destrói o creep de quem não configurou nada |
| D14 | Presets **(gameplay)** | Os coletores ganham a reação padrão (pagar). Preset novo, **salteador**: extorquir um inimigo carregado à vista → catar despojo à vista → entregar se cheio → explorar | O jogador precisa de um jeito de um clique para começar a emboscar, como o batedor deu para explorar |
| D15 | Bots | O estrategista põe uma fração dos creeps como salteadores (chute na §6) e não muda as reações dos coletores (pagam) | Sem bot que aborde, a sessão solo do dono continua sem conflito, que é o diagnóstico do brainstorm |
| D16 | Eventos do `sim` | O `step` passa a emitir **eventos estruturados** (quem, o quê, quanto), fora do estado e do hash. O replay e a recuperação os recalculam, como fazem com o resto. É um contrato novo: o ADR-0007 | O `sim` não emite eventos hoje, e a crônica precisa deles. Fora do estado, o snapshot não cresce |
| D17 | Crônica **(gameplay)** | O cliente narra os eventos com modelos de frase em PT-BR, com a **voz pelo DNA** e a variante escolhida por um número do próprio evento (todos leem a mesma frase). Entram os encontros, as lutas, as mortes, os saques e os nascimentos. Um time vê o evento em que um creep dele participa ou que acontece na visão dele. O texto fica fora do `sim` | Propostas do GDD 08 ("o texto não mora no `sim`", "voz pelo DNA no M2"). O agente escreve o banco inicial de frases e o dono revisa. O texto muda sem mudar o `SIM_VERSION` |
| D18 | O inimigo na visão | O creep inimigo à vista passa a mostrar também o **nome**, o **HP** e se está num encontro ou numa luta | Ferido, ele vira alvo (GDD 02), e o jogador precisa ver isso para escolher a vítima. O nome aparece na crônica de qualquer jeito |
| D19 | Comandos sobre o desconhecido | Abordar um creep que o time não vê, ou catar um despojo que ele não conhece, é recusado com a recusa de id inexistente | A regra D6 da spec do fog |
| D20 | O que muda de propósito | `SIM_VERSION` 6, `PROTOCOL_VERSION` 4, vocabulário de comandos novo (`BREAKING CHANGE`), e os hashes fixos (3 dias do seed 42, 6 h do `bot-world.test.ts`) mudam | Gameplay novo: snapshots e replays antigos ficam inválidos (ADR-0004) |

## 4. Escopo

### Dentro
- **`sim`:** nome ao nascer (D1); HP, regeneração e morte (D2–D4); a ordem `approach`, o encontro, a janela e as
  respostas (D5, D6, D8, D10); o sorteio (D7); salvo-conduto e o bloqueio do par (D9); despojo, `pickup` e saque
  (D10, D11); o encontro mútuo (D12); o vocabulário do piloto e os presets (D13, D14); os eventos (D16); a visão com
  os campos novos e os despojos na memória (D11, D18); recusas sem vazamento (D19); os params.
- **Estrategista dos bots:** os salteadores (D15).
- **Protocolo:** os comandos novos (abordar, responder ao encontro, catar); os eventos do time no delta; o
  `welcome` com as entradas recentes da crônica.
- **Servidor:** manda a cada time os eventos que ele vê; guarda a crônica para que um cliente que reconecta, ou
  um servidor que reinicia, não a perca (§5, S-2).
- **Cliente:** barra de HP; nome vindo do estado; despojo no mapa; marca de encontro e de luta entre os dois
  creeps; painel da crônica; painel de resposta para o creep dominado extorquido (pagar, recusar, fugir, com o
  tempo restante); clique direito num inimigo com a escolha atacar ou extorquir; inspetor com HP, salvo-conduto e
  estado do encontro; o editor de regras com as condições, ações e o preset novos; o replay com a crônica.
- **Harness:** as métricas novas (§7); `geo net` e `npm run soak` de novo.
- **Playtest:** perguntas de encontro no [PLAYTEST.md](../../PLAYTEST.md).

### Fora
Combate real e a instância de batalha (fatias B e D); mais de dois lados, grupos e entrada no meio da luta (D);
errantes e a facção neutra (D); HP de construções, cerco, reparo e vitória (E); chat livre, console e macros (C); a
3ª ação por DNA, temperamentos, level, XP e skills (M2.5); renomear creep; despojo que expira; zona segura perto do
Núcleo (§10); escambo entre times; o esgotamento e o papel do cristal, que esta fatia **mede** mas não decide (§7);
deploy.

## 5. Comportamento

Formato: *Quando [gatilho], o sistema deve [resposta].*

### Identidade, HP e morte (`sim`)
- **H-1** Quando um creep nasce (no `createWorld` ou na produção), ele deve receber um nome pela regra de D1 e HP
  igual ao máximo do DNA.
- **H-2** A cada tick, um creep fora de encontro e de luta deve recuperar HP pela regra de D3, sem passar do
  máximo. A zona do Núcleo é um raio Manhattan a partir do Núcleo do time.
- **H-3** Quando o HP de um creep chega a 0, ele deve sair do estado no mesmo tick, com a carga tratada por D11 e o
  domínio encerrado (D4). O id nunca é reaproveitado.

### Abordagem e encontro (`sim`)
- **E-1** A ordem `approach` (do jogador que domina ou do piloto) deve ser aceita só para um creep inimigo que o
  time vê agora, com intenção `attack` ou `extort`. Fora disso, é recusada pela regra de D19.
- **E-2** Enquanto o alvo continua à vista, o creep deve andar até ele, recalculando o caminho quando o alvo muda
  de célula. Quando o alvo sai da visão, a ordem deve terminar.
- **E-3** Quando o agressor e o alvo estão a até o raio do encontro, o alvo está livre (sem encontro nem luta) e
  não tem salvo-conduto contra o time do agressor, o encontro deve abrir: os dois param e um evento sai.
- **E-4** Com a intenção `attack`, a luta deve começar no mesmo tick (D7).
- **E-5** Com a intenção `extort`, a exigência é calculada por D8. Com exigência 0 (vítima vazia ou agressor
  cheio), a ação é impossível: a ordem termina e o piloto decide de novo. Senão, a vítima responde: o creep livre
  no mesmo tick, pelas regras de reação; o dominado, até o fim da janela, e sem resposta valem as regras dele (D6,
  D13).
- **E-6** **Pagar** deve transferir a exigência para o agressor, dar o salvo-conduto à vítima e bloquear o par
  (D9), e encerrar o encontro.
- **E-7** **Recusar** deve começar a luta.
- **E-8** **Fugir** deve criar o despojo com a carga toda da vítima e pô-la em fuga até o Núcleo, com o bônus de
  velocidade (D10). O encontro se encerra; o agressor volta ao piloto ou ao jogador.
- **E-9** O salvo-conduto deve terminar pelo tempo, ao entrar na zona do próprio Núcleo, ou quando o creep abre um
  encontro como agressor.
- **E-10** No encontro mútuo, quem escolhe primeiro é decidido por D12. O outro vira a vítima.

### Luta (`sim`)
- **L-1** A cada rodada (D7), o `state.rng` deve escolher quem acerta, e o golpe deve tirar a fração do HP máximo
  de quem é atingido. A ordem das chamadas ao `rng` é a ordem das lutas por id do encontro.
- **L-2** Quando um dos dois morre, o outro deve recolher o saque e o resto virar despojo (D11), e a luta acabar.
- **L-3** Durante a luta, nenhum dos dois anda, coleta, entrega nem recebe ordem nova que mude isso. O domínio pode
  começar ou terminar, mas não muda o resultado.

### Despojo (`sim`)
- **S-1** Quando um creep com ordem `pickup` chega à célula do despojo, ele deve pegar o que couber, cristal
  primeiro; um despojo vazio deve sair do estado.

### Piloto automático e bots (`sim`)
- **A-1** As condições e ações novas (D13) devem decidir só pelo que o time sabe (visão e memória), como o resto do
  piloto.
- **A-2** As regras de reação só devem ser avaliadas enquanto o creep está sendo extorquido; as outras regras, só
  fora de encontros.
- **A-3** Os presets de coletor devem trazer a reação padrão, e o preset salteador deve existir (D14).
- **B-1** O estrategista deve manter uma fração de salteadores (D15), com os mesmos comandos de um humano.
- **B-2** Um mundo bot × bot de 3 dias deve chegar ao fim sem erros, com os dois times ainda com creeps e
  entregando matéria.

### Eventos e crônica
- **K-1** Cada encontro, resposta, rodada final de luta, morte, saque, catada de despojo e nascimento deve emitir
  um evento estruturado (D16), na mesma ordem em qualquer execução.
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
- **C-3** O encontro e a luta devem ser legíveis no mapa: quem aborda quem, a exigência e as rodadas.
- **C-4** O painel da crônica deve mostrar as frases do time, as mais novas por cima, com o nome dos creeps
  clicável (seleciona o creep, se ele ainda existir e estiver à vista).
- **C-5** Quando o creep dominado é extorquido, deve abrir o painel de resposta com a exigência, as três escolhas e
  o tempo restante em segundos de mundo.
- **C-6** O clique direito num inimigo à vista, com um creep dominado, deve oferecer atacar ou extorquir; a
  extorsão mostra a exigência antes de confirmar.
- **C-7** O editor de regras deve oferecer as condições, as ações e o preset novos; o inspetor, o HP, o nome, o
  salvo-conduto e o estado do encontro.

## 6. Parâmetros iniciais (chutes, para serem quebrados)

Balanceamento nos params do `sim` (`schema`, `default.json` e `test/params.json`), salvo onde indicado.

| Parâmetro | Chute |
|---|---|
| HP máximo do quadrado / triângulo / círculo | 300 / 200 / 120 (só a barra os usa nesta fatia) |
| Regeneração no mapa / na zona do Núcleo | 10‰ / 100‰ do máximo por minuto (de 0 a cheio em 100 min / 10 min) |
| Raio da zona do Núcleo (regeneração e salvo-conduto) | 8 (o raio de visão do Núcleo) |
| Raio do encontro | 1 |
| Janela de resposta do creep dominado | 60 s de mundo |
| Rodada do sorteio | a cada 10 s de mundo; golpe de 250‰ do HP máximo (de cheio, 4 golpes matam) |
| Salvo-conduto | 600 s de mundo |
| Bloqueio do par agressor–vítima | 1 800 s de mundo |
| Fuga | 1 500‰ de velocidade por 60 s de mundo |
| Salteadores do bot | 1 a cada 6 creeps (constante do estrategista, não do jogo) |
| Entradas da crônica no `welcome` | 100 (constante do servidor) |

## 7. Harness e critérios de aceite

Os alvos são chutes. Quando um reprovar, o dono decide no checkpoint.

| Critério | Alvo | Como se mede |
|---|---|---|
| Encontros acontecem | No relatório: encontros por time e por hora de mundo, e a divisão entre pagou, recusou e fugiu. O dono julga se a frequência importa | `geo sim` de 3 dias (seed 42) e `geo sweep` de 6 h (seeds 1–20) |
| Sem bola de neve | Em todas as seeds, os dois times terminam com creeps e entregando matéria (B-2); a diferença de população e de matéria entregue entre os times vai para o relatório | Mesmas execuções |
| Economia | Matéria e cristal entregues, mortes, saque e extorsão por time, lado a lado com a F6 do fog (`b64579c3…`) | `geo sim`; o dono julga |
| Cristal | Quando o cristal do mapa se esgota e quanto fica parado no estoque, contra a F6 (9,7 h; 68%) | Mesma execução. A decisão fica para a rodada de balanceamento |
| Determinismo | 2 execuções e snapshot → restore dão o mesmo hash, com lutas e mortes | `geo verify` no CI |
| Correção do diff | Teste de propriedade verde (N-3) | CI, seeds 1, 42, 649 |
| Banda e CPU | Os alvos da [spec da rede §7](../m1.5-rede/spec.md) (≤ 2 KB/s por cliente; visão + diff ≤ 0,25 ms por mundo por envio, mediana), com os eventos | `geo net --seed 42 --days 3` |
| Custo do tick | No máximo 1,5× o da F6 do fog (`geo sim` de 3 dias, 13–14 s) | Harness |
| Sem divergência | 0 hashes divergentes; visão e crônica finais de cada cliente iguais às do servidor | `npm run soak` |
| Nada vaza | A visão e os eventos de um time não têm creep, despojo ou evento fora da visão ou da memória dele | Teste do `sim` com um mundo montado à mão |
| Regras | Cada regra de §5 com teste no `sim`, em mapas de texto | `npm run check` |

**Métricas novas no relatório:** encontros por time (abertos como agressor e como vítima) e por desfecho; mortes
por time e por DNA; matéria e cristal que mudaram de mão por extorsão, saque e despojo; despojos criados, catados e
deixados no mapa; HP médio dos creeps ao longo do tempo; população ao longo do tempo.

## 8. Protocolo de teste

1. **Testes** (`sim`, `protocol`, `server`, `client`): as regras de §5; o sorteio com o `rng` fixo; a fuga contra um
   perseguidor do mesmo DNA; o encontro mútuo nos dois lados de um mapa espelhado; nada vaza.
2. **Harness:** seeds 1 a 20 (6 h) e o mundo de 3 dias do seed 42, com as métricas da §7; `geo net`.
3. **Soak:** `npm run soak` completo.
4. **Sessão do dono:** `npm run dev:multi` contra o bot, num **multiplicador menor que o ×36** (proposta: ×6, em que
   a janela de 60 s dura 10 s reais), com perguntas de encontro no PLAYTEST (ex.: "o que aconteceu com aquele
   creep?", "por que pagou?", "o que você mudou depois da primeira emboscada?").

### Critério para fechar a fatia
- Critérios da §7 verdes, ou o dono decide o que fazer com o que reprovou.
- O dono responde às perguntas 1 a 3 da hipótese no checkpoint da sessão.

## 9. Pré-requisitos antes do `plan.md`

- Aceite do dono nas decisões D1–D20; as de gameplay entram no GDD (02, 03, 06, 07, 08) pela skill `gdd-decision`.
- **ADR-0007 — Eventos do `sim`** (`Proposed` → `Accepted`): o `step` emite eventos fora do estado; como o servidor
  os filtra por time, guarda a crônica e a recupera depois de um restart; o versionamento do formato dos eventos
  com o vocabulário de comandos (ADR-0002). Rascunho com a skill `adr` depois do aceite da spec.
- O sorteio é descartável e não pede ADR. O contrato mundo ↔ batalha (ADR-0001 com entrada no meio da luta) é da
  fatia D.

## 10. Perguntas abertas

- **Zona segura perto do Núcleo?** Nada no GDD impede um salteador de esperar na saída do Núcleo inimigo e abordar
  cada creep que sai. A proposta é não ter zona segura nesta fatia e medir: se os bots acamparem no Núcleo, vira
  decisão do dono no checkpoint (zona segura, ou a defesa vir da fatia E).
