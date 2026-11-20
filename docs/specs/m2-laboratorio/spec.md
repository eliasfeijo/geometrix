# Spec M2 — O laboratório de batalha

**Status:** Aprovada (2026-11-15); revista no checkpoint da F3 (2026-11-17: D3, D11, D20, §6, §7) · **Data:** 2026-11-15 · **Marco:** M2 — A emboscada ([ROADMAP](../../ROADMAP.md)), fatia B de 5
**GDD relacionado:** [02](../../gdd/02-creeps-e-dominio.md) (stats base por DNA, domínio),
[06](../../gdd/06-batalhas.md) (combate experimental e configurável, lados, fuga, fim da batalha),
[07](../../gdd/07-piloto-automatico.md) (gambits) ·
**Brainstorm:** [2026-11-15](../../brainstorm/2026-11-15-m2-m3.md) §6 · **ADR:** [0008](../../adr/0008-pacote-de-batalha.md)
(pacote de batalha, `Accepted`)

## 1. Hipótese

> A batalha muda o rumo do mundo sem dominar o jogo? (ROADMAP, M2)

Esta fatia responde à parte da batalha, **antes de existir a junção com o mundo**: um laboratório local, sem mundo,
com participantes montados à mão. Ela pergunta:

1. **A regra de grade é divertida?** Só com o ataque básico e os stats base por DNA, de 1 × 1 a 3 × 3 e com três
   lados, jogar e assistir prende a atenção do dono.
2. **A micro importa e o DNA não decide sozinho** (GDD 06): dominando um creep, o dono vence confrontos que a IA
   perde no mesmo setup; e nenhum confronto 1 × 1 entre DNAs, de HP cheio, está decidido de antemão.
3. **Quanta latência a regra de grade aguenta sem predição?** É a pergunta que trava o deploy (ROADMAP,
   2026-11-15): o laboratório a responde localmente, às cegas. **Checkpoint da F5 (dono, 2026-11-20):** até 100 ms
   a nota fica em 4 ou mais, e abaixo de 3 a partir de 200 ms; o deploy e a predição no cliente esperam a junção
   (plan §15, C10).
4. **A IA de gambits serve de adversário e de auto-resolve:** joga de um jeito crível, é rápida e é determinística.

Depois desta fatia, a junção (D) liga o encontro do mundo (A) à instância de batalha, no lugar do sorteio
descartável.

## 2. O que o dono já decidiu (GDD, 2026-11-15)

Resumo; a fonte é o GDD e a rodada interativa desta spec (§3).

| Tema | Decisão |
|---|---|
| Separação | Mundo e batalha são simulações separadas; a batalha recebe os participantes e devolve eventos (ADR-0001) |
| Combate | Experimental e configurável: regras diferentes atrás do mesmo contrato. **A primeira é a grade** (jogos de ação do BYOND). O laboratório anda em paralelo ao encontro, e os dois se juntam depois |
| Stats | **No M2, só stats base por DNA** (vida, dano, alcance, velocidade na batalha), nos params. Level, XP, evolução e skills no M2.5 |
| Quem vence | Level, stats, skills e a micro de quem joga, humano ou bot; não o DNA nem a carga sozinhos |
| Lados | Mínimo 1 × 1, com dois ou mais lados, e entrada numa batalha já começada |
| Domínio | Cada humano controla só o creep que domina (1 domínio por jogador); o resto vai pela IA |
| Fuga | Cada regra de combate tem a própria mecânica de fuga |
| Perdas | A morte é permanente e o HP persiste depois da batalha (vale no mundo, na junção) |

## 3. Decisões de escopo que esta spec assume

**Aceitas pelo dono na rodada interativa de 2026-11-15**, com a spec: D4, D7, D9 e D11 foram escolhidas por ele
entre alternativas (D9 com o fim pela inatividade, ideia dele, e "ativo" como dar ou levar dano); D14 e D15 com o
editor no laboratório. As marcadas com **(gameplay)** completam o GDD e já estão nele. Os números estão na §6 e são
chutes.

