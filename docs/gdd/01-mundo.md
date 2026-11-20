# 01 — Mundo persistente e mapa

## Decidido
- A partida é um **mundo persistente que dura dias**: sandbox, construção e a camada RTS vivem aqui.
- Começa com times de 3 jogadores e pode crescer (o que leva a representantes, ver [04](04-governanca.md)).
- **Vitória: destruir a base inimiga.** A definição será aprofundada.
- **Direção de início de partida: "fundação"** (descrita abaixo). Os detalhes serão ajustados conforme os playtests
  revelarem o que é divertido.
- **Duração: hipótese inicial de 3 dias**, com faixa plausível de 1 dia a 1 semana. O valor definitivo só será
  fixado depois de testes controlados e observados.
- **Fog of war (M1.5, rodada de design de 2026-11-14).** Nenhum cliente, nem um bot, enxerga o estado completo; só
  o que o próprio time vê e lembra. A sincronização do [ADR-0006](../adr/0006-sync-do-mundo.md) (delta da visão de
  cada time, calculado no servidor) foi escolhida para isso.
  - **Quem dá visão:** o Núcleo e cada creep do time, num raio Manhattan, como o resto do `sim`. O raio do creep
    depende do DNA ([02](02-creeps-e-dominio.md)): círculo 6, triângulo 4, quadrado 3; o Núcleo vê 8. Números
    provisórios, nos params.
  - **Pedras bloqueiam a visão** (spec do fog, D1): a pedra é vista, o que está atrás dela não. Rio e vaus não
    bloqueiam.
  - **Névoa negra:** fora da própria visão, o time não conhece nada no início da partida: nem o terreno, nem os
    depósitos, nem o Núcleo inimigo.
  - **Do inimigo, dentro da visão:** os creeps (posição, DNA e carga), as estradas e as obras. Estoque, produção,
    upgrades, regras de piloto automático e ordem dos creeps inimigos ficam sempre escondidos.
  - **Memória do time:** os depósitos guardam o último valor visto; estradas e obras vistas continuam no mapa;
    creeps inimigos somem quando saem da visão.
  - **Caminho pelo que o time sabe:** uma célula nunca vista conta como jungle passável; quando o creep descobre
    pedra ou rio no caminho, recalcula. Nenhuma ordem revela terreno escondido.
  - **O que já foi visto e não muda fica conhecido:** o terreno explorado e a posição do Núcleo inimigo, depois de
    vistos, ficam no mapa do time.
  - **Três estados na tela:** nunca visto (negro), lembrado (esmaecido, com o último valor) e visível agora.
  - O piloto automático também decide só pelo que o time sabe ([07](07-piloto-automatico.md)).
- **Construções com HP no M2** (dono, 2026-11-15; registro no
  [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md)): o **Núcleo**, as **estradas prontas** e as **obras em
  andamento** têm HP e podem ser destruídos. O HP persiste e só se recupera com reparo pago
  ([03](03-economia-e-logistica.md)). As estradas são neutras, então qualquer lado pode derrubá-las, inclusive a que
  o inimigo usa.
- **O inimigo à vista no M2** (dono, 2026-11-15; [spec M2 do encontro](../specs/m2-encontro/spec.md) D18): além da posição, do DNA e da carga,
  o creep inimigo à vista mostra o **nome**, o **HP** e se está num encontro ou numa luta. Ferido, ele vira alvo.
- **Sem zona segura no M2, fatia A** (dono, 2026-11-15; spec D21): ninguém está a salvo perto do Núcleo; o harness
  mede se os creeps acampam na saída do Núcleo inimigo. Fica a previsão para os acampamentos e as estruturas
  neutras (ideias em incubação, abaixo).
- **Árvores destrutíveis no M2.5** (ideia do dono, 2026-11-15): vegetação que bloqueia a visão e pode ser derrubada,
  para aprofundar a jungle além das pedras de hoje. Entra com a jungle hostil.
- **O fim do mundo** (ideia do dono e rodada interativa, 2026-11-15; registro no
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §0):
  - **A duração vira um arco:** o mundo termina numa série de eventos apocalípticos que se desenvolvem durante a
    partida, com uma crônica por trás e um final explosivo ([08](08-cronica-chat-e-console.md)). Entra no **M2.5**
    ("A jungle hostil e o fim do mundo").
  - **Um apocalipse só: a corrupção dos depósitos de cristal esgotados**, que envenena quem está perto e cresce até
    cobrir o mapa ([03](03-economia-e-logistica.md)). As ondas de errantes e os chefões despertos entram como
    camadas por cima ([05](05-tribos-e-diplomacia.md)). Variedade por seed só se o playtest pedir.
  - **Ponto sem volta:** dependendo de quantos depósitos de cristal se esgotaram, o fim já é inevitável.
  - **A corrupção não pode ser limpa** pelos jogadores. Só o final feliz das tribos a detém, e ele **salva o mundo
    inteiro**, inclusive o inimigo ([05](05-tribos-e-diplomacia.md), M4). **Revisto na rodada 3 (2026-11-20):**
    as tribos são um dos três caminhos de salvação (abaixo).
  - **A corrupção é vista de longe:** ela brilha, e o time vê a borda mesmo fora da própria visão. É uma exceção ao
    fog, para avisar o fim (pilar 4).
  - **Vitória pírrica, com humor:** derrubar o Núcleo inimigo vence a guerra, mas não salva o mundo. Se o fim já é
    inevitável, nenhum creep sobrevive para virar lenda ([02](02-creeps-e-dominio.md)).
  - **Invasores:** as lendas de outros mundos podem invadir um mundo no fim, com uma crônica que explique quem chega
    e por quê. Marco novo **M5 — As lendas**, depois do M4.
  - **O fim mínimo no M2, fatia E:** a vitória pelo Núcleo encerra o mundo, e o fim ganha uma tela com o resultado e
    o resumo da crônica, e o replay, marcadores dos eventos principais. **Quando o relógio acaba sem Núcleo
    derrubado, é empate**, regra provisória até o apocalipse do M2.5 substituí-la.