| # | Decisão | Padrão | Por quê |
|---|---|---|---|
| D1 | O pacote | A batalha mora num pacote próprio, `@geometrix/battle`, puro, determinístico e inteiro, com params, versão e hash próprios. Não importa o `sim` (ADR-0008) | Anda em paralelo à fatia A sem tocar nos arquivos dela; na junção, o mundo chama a batalha |
| D2 | O laboratório | Uma página local do cliente, **sem mundo e sem servidor de jogo**: monta uma batalha, joga, assiste, mede. A batalha roda num *worker* que faz o papel do servidor autoritativo (ADR-0008, regra 9) | O brainstorm (§6): itera a diversão em minutos, sem esperar o mundo, e mede a latência sem gastar com servidor |
| D3 | A arena **(gameplay)** | Uma grade desenhada em texto, com **chão** e **pedra** (bloqueia o movimento e os projéteis). O anel de células de chão da borda é a **saída** (D9). Três arenas fixas na fatia: campo aberto, campo com pedras e um corredor (o gargalo de um vau). Todos veem a arena inteira: **sem fog na batalha**. **Checkpoint da F3 (dono, 2026-11-17):** a arena fica 2× maior, e cada lado nasce numa **zona de nascimento**, um bloco de chão a meio caminho entre a borda e o centro, longe da saída (como no Mount & Blade, sem a mesma escala) | O mínimo para a posição importar (cobertura, gargalo). O terreno pelo entorno (rio, árvores, estruturas) é ideia do dono sem marco (GDD 06). Nascer colado à saída deixava qualquer um fugir em 2,6 s, antes de o inimigo chegar |
| D4 | Ataque direcional **(gameplay; dono)** | O creep olha para uma de 4 direções. O **quadrado** bate na célula da frente. O **círculo** e o **triângulo** disparam um **projétil** que anda célula a célula até o alcance e acerta o **primeiro inimigo** no caminho, ou para numa pedra. Os aliados não bloqueiam nem levam o tiro (sem fogo amigo). Cada DNA tem dano, alcance e recarga próprios. **Dá para desviar** do projétil saindo da linha | Dono, 2026-11-15: estilo BYOND. A micro é mirar e esquivar, e é a que mais sente latência, o que o laboratório quer medir |
| D5 | Movimento e corpo **(gameplay)** | Célula a célula, em 4 direções, com a velocidade de batalha do DNA. **Uma célula, um creep:** ninguém atravessa ninguém, e o quadrado bloqueia a passagem (o tank segura a linha). Quando dois querem a mesma célula no mesmo tick, o `rng` da batalha decide, nunca o id. Virar sem andar é possível (para mirar) | Grade com corpo dá o papel do tank sem skill. O id quebra o espelho entre os lados (F6 do fog) |
| D6 | Stats base por DNA **(gameplay)** | Nos params da batalha: **HP máximo, dano, alcance, recarga do ataque, velocidade de batalha, velocidade do projétil e capacidade de carga**. O participante entra com o **HP atual** que o setup der (o ferido luta ferido) | GDD 02. O HP máximo e a capacidade repetem os números do `sim` até a junção, que escolhe uma fonte só (ADR-0008) |
| D7 | Fuga pela borda **(gameplay; dono)** | Quem fica numa célula de saída por um instante, sem levar golpe, **sai da batalha** com o que carrega; um golpe zera a contagem | Dono, 2026-11-15. A arena é a bolha |
| D8 | Carga, largar e catar **(gameplay)** | A carga **freia** o creep na batalha, em proporção à fração da capacidade ocupada (cheio, a metade da velocidade). O comando **largar a bolsa** deixa toda a carga numa **pilha** na célula e tira o freio. Quem morre deixa a carga numa pilha na própria célula. O comando **catar** pega da pilha da célula até a capacidade livre, cristal primeiro | Dono, 2026-11-15 (fuga): o agressor escolhe entre catar e perseguir, como no mundo. O freio proporcional faz do quadrado carregado até o talo quem quase nunca escapa (GDD 06). O que sobra na arena volta ao mundo na junção (D) |
| D9 | Fim da batalha e inatividade **(gameplay; dono)** | **Não há relógio da batalha.** Cada participante tem um **relógio de inatividade**, que corre desde o começo ou desde a entrada dele e zera quando ele **dá ou leva dano**. Quando estoura, o creep **foge sozinho** (sai como na D7, com o que carrega). A batalha acaba quando **sobra no máximo um lado** na arena (os outros morreram ou fugiram): esse lado vence; se não sobra ninguém, não há vencedor. **Checkpoint da F5 (dono, 2026-11-18):** o relógio de inatividade passa a ser **um só, da batalha**: zera quando qualquer um dá ou leva dano, e quando estoura **todos fogem ao mesmo tempo**, sem vencedor | Dono, 2026-11-15: aniquilação ou fuga, com o tempo contando só a inatividade. Resolve o impasse entre dois *kiters* e o humano ausente, sem cortar uma luta que está acontecendo. Dono, 2026-11-18: com um relógio por creep, quem não acertava nem era acertado fugia no meio da luta dos outros (no 3 × 3 e no 1 × 1 × 1); o relógio da batalha resolve o mesmo impasse sem isso. O humano ausente num 3 × 3 não sai mais sozinho |
| D10 | Lados **(gameplay)** | De 2 a 4 lados, **todos hostis entre si** nesta fatia. Cada lado tem um trecho da borda de entrada | GDD 06 (lados, não grupos). Alianças entre lados (tribos, M4) ficam para quando houver quem se alie |
| D11 | Entrada no meio da luta **(gameplay; dono)** | O comando **entrar** põe um participante novo num lado (existente ou novo) numa célula livre do trecho de entrada desse lado. Quem entra não passa por diálogo. O laboratório tem um botão para isso. Com as zonas de nascimento (D3), quem entra nasce na zona do seu lado | Dono, 2026-11-15: o motor e o laboratório já nascem com isso; o lado do mundo (quem pode entrar, a bolha) é da junção |
| D12 | Domínio no laboratório **(gameplay)** | O humano domina **um** participante de cada vez, ou nenhum (só assiste). No laboratório, ele troca de participante a qualquer momento, sem custo. O dominado não usa os gambits; ao ser liberado, volta a eles | GDD 02. A troca livre é do laboratório: no mundo, o domínio vem da fatia A |
| D13 | Controles do humano | Teclado: setas ou WASD andam (contra uma pedra ou um creep, só viram); espaço ataca na direção em que o creep olha; uma tecla larga a bolsa e outra cata. O detalhe (mouse para mirar, segurar para repetir) fica para o `plan.md` e para o checkpoint | O mínimo do BYOND. O dono julga o "sentir" no checkpoint |
| D14 | IA de gambits **(gameplay)** | Uma lista ordenada **condição → ação** por participante; a 1ª regra com condição verdadeira e ação possível vira os comandos do tick, como o piloto do mundo (GDD 07). **Condições:** sempre; HP abaixo de X‰; inimigo a até N células; inimigo alinhado no alcance (linha livre); projétil inimigo vindo na minha direção; carga acima de X‰ da capacidade; aliado com HP abaixo de X‰ a até N células. **Ações:** atacar um alvo (o mais perto, o mais ferido, ou de um DNA), indo até alinhar e atirando; aproximar; manter distância (ficar no alcance máximo do alvo); esquivar (sair da linha do projétil); proteger um aliado (ficar entre ele e o inimigo mais perto); fugir (para a saída mais perto); largar a bolsa; catar a pilha mais perto | O brainstorm (§6): a IA de gambits desde o primeiro dia, porque ela é o adversário do laboratório e o auto-resolve do mundo. Sem esquivar, nenhuma IA aguentaria um humano na regra direcional |
| D15 | Presets por DNA **(gameplay)** | **Linha de frente** (quadrado): proteger o aliado ferido → atacar o mais perto. **Atirador** (círculo): fugir com HP baixo → esquivar → manter distância → atacar o mais ferido. **Escaramuçador** (triângulo): fugir com HP baixo → esquivar → atacar o mais perto. **Portador** (qualquer DNA): largar a bolsa com inimigo perto → fugir. O laboratório deixa escolher o preset de cada participante e **editar a lista** (acrescentar, tirar, reordenar regras) | A forma diz o papel (pilar 6). Editar a lista é o que deixa o dono afinar a IA sem código; é a mesma ideia do editor de regras do mundo |
| D16 | Auto-resolve | A mesma simulação, sem página e sem canal, com todos os participantes pela IA, na velocidade que a máquina der. A CLI ganha `geo battle`: confrontos em série (cada par de DNAs, cada arena, várias seeds), o relatório do §7 e o `verify` de um log | ADR-0001: a batalha roda com ou sem cliente, acelerada. O relatório é o balanceamento do laboratório |
| D17 | Latência simulada | A página e o *worker* conversam por um canal com **atraso de ida e de volta** (metade do RTT escolhido cada) e ***jitter***. Seletor de RTT: 0, 50, 100, 150, 200 e 300 ms. A página mostra o atraso medido entre a tecla e o efeito na tela. **Modo às cegas:** o laboratório sorteia o RTT a cada batalha sem mostrá-lo, o dono dá uma nota de 1 a 5 ao fim ("dá para jogar?"), e o relatório cruza nota × RTT, exportável | A pergunta 3 da hipótese. Às cegas, o dono não julga o número, julga o jogo |
| D18 | Determinismo | Mesmo setup + mesmos comandos ⇒ mesmo hash, em qualquer execução e engine. O laboratório **exporta o log** de uma batalha (setup + comandos por tick), e o `geo battle verify` reproduz o hash que o *worker* calculou | ADR-0003 e ADR-0008. É o que garante que o auto-resolve da junção dá o mesmo resultado no servidor e no replay |
| D19 | Eventos | O passo da batalha devolve eventos estruturados fora do estado (ADR-0007): ataque, golpe, dano, morte, largou, catou, entrou, fugiu (pela borda ou por inatividade), fim. O laboratório mostra uma lista simples, **sem a crônica narrada**, e a tabela de resultado no fim | A crônica é da fatia A; a tradução para os eventos do mundo é da D |
| D21 | Contagem no começo **(gameplay; dono)** | A batalha começa com uma **contagem de 3 s**: todos parados, podem **virar**, mas não andar nem atacar; a IA também. Regra da batalha: vale no laboratório, no mundo e no auto-resolve. Número provisório em `params/battle.json` | Dono, 2026-11-17, ao jogar o laboratório: sem ela, quem domina chega à luta com o aliado já morrendo, e a nota às cegas mediria a correria, não a latência. **Checkpoint da F5 (dono, 2026-11-20):** no fim da contagem vale só o que está apertado naquele instante (andar, atacar, largar, catar); o que foi apertado e solto durante ela é descartado, para um toque sem querer não derrubar a bolsa (plan §15, C15) |
| D20 | Dificuldade da IA **(gameplay; dono)** | Cada participante da IA tem uma **reação** no setup: fácil (600 ms), normal (250 ms) ou difícil (100 ms), mais a lista de gambits, que o laboratório já deixa editar. Números provisórios em `params/battle.json` | Dono, 2026-11-17, no checkpoint da F3: ficar preso na borda sob fogo é aceitável se a dificuldade do bot for configurável. Uma IA que aprende fica como proposta sem marco (GDD 06) |
| D22 | Primeiro passo imediato **(gameplay; dono)** | Parado, o creep dá o **primeiro passo no tick seguinte** ao comando de andar, e depois segue no ritmo do DNA. Cada toque na tecla anda uma célula; a velocidade média não muda (tocar não anda mais rápido que segurar) | Dono, 2026-11-18, no checkpoint da F5: o creep parado esperava o tempo de uma célula inteira (200 a 333 ms) antes de andar, e um toque mais curto se perdia; tocar a tecla várias vezes não movia o creep, e parar e voltar a andar parecia lento |

## 4. Escopo

### Dentro
- **`@geometrix/battle`:** estado, params (os stats de D6 e os números de D7–D9), setup, a arena em texto (D3), o
  passo com a regra de grade (D4, D5, D7–D11), os comandos (andar, virar, atacar, largar, catar, entrar), a
  validação, os eventos (D19), a visão para quem renderiza, `serialize` e hash, a IA de gambits com o vocabulário e
  os presets (D14, D15).
- **Toolchain:** as guardas de determinismo do lint e do tsconfig valendo para o pacote novo; o `verify` da batalha
  no CI (D18).
- **CLI:** `geo battle` com os confrontos em série, o relatório e o `verify` de um log (D16, D18).
- **Cliente:** a página do laboratório (D2): montar a batalha (arena, lados, participantes com DNA, HP inicial,
  carga e preset; seed), jogar dominando um participante (D12, D13), assistir, pausar, reiniciar, trocar a
  velocidade (×1, ×4, instantâneo), soltar um reforço (D11), editar os gambits (D15), o canal com latência e o modo
  às cegas (D17), a lista de eventos e o resultado (D19), exportar o log.
- **Visual:** o creep pela forma do DNA, com a direção para onde olha, a barra de HP e a carga; o relógio de
  inatividade da batalha perto de estourar; os projéteis; as pedras, a saída e os trechos de entrada; as pilhas; a contagem da
  fuga na borda.