- **O arco do mundo, a main quest line secreta** (dono, 2026-11-20, rodada 2 do [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §10.1; "deus" é o nome provisório do papel do jogador, a moldura
  da saga está em análise, §11):
  - o fim do mundo vira **o arco**, em atos, com **gatilhos** entre eles e **presets como ramos dentro da corrupção**
    (o apocalipse continua um só); o ramo responde à conduta dos deuses ([02](02-creeps-e-dominio.md));
  - **o mestre escolhe o preset de cada ato** até ele começar **e ajusta os gatilhos dentro dos limites** do preset;
    cada ajuste é um comando no log, e **o arco é revelado no fim**, com cada escolha do mestre;
  - **o segredo mora na instância**, não no conteúdo (o repositório é aberto): qual ramo, onde, quando e quem. **A
    história principal tem de ser entendida por quem joga às cegas**, pelo que o jogo mostra.
- **O ritmo e o fim** (dono, 2026-11-20, rodada 3 do [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §12.7; "deus" continua o nome provisório):
  - **as metas de ritmo são por ato**, com a duração esperada de cerca de um dia a ×1 cada, medidas no harness com
    bots de perfil (o ativo, o aprendiz, o de 15 min): no fim do ato I, o jogador converteu pelo menos 1 fiel e gerou
    pelo menos 1 crônica divina; no ato II, progride com quests, forma uma liga ou faz parte de uma e luta na jungle;
    no ato III, abrem-se os portais e os caminhos de salvação;
  - **os portais do ato III** trazem lendas geradas pela seed, como bots neutros, até existirem as lendas de mundos
    anteriores ([02](02-creeps-e-dominio.md)). **Revisto na rodada 4 (2026-11-20):** um portal só, no centro, com
    uma lenda (abaixo);
  - **três caminhos de salvação, como ramos do arco:** as tribos ([05](05-tribos-e-diplomacia.md)), o retornado
    ([02](02-creeps-e-dominio.md)) e os ramos especiais do ato III. Ninguém limpa a corrupção gastando recurso, e
    salvar salva o mundo inteiro, **ganhando ou perdendo a guerra**;
  - **os sem-Núcleo continuam:** com o arco, os creeps que sobrevivem à queda do próprio Núcleo seguem jogando até o
    fim do mundo, enquanto houver esperança de salvação, e viram lendas se sobreviverem. **Na fatia E, a queda do
    Núcleo continua encerrando o mundo**, como decidido.
- **A lenda do portal** (dono, 2026-11-20, rodada 4 do [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §13.7): **uma lenda só, gerada pela seed,
  chega por um portal no centro do mapa** quando o ato III abre (o centro é a posição justa no mapa espelhado). É
  experiente e não se converte fácil: o primeiro creep que interage com ela (de qualquer time) pode dialogar,
  persuadir, converter ou hostilizar. Ela converte **no primeiro diálogo**, quando está totalmente neutra, **ou depois
  de aniquilar** o creep ou o time contra quem ficou hostil. Antes de se converter, **ataca todos na luta**, como um
  lado próprio; os neutros comuns se afastam dela, menos os chefões e as elites. Convertida, **vira dominável**, com
  um **kit de lenda** único (de início, ~6) e um **kit de quest** correspondente, que **é um dos ramos especiais do ato
  III**. Morta, o ramo dela se fecha.

## Proposta

### Tempo como parâmetro
- Toda duração (coleta, produção, cerco, a partida inteira) é um **parâmetro de balanceamento** em dados, nunca uma
  constante no código.
- O relógio do mundo tem um **multiplicador**: uma partida de "3 dias" pode rodar em horas com bots e sem
  interface, ou em ritmo comprimido num playtest humano. É o que torna viáveis os testes controlados de duração.

### Início de partida: "fundação" (híbrido)
Cada time começa com um **Núcleo** (o coração da base; destruí-lo é a vitória) e uma população inicial, numa zona
de partida. Fora isso, o mapa é **só jungle**, com um **rio** cortando o mapa na horizontal. A base cresce a partir
do Núcleo conforme o time constrói.

- **Mapa gerado por seed, com simetria espelhada** dos dois lados do rio. Cada mundo é diferente, mas os dois times
  recebem condições equivalentes.
- **As lanes são construídas, não dadas.** Os times abrem estradas pela jungle e as rotas principais emergem das
  escolhas deles. O rio tem poucos pontos de travessia (vaus, pontes), que viram gargalos e palco natural de
  batalhas. A herança "3 lanes + 2 jungles" pode virar o *layout típico* de um mapa, não uma regra.
- **Draft de fundação** *(opcional)*: antes da partida, cada time monta a população inicial (mistura de DNAs:
  quadrados, círculos, triângulos) com um orçamento de pontos igual para os dois lados.

### Vitória num mundo de dias
- **Destruir a base é um processo, não um instante.** Um cerco ao Núcleo leva horas e avisa o time atacado. Sem
  isso, um time perde a partida enquanto dorme.
- A defesa offline vem de fortificações + piloto automático de defesa.

### O fim do mundo: como fazer (agente, 2026-11-15, não aprovado)
A direção está em Decidido; o detalhe, no [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §4.
- **Três atos:** a fundação, os sinais e o fim, com as fronteiras em ‰ da duração, nos params, e cada virada
  anunciada na crônica para todos.
- **Refúgios abaixo do limiar:** o ponto sem volta é um limiar em ‰ dos depósitos de cristal esgotados (params).
  Abaixo dele, a corrupção do ato 3 para antes de cobrir tudo, sobram refúgios e há sobreviventes; acima, o fim é
  total e só o final feliz salva. A crônica avisa a aproximação ("a terra geme") sem dar o número.
- **Epílogo acelerado:** a queda do Núcleo dispara a fase final mais cedo, para o fim chegar enquanto os jogadores
  ainda estão olhando. A tela de fim separa **a guerra** (quem venceu) e **o mundo** (sobreviveu? quantas lendas
  saíram dele?).
- **Eventos do fim mínimo** (fatia E): `coreDestroyed` e `worldEnded` (com o motivo), com o público "todos os
  times"; o `step` não roda depois do `worldEnded`; os marcadores do replay saem da lista de eventos.
- **Invasores só no ato 3, um por time, equilibrados:** responde em parte a "jogadores podem entrar num mundo em
  andamento?" (só como invasor, só no fim).

## Ideias em incubação (marco a decidir)
- **Acampamento e estruturas neutras** (ideia do dono, 2026-11-15, ao discutir a zona segura; a decidir "no momento
  adequado"; aumenta o escopo do M2, candidata à fatia E, cerco e reparo, ou a um marco depois):
  - o **Núcleo** é a primeira estrutura, e a única gratuita desde o começo, e serve de **acampamento** para os
    creeps do time;
  - outras estruturas, como **torres**, viram defesa: o creep acampado nelas ganha um **ataque a distância** (um
    projétil que viaja `n` células, com `n` e a velocidade do projétil relativos ao DNA e aos stats);
  - quem está acampado costuma ter vantagem de terreno e estratégica numa batalha, mas não foge mais fácil. Um
    creep pode começar uma batalha contra um adversário acampado, mas **quem está acampado não pode atacar nem
    abordar antes de sair da estrutura**;
  - **as torres são acampáveis pelos dois times**, não importa quem construiu; a exceção é o Núcleo do time
    adversário, que só pode ser atacado;
  - a flecha da torre seria, por enquanto, **a única mecânica de combate fora da instância de batalha**, direto no
    loop do mundo: cada flecha que acerta tira bastante HP do adversário perto da torre (rng com peso pelo DNA,
    stats etc.), sem abrir batalha;
  - pode dar um destino ao cristal (o papel do cristal é pergunta aberta no [03](03-economia-e-logistica.md));
  - **terreno de batalha pelo entorno:** batalhas que começam perto do rio, de árvores, pedras, estradas e
    estruturas (torre, Núcleo) podem ter cada uma o seu terreno, com objetos auxiliares, obstáculos, paredes e
    torres ([06](06-batalhas.md)).

## Perguntas abertas
- **Árvores (M2.5):** como bloqueiam a visão "de forma inteligente" (a árvore é vista e esconde o que está atrás,
  como a pedra? esconde só quem está dentro dela?), quem pode derrubar e o que custa.
- **Reparo:** quanto custa, quem repara e se é preciso estar no lugar.
- O Núcleo pode ser movido ou reconstruído? Pode existir mais de uma base por time?
- **Sem depósito garantido à vista no início** (névoa negra, 2026-11-14), o começo de partida fica lento ou
  desigual demais em alguma seed? Medir com os bots antes do playtest.
- Jogadores podem entrar num mundo já em andamento? (Proposta do agente para os invasores: só como invasor, no ato 3.)
- O que se pode construir e onde (só perto do Núcleo, em território controlado, em qualquer lugar)?
- O rio é só obstáculo, ou também é rota de transporte (barcos levam carga pesada mais rápido, mas ficam expostos)?