- **Playtest:** perguntas do laboratório no [PLAYTEST.md](../../PLAYTEST.md).

### Fora
A junção com o mundo: o encontro abrindo a batalha, a bolha, o tempo do mundo durante a luta, os participantes
vindos do mundo, a tradução dos eventos para o `sim` (fatia D); os errantes e o lado neutro (D); a regra **livre**
(MOBA-lite) e a camada de **forja**, que o dono decide no checkpoint depois de ver a grade; predição no cliente
(volta à mesa na junção, dono, 2026-11-20; a F7 só experimenta desenhar o próprio creep adiantado, plan §15, C11); skills, energia, level e XP (M2.5); fog dentro da
batalha; terreno pelo entorno, rio, vau, árvores e estruturas na arena; fogo amigo; alianças entre lados; o
transporte real pela rede (WebSocket) e o servidor de batalha; a crônica narrada; replay de batalha na página.

## 5. Comportamento

Formato: *Quando [gatilho], o sistema deve [resposta].*

### Setup e estado (`battle`)
- **S-1** Quando uma batalha é criada a partir de um setup válido, cada participante deve nascer numa célula livre
  do trecho de entrada do seu lado (a zona de nascimento, D3), olhando para dentro da arena, com o HP atual e a
  carga do setup.
- **S-2** Um setup inválido (menos de dois lados, arena sem chão, lado sem trecho de entrada, HP fora de 1..máximo,
  carga acima da capacidade, mais participantes que células de entrada) deve ser recusado com o motivo, sem criar a
  batalha.
- **S-3** O estado deve ser só JSON, com ids de um contador nunca reaproveitados e arrays ordenados por id; o
  `serialize` deve recusar o resto.
- **S-4** Durante a contagem do começo (D21), todos devem ficar parados: o virar vale, do humano e da IA; andar e
  atacar não. No fim dela, deve valer só o que está apertado naquele instante; o que foi apertado e solto durante a
  contagem deve ser descartado (checkpoint da F5, C15).

### Movimento (`battle`)
- **M-1** A cada tick, um creep com ordem de andar deve acumular pontos pela velocidade de batalha do DNA, freada
  pela carga (D8), e entrar na célula vizinha quando completar o custo de uma célula. Um creep parado deve ter o
  passo seguinte pronto assim que tiver ficado parado o tempo de uma célula (D22): o primeiro passo sai no tick
  seguinte ao comando, e tocar a tecla não anda mais rápido que segurá-la.
- **M-2** Um creep não deve entrar numa célula de pedra nem numa célula ocupada; nesse caso, só vira.
- **M-3** Quando dois creeps completam o passo para a mesma célula no mesmo tick, o `rng` da batalha deve escolher
  quem entra; o outro fica e mantém os pontos. A ordem das chamadas ao `rng` deve ser fixa.

### Ataque (`battle`)
- **A-1** Um ataque só deve sair quando a recarga do atacante terminou; ele reinicia a recarga.
- **A-2** O ataque do quadrado deve acertar o inimigo na célula da frente, se houver; senão, erra.
- **A-3** O ataque do círculo e do triângulo deve criar um projétil na célula da frente, que avança pela velocidade
  do projétil, na direção do disparo, até acertar o primeiro inimigo, entrar numa pedra ou percorrer o alcance.
  Aliados do atirador não o bloqueiam.
- **A-4** Um golpe deve tirar o dano do atacante do HP de quem é atingido e zerar o relógio de inatividade da
  batalha (D9).
- **A-5** Quando o HP chega a 0, o creep deve sair da arena no mesmo tick, deixando a carga numa pilha (D8).

### Carga e pilhas (`battle`)
- **C-1** Largar a bolsa deve mover toda a carga do creep para a pilha da célula dele (somando com a que já houver).
- **C-2** Catar deve mover da pilha da célula para o creep até a capacidade livre, cristal primeiro; a pilha vazia
  sai do estado.

### Fuga, inatividade e fim (`battle`)
- **F-1** Um creep que fica numa célula de saída pelo tempo de saída, sem levar golpe, deve sair da batalha com o HP
  e a carga que tem. Um golpe deve zerar a contagem.
- **F-2** Quando o relógio de inatividade da batalha estoura (D9), todos os que estão na arena devem sair na hora,
  como em F-1, com o motivo "inatividade" no evento, e a batalha acaba sem vencedor.
- **F-3** Quando sobra no máximo um lado na arena, a batalha deve acabar: esse lado vence, ou ninguém, se a arena
  ficou vazia. O evento de fim deve trazer o desfecho de cada participante (venceu, morreu, fugiu pela borda, fugiu
  por inatividade), o HP final, o dano dado e recebido, e a carga com que saiu; e as pilhas que ficaram na arena.
- **F-4** Uma batalha acabada não deve aceitar comandos nem avançar.

### Entrada no meio da luta (`battle`)
- **E-1** O comando entrar deve pôr o participante novo numa célula livre do trecho de entrada do lado; um lado novo deve ganhar um trecho de entrada livre. Sem célula livre, a entrada
  deve ser recusada com o motivo.

### IA de gambits (`battle`)
- **G-1** A cada tick, para cada participante não dominado, a 1ª regra com condição verdadeira e ação possível deve
  virar os comandos do tick, escolhidos só pela visão da batalha. Sem regra válida, o creep fica parado.
- **G-2** Os comandos da IA devem passar pela mesma validação dos comandos do humano.
- **G-3** Os presets (D15) devem existir e ser os padrões do laboratório por DNA.

### Auto-resolve, CLI e determinismo
- **R-1** `geo battle` deve rodar os confrontos do relatório (§7) só com a IA e escrever o relatório em `runs/<id>/`.
- **R-2** Duas execuções do mesmo log e um snapshot → restore no meio devem dar o mesmo hash final.
- **R-3** O log exportado pelo laboratório deve dar, no `geo battle verify`, o hash que o *worker* calculou.

### Laboratório (cliente)
- **L-1** A página deve montar a batalha (D2): arena, de 2 a 4 lados, de 1 a 5 participantes por lado, com DNA, HP
  inicial, carga, preset, reação (D20) e seed.
- **L-2** O humano deve poder dominar um participante, trocar de participante ou não dominar nenhum a qualquer
  momento (D12), e jogar pelo teclado (D13).
- **L-3** Toda entrada do humano deve atravessar o canal simulado até o *worker*, e a página deve renderizar só o que
  volta pelo canal, sem predição (D17). **Checkpoint da F5 (2ª parte):** uma opção de experimento pode desenhar o
  creep dominado adiantado (C11); a simulação continua só no *worker*.
- **L-4** O seletor de RTT e o *jitter* devem valer na hora; o atraso medido entre a tecla e o efeito deve aparecer
  na tela.
- **L-5** No modo às cegas, o RTT de cada batalha deve ser sorteado do seletor e ficar escondido até o dono dar a
  nota. A página deve guardar o registro da sessão (setup, lado dominado, desfecho, RTT, nota), exportável, com o
  resumo nota × RTT.
- **L-6** O botão de reforço deve soltar um participante novo num lado existente ou num lado novo (D11).
- **L-7** O editor de gambits deve deixar escolher o preset e acrescentar, tirar e reordenar regras de um
  participante, e valer a partir do tick seguinte.
- **L-8** A tela deve deixar legível quem olha para onde, os projéteis, o HP, a carga, as pilhas, a saída, a
  contagem da fuga e o relógio de inatividade perto de estourar; e mostrar a lista de eventos e, no fim, a tabela
  de resultado. **Checkpoint da F5:** legível numa tela de notebook (a arena ocupa a largura disponível), com um
  sinal de quem ataca, de quem é atingido (e quanto) e de onde o projétil some sem acertar.

## 6. Parâmetros iniciais (chutes, para serem quebrados)

Nos params da batalha (`schema`, `default.json` e params fixos de teste). Os tempos são em segundos de batalha
(tempo real; na junção, a D decide quanto tempo do mundo isso vale).

| Parâmetro | Quadrado | Triângulo | Círculo |
|---|---|---|---|
| HP máximo | 300 | 200 | 120 |
| Dano | 30 | 20 | 24 |
| Alcance (células) | 1 (corpo a corpo) | 4 | 6 |
| Recarga do ataque | 1,0 s | 0,8 s | 0,8 s |
| Velocidade de batalha (células/s) | 3 | 4 | 5 |
| Velocidade do projétil (células/s) | — | 10 | 12 |
| Capacidade de carga | 30 | 20 | 10 |

O HP máximo e a capacidade são os do `sim` (spec da fatia A; GDD 02). Dano por segundo: 30, 25 e 30; de HP cheio,
o círculo mata o quadrado em 13 golpes e o quadrado mata o círculo em 4.

| Parâmetro | Chute |
|---|---|
| Ticks por segundo | 20 (ADR-0001: 20–30) |
| Freio da carga | linear, até 500‰ da velocidade com a bolsa cheia |
| Tempo na saída para fugir (D7) | 2 s |
| Relógio de inatividade (D9) | 15 s |
| Arena | 43 × 27 células, mais o anel de saída (2× a de 21 × 13, dono, 2026-11-17); uma aberta de 63 × 39 (3×) só para comparar no relatório |
| Zonas de nascimento | uma por lado, a 1/4 da largura (ou da altura) a partir da borda: opostas para 2 lados e espalhadas para 3 ou 4 |
| Reação da IA (D20) | fácil 600 ms, normal 250 ms, difícil 100 ms |
| Contagem no começo (D21) | 3 s |
| HP baixo nos presets (fugir) | 250‰ (dado da regra, não param) |
| Inimigo perto, no preset portador | 4 células (dado da regra) |
| RTT do canal | 0, 50, 100, 150, 200, 300 ms; *jitter* de ±20% do atraso de cada perna (constantes do laboratório) |

## 7. Harness e critérios de aceite

Os alvos são chutes. Quando um reprovar, o dono decide no checkpoint. **Desde o checkpoint da F3 (dono, 2026-11-17),
"o DNA não decide sozinho" e "duração" são só informativos:** o combate cru (só o ataque básico, sem skills, nível
e stats) não se balanceia agora. O laboratório serve para experimentar e validar as regras de combate candidatas,
cada uma evoluindo conforme entram as mecânicas em comum.

| Critério | Alvo | Como se mede |
|---|---|---|
| O DNA não decide sozinho | Em 1 × 1 de HP cheio, IA × IA, nenhum par de DNAs passa de 75% de vitórias **em todas as três arenas** (pode passar numa: a arena importa). O relatório traz a matriz por arena | `geo battle`, seeds 1–100 por confronto |
| O ferido pesa | O mesmo confronto com um lado a 500‰ do HP muda a taxa de vitórias a favor do outro; o relatório mostra quanto | `geo battle` |
| Duração | Mediana do 1 × 1 entre 15 s e 90 s; do 3 × 3, até 120 s. O relatório traz a distribuição | `geo battle` |
| Inatividade | Fração das batalhas que terminam por fugas por inatividade, por confronto. O dono julga se o impasse está sendo resolvido ou se está cortando lutas | `geo battle` |
| Fuga carregada | Taxa de fuga de um quadrado com a bolsa cheia contra um círculo, com e sem largar a bolsa, nas três arenas | `geo battle` |
| A micro importa | Nas sessões do dono, a taxa de vitórias dele dominando um lado é maior que a da IA no mesmo setup | Laboratório (relatório da sessão) + `geo battle` como base |
| Latência | A maior faixa de RTT em que a nota mediana do dono, às cegas, fica em 4 ou mais; a menor em que cai abaixo de 3 | Modo às cegas (D17), pelo menos 5 batalhas por RTT |
| Atraso medido | Tecla → efeito na tela ≈ RTT + 1 tick (+ o *jitter*), sem acúmulo ao longo da batalha | Laboratório (L-4) |
| Custo do auto-resolve | Um 3 × 3 de 120 s de batalha (2 400 ticks) resolvido em até 50 ms, mediana | `geo battle`, na máquina do dono |
| Determinismo | 2 execuções e snapshot → restore dão o mesmo hash; o log do laboratório dá na CLI o hash do *worker* | `geo battle verify` no CI |
| Regras | Cada regra de §5 com teste no pacote, em arenas desenhadas em texto | `npm run check` |
| Diversão | O dono responde às perguntas 1 a 4 da hipótese | Checkpoint |

## 8. Protocolo de teste

1. **Testes** (`battle`, `cli`, `client`): as regras de §5 em arenas de texto; o projétil que erra quem desviou; o
   corpo que bloqueia; a disputa da célula pelo `rng`; a fuga pela borda interrompida por um golpe; a inatividade;
   a entrada no meio; o fim com três lados; cada condição e ação dos gambits.
2. **Harness:** `geo battle` com a matriz de confrontos (1 × 1 de cada par e espelhos, 2 × 2, 3 × 3, 1 × 1 × 1; HP
   cheio e ferido; com e sem carga; as três arenas; seeds 1–100).
3. **Sessão do dono, livre:** jogar cada DNA contra a IA, assistir IA × IA, editar um gambit, soltar um reforço
   num 1 × 1. Perguntas do PLAYTEST (ex.: "você sabia por que perdeu?", "dava para ver o tiro chegando?", "qual DNA
   você quis jogar de novo?").
4. **Sessão do dono, às cegas:** pelo menos 5 batalhas por RTT, em ordem sorteada, com a nota ao fim de cada uma.
   **Um setup único** na sessão inteira (dono, 2026-11-17), o 1 × 1 dominando, para a nota medir o atraso e não o
   confronto.

### Critério para fechar a fatia
- Critérios da §7 verdes, ou o dono decide o que fazer com o que reprovou.
- O dono responde às perguntas 1 a 4 da hipótese no checkpoint, e decide se a próxima regra a experimentar é a
  livre, a forja ou nenhuma antes da junção.

## 9. Pré-requisitos antes do `plan.md`

- Aceite do dono nas decisões D1–D19 ✅ (2026-11-15); as de gameplay estão no GDD (02, 06, 07).
- **ADR-0008 — Pacote de batalha** ✅ `Accepted` (2026-11-15): pacote próprio, determinístico, sem importar o
  `sim`; params e versão próprios; a API de simulação com eventos fora do estado; a regra de combate como campo do
  setup; o laboratório como servidor local num *worker*, sem predição.
- O contrato com o mundo (a bolha, o tempo do mundo, a entrada vinda do mundo) é o ADR da fatia D.

## 10. Perguntas abertas

Nenhuma no momento.
