# Consolidado: as ideias e o planejamento depois do M2

> **Status:** consolidação do agente (2026-11-20), pedida pelo dono. **Rodada 1 respondida (§0); rodada 2 respondida
> (§10.1); a moldura da saga está em análise, sem decisão (§11).** O documento junta a
> [proposta do ROADMAP](2026-11-20-roadmap-depois-do-m2.md) e as quatro levas de ideias do dia, registra a 5ª leva
> e faz a análise fria pedida: expectativa × realidade, benefícios × trade-offs e uma recomendação por ideia. **As
> perguntas foram refeitas aqui** (§7), em quatro grupos, só com o que é decisão do dono. As perguntas numeradas das
> levas ficam como histórico.

| Leva | Arquivo | O quê |
|---|---|---|
| 1ª | [roadmap-depois-do-m2](2026-11-20-roadmap-depois-do-m2.md) | O formato do ROADMAP, a fatia C, o próximo marco; o comandante, os anúncios, o som, a IA que aprende |
| 2ª | [mestre-ligas-arena](2026-11-20-mestre-ligas-arena.md) | O mestre da mesa, as ligas, a arena pelo encontro |
| 3ª | [itens-reputacao-governanca](2026-11-20-itens-reputacao-governanca.md) | O teto da liga, a reputação e o Núcleo, a skill que vem do item, o regime do time |
| 4ª | [recrutamento-lacos-traits](2026-11-20-recrutamento-lacos-traits.md) | O recrutamento por diálogo, os laços, os traits com kits de crônica |
| 5ª | este arquivo, §2 | A liga por creep líder e o símbolo, os itens iguais para todos, os títulos, a instância de quest, o laboratório |

## 0. Respostas do dono (rodada interativa, 2026-11-20)

Quatro grupos, num formulário por grupo, com o contexto de cada um no chat antes. **O dono aceitou as recomendações
em 15 das 16 perguntas; na 13, escolheu o híbrido.** As decisões foram para o [ROADMAP](../ROADMAP.md) (reescrito no
formato de banco por tema) e para os GDD 02, 03, 04, 05, 06, 07 e 08.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | O formato do ROADMAP | **O banco por tema:** o marco atual, o próximo e o banco sem número |
| 2 | A fatia C | **Sai do M2** para o tema "Comunicação e automação" |
| 3 | O próximo marco | **Os itens** (candidato, confirmado no checkpoint do M2), com a identidade simbólica em paralelo, se o dono quiser |
| 4 | A instância de quest | **Uma batalha com objetivo**, no mesmo pacote, com um modo de cenário no laboratório, depois dos itens |
| 5 | A arena na D | **O mínimo:** escolhida entre as três do laboratório pelo terreno; o snapshot leva o recorte |
| 6 | A direção vira posição | **Nos três casos:** começo, entrada no meio e fuga |
| 7 | O mandato do mestre | **Neutro, sem mexer no placar** |
| 8 | A cadeira do mestre | **Um diretor-bot sempre, com a cadeira aberta a um humano;** na D, o lado neutro aceita um controlador |
| 9 | O controle da liga | **Piloto de grupo:** o líder pelo humano, os seguidores na formação pelos gambits, até 3 ordens |
| 10 | O recrutamento | **Diálogo, quase sempre pela fama;** a side-quest para os traits raros |
| 11 | O símbolo da liga | **Só identidade, por ora;** o estandarte com os itens |
| 12 | Laços e luto | **Simbólicos primeiro;** o efeito mecânico quando o playtest pedir |
| 13 | A progressão | **Híbrido:** o DNA dá uma skill natural, os itens dão as outras, e o level do creep continua, com peso menor (revê o decidido do GDD 02) |
| 14 | O Núcleo | **A forja e o cofre** |
| 15 | Os títulos | **Conquistados e disputados** |
| 16 | O regime do time | **Direção registrada;** qual vem primeiro, quando houver times de humanos |

**Consequências que o agente registrou:**

- **O híbrido traz de volta o teto da liga pelo level do líder** (a ideia original do dono na 3ª leva).
- **A fatia D herda:** a arena mínima pelo encontro, a direção nos três casos, e as três restrições de contrato (o lado
  neutro com um controlador, a posição no mundo e o recorte no snapshot, o inventário e a pilha prontos para itens).
- **O resto da §3 ao §6 abaixo é a análise que levou às perguntas.** Onde ela recomenda "o poder no item", vale o
  híbrido.

## 1. O retrato [agente]

Somadas, as ideias descrevem um jogo maior que o MVP: o mundo de economia (RTS) e a batalha em grade (MOBA-lite), com
um **RPG de grupo** por cima (ligas, itens, personagens) e uma **camada social** (regime, mestre, diplomacia). Elas
se encaixam num desenho só:

```mermaid
flowchart TB
    CR["Crônica<br/>(eventos do sim)"] --> FAMA["Fama e títulos<br/>(do creep)"]
    CR --> LAC["Laços<br/>(entre creeps)"]
    TR["Traits + kits<br/>(ao nascer)"] --> REC
    FAMA --> REC["Recrutamento<br/>(diálogo)"]
    LAC --> REC
    REC --> LIGA["Liga<br/>(um creep líder, símbolo)"]
    NUC["Núcleo: forja e cofre"] --> IT["Itens<br/>(a skill vem do item)"]
    CRI["Cristal"] --> NUC
    IT --> BAT
    LIGA --> BAT["Batalha<br/>(arena pelo encontro)"]
    NEU["Lado neutro<br/>(mestre: diretor-bot ou humano)"] --> BAT
    BAT -- "itens caem no despojo,<br/>morte permanente" --> CR
    FAMA --> GOV["Regime do time"]
```

**A tese que amarra tudo** (3ª leva): **o poder fica no item** (físico, perigoso, pode ser perdido), e **a identidade
fica no creep** (nome, trait, fama, títulos, laços). A crônica é a matéria-prima da identidade, e quase tudo nela é
uma leitura de eventos que o `sim` já emite.

## 2. A 5ª leva [dono e agente]

### 2.1 A liga é de um creep líder, não de um jogador; e tem símbolo

**[dono]** A liga não precisa ser uma por jogador: faz mais sentido ser uma por creep que virou líder ao ser dominado.
Se o jogador soltar o creep, ele continua atuando como líder pelos gambits. Cada liga tem um símbolo (bandeira,
tatuagem ou algo assim) que a diferencia e dá identidade visual, para identificar os membros de uma liga específica,
inclusive de inimigos e de tribos neutras. "Faz sentido?"

**[agente]** Faz, e resolve a pergunta 8 da 2ª leva (a liga sem humano) do jeito que eu recomendava. Consequências:

- **Um jogador pode ter várias ligas ao longo da partida:** domina um líder, recruta, solta, domina outro. O teto
  vem da economia (cada seguidor sai da coleta) e do teto de cada liga.
- **A liga sobrevive ao líder?** Proposta: o **símbolo é da liga, não do líder**. Se o líder morre, a liga fica sem
  líder, e os membros voltam às regras de antes. Quem dominar um membro pode assumir a liga e o símbolo. A crônica
  conta ("a Liga do Triângulo Partido tem um novo líder").
- **O símbolo na geometria (pilar 6):** uma marca pequena dentro da forma do creep (um ponto, uma barra, um anel, um
  ângulo), de um catálogo curto e bem distinto, para ser legível no zoom afastado. A cor continua sendo do time; o
  símbolo é da liga. O inimigo só reconhece a liga quando a vê (o fog vale), e o time inimigo passa a lembrar das
  ligas ("a liga do anel de novo").
- **O símbolo e o estandarte:** o símbolo pode ser só identidade, ou virar um **estandarte**, um item que o líder
  carrega, que cai e pode ser roubado (3ª leva, §1). A recomendação fria é começar pelo símbolo como identidade e
  deixar o estandarte para quando houver itens (§7, grupo 3).

### 2.2 Itens: o mesmo efeito para todos, com simbioses; presets e dicas

**[dono]** Cada item faz o mesmo efeito para todos, e alguns criam efeitos simbióticos com DNAs específicos. Presets
de itens e evoluções para os bots e na interface, para o jogador casual, de acordo com o creep dominado (como no Dota
2, que tem até presets da comunidade e ranking). Começar simples: oferecer os itens com uma nota de dicas para
escolher, do jeito mais amigável e menos denso possível.

**[agente]** Isso **decide a pergunta 16** (o item e o DNA) contra a minha recomendação, e com razão na análise fria:
um efeito por item e algumas simbioses é muito mais barato de balancear e de ensinar do que três efeitos por item.

- **A simbiose é a exceção que dá sabor:** ex.: um gancho puxa o inimigo para qualquer DNA, mas no quadrado ele
  ainda o atordoa. Poucas simbioses, cada uma com um porquê na forma.
- **O preset do bot é a dica do humano:** o bot precisa de presets de itens de qualquer jeito, para equipar os
  próprios creeps. A mesma fonte vira a sugestão da interface ("para um ● batedor: o gancho; ele foge melhor"). Uma
  fonte, dois usos, e o texto é uma linha.
- **Presets da comunidade e ranking** pedem contas e um servidor público: ficam com o deploy entre mundos (o control
  plane, tema "As lendas e o deploy").

### 2.3 Títulos

**[dono]** Completar quests, vencer batalhas e o desenvolvimento natural das crônicas individuais geram títulos. No
começo, só simbólicos, usados na crônica ("O Rei Batedor, Fulano"). Talvez dinâmicos; aberto a ideias melhores.

**[agente]** É a ideia de **melhor sabor por custo** da lista: regras sobre os feitos que a crônica já registra, e o
texto no cliente. Dois tipos:

- **Conquistados** (permanentes): por um feito único ("Matador do Chefão do Rio", "Sobrevivente do Vau").
- **Disputados** (dinâmicos): o melhor do mundo num feito agora ("O Rei Batedor" é quem mais explorou). Passam para
  quem superar, e a crônica conta a troca ("Fulano perdeu o título de Rei Batedor para Sicrano"). Cria rivalidade, e
  a perda de um título também é história.
- **O risco é a inflação:** se todo creep tem título, nenhum vale. Os disputados são um por feito no mundo; os
  conquistados pedem feitos raros. As lendas levam os títulos para o próximo mundo.

### 2.4 A instância de quest e o laboratório de cenários

**[dono]** Uma "instância de quest" criada a partir do mundo, como a de combate, mas voltada a cenários (kits) de
quest que se adaptam ao mundo gerado e às zonas e arenas. Com gameplay próprio, e um laboratório de experimentos
para os kits de quest.

**[agente]** A análise fria está na §3 (linha da instância de quest). Em resumo: **um motor novo de quest é o
item mais caro da lista** (a fatia B levou 8 fases só para a batalha). O caminho barato é que **o cenário seja uma
batalha com objetivo** em vez de aniquilação: escoltar alguém até a saída, segurar uma área por um tempo, recuperar
um item no meio da arena, sobreviver a ondas. É o mesmo pacote de batalha, com a arena pelo encontro (2ª leva) e um
**modo de cenário no laboratório que já existe**. Isso dá ao mestre (2ª leva) algo para lançar quando o mundo está
parado.

### 2.5 O laboratório e a análise fria

**[dono]** O laboratório vai ajudar muito no balanceamento e no playtest humano quando entrarem os itens e as skills,
mas as ideias precisam ser analisadas com calma e friamente.

**[agente]** Concordo, com um limite: **o laboratório responde "é divertido de jogar?" e "o bot quebra?", mas não
responde "o sistema social funciona?"**. Itens, skills, ligas contra o bot e cenários se testam lá. O regime, o mestre
humano, várias ligas por time e o comandante do time só se testam com várias pessoas.

## 3. Expectativa × realidade [agente]

| Ideia | O que se espera | O que custa de verdade | A favor | Contra | Recomendação |
|---|---|---|---|---|---|
| **Arena pelo encontro** | A batalha representa o lugar e a aproximação | O mínimo é barato (escolher entre as 3 arenas do laboratório pelo terreno; nascer pela direção). O gerador é médio. Ser fiel ao rio e à estrada pede regras novas | O pilar 1 chega à batalha: a aproximação no mundo decide a posição. Dá sentido ao nome do M2 | A arena gerada pode ser injusta no espelho e perde a familiaridade das 3 arenas conhecidas | **O mínimo na D**; o gerador no banco |
| **Mestre da mesa** | O mundo nunca fica parado; chefões nas mãos de um humano | O diretor-bot é a curva dos errantes crescida (barato). A cadeira humana pede uma pessoa a mais, uma visão "deus" no cliente, permissões, regras contra conluio, e só se testa com 3 pessoas ou mais | Pilar 4; uma ferramenta de playtest para o dono | O mestre decidindo o vencedor (*kingmaking*); um mestre humano entediado | **Restrição no ADR do lado neutro na D** (custo quase zero); o diretor-bot na jungle hostil; a cadeira humana quando houver olhos novos |
| **Ligas** | Batalhas maiores e mais humanas; escolta | Seguir em formação custa no tick do mundo; 10 × 10 × 10 passa dos limites de hoje (4 lados, 5 por lado) e tem custo de auto-resolve a medir; 30 creeps na tela pesam na leitura | Pilar 3 em escala; uso para o recurso que sobra; identidade pelo símbolo | **Com 10 seguidores pelos gambits, a micro do humano pesa menos na batalha** (pilar 1, "a batalha, na micro"); ataque básico em massa pode virar bagunça | Piloto de grupo com até 3 ordens; liga por creep líder (dono). **Melhor depois dos itens**, que dão o que fazer a cada membro |
| **Recrutamento por diálogo** | Cada recruta é uma história | Conteúdo (kits), checagem das side-quests por eventos, a tela de diálogo. **No 20º recruta, persuadir um por um vira tarefa** | Momento de jogo; usa a fama | Atrito para o casual; repetição | **Diálogo, mas a maioria aceita pela fama**; a side-quest fica para os traits raros |
| **Laços, buffs e luto** | Camaradagem que nasce sozinha | Estado por par (limitado), regras de buff a balancear, e o "por que meu creep fugiu?" (luto) a explicar | Pilar 3; a morte permanente dói | Mais uma camada de números invisíveis, que se soma a itens e traits | **Simbólico primeiro:** o laço na ficha e na crônica; o efeito mecânico só depois do playtest |
| **Traits com kits** | Personagens únicos por seed | **O gargalo é o conteúdo:** 6 a 8 traits ficam repetitivos num mundo com centenas de creeps; a combinação trait × origem × side-quest ajuda | Barato no `sim` (ids e parâmetros); só depende do encontro | Escrita contínua | **Cedo e pequeno**; a escrita cresce com um LLM offline |
| **Títulos** | "O Rei Batedor, Fulano" | Barato: regras sobre os feitos, o texto no cliente | Muito sabor por pouco custo; liga a crônica e as lendas | Inflação de títulos | **Cedo, simbólicos**, conquistados e disputados |
| **Fama** | Pesa na diplomacia, no recrutamento e no regime | Barata (leitura da crônica), mas o peso de cada feito pede balanceamento | É a base dos títulos e do recrutamento | **Bola de neve:** quem vence ganha fama, recruta mais e vence mais | Simples, que cai com derrotas e com o tempo |
| **Itens com skills** | Progressão perigosa e simples, à Dota; o cristal ganha papel | **O maior sistema da lista:** catálogo, cada skill é uma regra de combate nova que a IA de gambits precisa aprender a usar ("toda regra nova precisa da sua IA"), a forja, a interface de escolha. Revisa o decidido do GDD 02 | Um catálogo só para skill, item e progressão; pilar 2 (o poder se rouba); sumidouro; o papel do cristal | **Bola de neve:** quem vence pega os itens de quem perdeu. Pede durabilidade e despojo disputado | **Candidato a próximo marco**, primeiro no laboratório (como o combate), depois no mundo |
| **Presets e dicas** | O casual escolhe sem ler | O preset do bot já é necessário; mostrar uma linha de dica é barato. Comunidade e ranking pedem contas | Uma fonte para o bot e o humano | — | **Com os itens**; a comunidade, com o deploy |
| **Regime do time** | Governança interessante | **Só se testa com vários humanos por time**, e hoje o dono joga sozinho | Pilar 5; o time escolhe a burocracia | Decidir agora é decidir sem o playtest | **Registrar como direção** e escolher o primeiro regime quando houver times de humanos |
| **Instância de quest** | Quests com gameplay próprio, adaptadas ao mundo | Um motor e um laboratório novos, com IA para cada cenário, e conteúdo pesado. A fatia B levou 8 fases | Variedade; algo para os momentos parados (o mestre) | Divide o jogo em "masmorras", longe dos verbos do mundo | **O cenário é uma batalha com objetivo**, num modo do laboratório que já existe, depois dos itens |
| **Comandante do time, várias ligas por time** | Tática coletiva | Pede times de humanos | Pilar 5 | Não dá para testar sozinho | Com o tema "O time", depois do deploy |

**Três lições de conjunto:**

1. **O gargalo é conteúdo e playtest, não engenharia.** Itens, traits, kits, títulos e cenários são catálogos: cada
   um pede escrita e balanceamento. E as rodadas de design e os playtests são do dono, um de cada vez.
2. **Simbólico antes de mecânico.** O dono já propôs isso para os títulos. Vale para laços, traits e símbolos: primeiro
   na ficha e na crônica, que custam pouco e mostram se o jogador se importa; o efeito mecânico entra quando o playtest
   pedir.
3. **Quase tudo premia quem vence** (itens, fama, títulos, laços, recrutamento). A pergunta do M2 é "a batalha muda o
   rumo do mundo **sem dominar o jogo**?", e essas camadas puxam para o "dominar". Cada uma precisa da sua perda: a
   durabilidade, a morte permanente, a fama que cai, o título disputado.

## 4. O que só se testa com mais gente [agente]

| Dá para o dono testar sozinho (contra o bot, no laboratório) | Pede outros humanos |
|---|---|
| Arena pelo encontro, itens e skills, presets, uma liga contra o bot, traits, títulos, fama, laços na crônica, cenários de quest, o mestre como diretor-bot | O regime do time, o mestre humano, várias ligas por time, o comandante do time, os presets da comunidade |

É o critério mais forte para a ordem: **o que o dono pode testar sozinho vem antes**, porque o deploy e os olhos
novos esperam a junção e a diversão.

## 5. O planejamento revisto [agente]

**O formato** continua o da 1ª leva: o ROADMAP mostra os marcos concluídos, o atual e o próximo (com uma pergunta), e
o resto vira um banco de ideias por tema, sem número. A novidade é a ordem do banco como **grafo de dependências**,
para o dono escolher o próximo marco vendo o que cada tema destrava.

**O M2 fecha com a D e a E:**

- **D — A junção**, com três restrições baratas que as ideias pedem, sem construir nenhuma: o lado neutro aceita um
  controlador (o mestre); o snapshot leva a posição de cada creep no mundo e o recorte do terreno; o inventário e a
  pilha da arena não supõem que só existem matéria e cristal (os itens). E, se o dono quiser, a arena mínima (escolhida
  pelo terreno, nascimento pela direção).
- **E — Cerco, reparo e o fim mínimo**, como está.
- **A C** (chat, console, macros) vai para o banco, a não ser que o dono a queira no M2.

**O próximo marco** (recomendação): **Os itens**, com a pergunta "**Um item que se ganha e se perde dá motivo para
lutar e para voltar ao jogo?**". Ele entra pelo laboratório (os itens e as skills na batalha, contra o bot), depois no
mundo (a forja no Núcleo, o cristal, o despojo, os presets do bot como dica). Por quê:

- é o pré-requisito para balancear o combate (decidido: "não se balanceia combate cru antes de skills, nível e
  stats");
- dá ao cristal o papel que falta e um motivo para emboscar;
- muda o que um creep é, e as ligas (o estandarte, o que cada membro faz) se desenham melhor depois dele;
- o dono testa sozinho.

**Em paralelo e barato** (uma fatia pequena, se o dono quiser): **a identidade simbólica**, com traits na voz da
crônica, fama e títulos. Só depende do encontro, não mexe no combate e mostra cedo se o jogador se importa com os
personagens.

**As alternativas para o próximo marco:** as ligas (batalhas maiores logo depois da junção), ou o fim do mundo (o
clímax da partida, que depende da rodada do cristal e da E).

```mermaid
flowchart TD
    D["M2 · D<br/>a junção (+ arena mínima,<br/>restrições do contrato)"] --> E["M2 · E<br/>o fim mínimo"]
    D --> IT["Os itens<br/>(lab → mundo; forja, presets)"]
    A["M2 · A (feito)<br/>o encontro e a crônica"] --> ID["Identidade simbólica<br/>(traits, fama, títulos)"]
    IT --> LG["As ligas<br/>(líder, símbolo, recrutamento pela fama)"]
    ID --> LG
    LG --> PS["Os personagens mecânicos<br/>(laços, kits, side-quests, luto)"]
    IT --> JH["A jungle hostil<br/>(chefões com skills; mestre diretor-bot)"]
    D --> JH
    IT --> QC["Cenários de quest<br/>(batalha com objetivo)"]
    E --> FM["O fim do mundo<br/>(corrupção; depois da rodada do cristal)"]
    IT --> FM
    JH --> MV["O mundo vivo<br/>(tribos, reputação com tribos, final feliz)"]
    QC --> MV
    DEP["Deploy e olhos novos"] --> TM["O time<br/>(3v3, regime, comandante, várias ligas,<br/>mestre humano)"]
    LG --> TM
    MV --> LE["As lendas e o deploy<br/>(invasões, contas, comunidade)"]
    FM --> LE
```

### Os temas do banco, consolidados

| Tema | O que entra | Pede humanos? |
|---|---|---|
| **Os itens** | A skill vem do item (o mesmo efeito para todos, algumas simbioses com DNAs), a forja e o cofre no Núcleo, o cristal como ingrediente, a durabilidade, os presets do bot como dica, o laboratório de itens, o golpe crítico como propriedade de item | Não |
| **Os personagens** | Traits com kits de crônica, fama, títulos (conquistados e disputados), laços, side-quests pessoais, luto e vingança, renomear | Não |
| **As ligas** | Liga por creep líder, que continua pelos gambits quando solto; símbolo; formação pelo DNA; até 3 ordens; recrutamento por diálogo; o teto que cresce; o estandarte (com os itens); 10 × 10 × 10 | Não (uma liga contra o bot) |
| **A batalha** | A arena gerada pelo recorte e o tamanho por faixa, a IA que aprende, regras novas (livre), acampamentos e torres | Não |
| **Cenários de quest** | A batalha com objetivo (escoltar, segurar, recuperar, sobreviver), o modo de cenário no laboratório | Não |
| **A jungle hostil** | Chefões, buffs e artefato, árvores, a curva dos errantes por ato, o mestre como diretor-bot | Não |
| **O fim do mundo** | Corrupção, ponto sem volta, vitória pírrica, crônica do fim, registro das lendas | Não |
| **O mundo vivo** | Tribos, diplomacia e reputação com as tribos, o final feliz, construção ampla | Não |
| **Comunicação e automação** | Chat, console, macros (a fatia C), piloto scriptável | Em parte (o chat) |
| **A apresentação** | Som, anúncios de abate e de fuga, a tela de fim e o replay além do mínimo | Não |
| **O time** | 3v3, impostos, regime (democracia ou meritocracia), o comandante do time, várias ligas por time, genética, o mestre humano | **Sim** |
| **As lendas e o deploy** | Invasões, contas, o control plane, presets da comunidade e ranking, deploy de testes, olhos novos | **Sim** |

## 6. O que o agente decide ou propõe sem perguntar [agente]

São propostas, a validar em playtest ou na spec de cada tema. O dono pode vetar qualquer uma:

- **Itens e DNA:** o mesmo efeito para todos, com poucas simbioses (decidido pelo dono na 5ª leva; fecha a pergunta 16).
- **A liga sem humano:** o líder solto continua pelos gambits (decidido pelo dono na 5ª leva; fecha a pergunta 8).
- **A liga sem líder:** se o líder morre, os membros voltam às próprias regras, e a liga e o símbolo ficam para quem
  assumir (fecha a pergunta 9).
- **O teto da liga** começa em 1 seguidor e cresce. A fonte (o level, a fama ou o estandarte) se decide com os itens
  (pergunta 12).
- **A reputação em duas camadas:** a fama do creep e a relação do time com cada tribo (pergunta 13).
- **A side-quest pelo piloto** quando o jogador sai (pilar 4; pergunta 19).
- **De onde vêm os laços,** quantos níveis e quantos cada creep guarda (perguntas 20 e 23): detalhes que o playtest
  ajusta.
- **O texto da crônica, dos traits e dos títulos fica no cliente;** o `sim` guarda ids e parâmetros.
- **Sem *streaming* de arena;** o gerador mora na camada da junção, não no pacote de batalha.
- **O símbolo da liga** é uma marca geométrica dentro da forma, num catálogo curto, e respeita o fog.

## 7. As perguntas para o dono

Dezesseis perguntas em quatro grupos, só com decisões de design ou de plano. Entre parênteses, as perguntas antigas
que cada uma substitui.

**Grupo 1: o plano**

1. O formato do ROADMAP: o marco atual, o próximo e o banco por tema (1)
2. A fatia C sai do M2 ou fica (2)
3. O próximo marco (3)
4. A instância de quest: um cenário de batalha com objetivo, ou um sistema próprio (5ª leva)

**Grupo 2: a D e o mestre**

5. Quanto da arena entra na D (11)
6. A direção no mundo vira posição na arena: no começo, na entrada e na fuga (10)
7. O mandato do mestre: neutro sem mexer no placar, pesar contra quem lidera, livre, ou antagonista (4 e 5)
8. A cadeira do mestre: um diretor-bot sempre, com a cadeira aberta a um humano, ou só humano (6)

**Grupo 3: as ligas e os personagens**

9. A liga como piloto de grupo, com até 3 ordens, ou o controle de RTS (7)
10. O recrutamento: diálogo com a maioria aceitando pela fama, side-quest para cada um, automático, ou clique (18)
11. O símbolo: só identidade, ou já um estandarte físico (5ª leva)
12. Laços e luto: simbólicos primeiro, já mecânicos, ou só crônica para sempre (21 e 22)

**Grupo 4: itens, Núcleo, títulos e regime**

13. A revisão da progressão: o poder no item e a identidade no creep, o híbrido, ou manter o decidido (15)
14. A utilidade nova do Núcleo (14)
15. Os títulos: conquistados e disputados, ou só um dos tipos (5ª leva)
16. O regime do time: registrar a direção e decidir quando houver times de humanos, ou já escolher o primeiro (17)

---

# Rodada 2: os deuses e o arco do mundo

> A 6ª leva (dono, 2026-11-20, depois da rodada 1) mexe no modelo de reputação, no mestre e no fim do mundo. **Onde
> esta parte conflitar com as §1 a §7, vale esta.** As decisões da rodada 1 (§0) continuam valendo; o que esta
> parte propõe mudar nelas está marcado e vai para as perguntas da §10.

## 8. A 6ª leva [dono e agente]

### 8.1 O pedido [dono]

Com o Black & White como referência (um RTS em que os jogadores são deuses que podem evoluir para o bem ou para o
mal):

1. **O jogador entra na crônica como um deus.** O nome dele fica gravado naquele mundo e gera uma história no fim da
   partida. **Jogadores malvados conseguem recursos com mais facilidade e rapidez desde o começo**, o que o mestre da
   mesa tem de equilibrar de forma justa e imparcial. Daí, um conceito de **karma** ou **honra**, que pode definir a
   progressão da *main quest line*.
2. **Uma main quest line secreta**, que só o mestre conhece e pode ajustar: as regras que disparam a passagem entre os
   atos (I → II → III) e **presets de main quest line**, escolhidos na criação do mundo ou durante o jogo, até o ato
   correspondente ficar ativo (como a passagem de era do Age of Empires, em que se escolhe um caminho). O mestre
   decide durante o jogo, conforme a crônica se desenvolve.
3. **Uma interface para observar a crônica de um creep**, com um resumo que deixe o mestre bater o olho no que pesa
   na decisão.
4. **Tributos pela influência:** jogadores, ou "deuses" de uma tribo, coletam tributos conforme a influência
   (conquistada por domínio, por conversões via diálogo etc.). A **influência** do jogador vem da crônica dos eventos
   dele (talvez substituindo ou complementando o karma) e pesa até no poder de domínio sobre os creeps.
   - **Pesam contra:** ficar inativo dominando um creep; fugir de uma batalha (sem ser a fuga automática por
     inatividade); coisas do tipo.
   - **Pesam a favor:** o domínio ativo; converter fiéis e gerar entradas na crônica do jogador no mundo.

### 8.2 A leitura fria [agente]

- **Encaixa no que o jogo já é.** Dominar um creep já é "possuir" um corpo, como um deus. O pilar 3 ganha um segundo
  herói: o creep é o herói da batalha, e o jogador é o deus da história. E **o `sim` já tem o jogador como entidade**
  (`Player { id, team, bot }`, em `domination.ts`): a influência e a conduta dele são uma leitura dos eventos pelo id
  do jogador, como a fama e os laços.
- **O pilar 4, bem resolvido pelo próprio dono:** o que pesa contra é a inatividade **dominando**, não a ausência.
  Quem sai do jogo e deixa o piloto não perde nada; quem segura um creep e não faz nada, sim.
- **O risco principal é o pilar 1:** "o mal ganha recursos mais rápido" vira a estratégia dominante se o bem não tiver
  um retorno do mesmo tamanho. No Black & White, os dois caminhos são viáveis porque cada um abre e fecha portas.
- **O segundo risco é a sopa de números:** fama, laços, influência, karma, relação com as tribos. Sem um modelo, o
  jogador não entende nenhum. A §8.3 junta tudo em três escalas.
- **O terceiro é a confiança no mestre:** um humano que ajusta regras secretas no meio da partida pode favorecer
  alguém sem ninguém ver.

### 8.3 O modelo recomendado: três escalas [agente]

Substitui a "reputação em duas camadas" da 3ª leva:

| Escala | O quê | De onde vem | Para que serve |
|---|---|---|---|
| **O creep** | **Fama** (e títulos, laços) | Os feitos dele na crônica | Recrutar (o líder famoso), títulos, a ficha, as lendas |
| **O jogador (o deus)** | **Influência** (quanto ele pesa) | O domínio ativo, as conversões, os feitos dos creeps que dominou; contra: inatividade dominando, abandonar aliados | Dominar creeps famosos, os tributos, o peso no regime do time |
| **O jogador (o deus)** | **Conduta** (o karma: do benevolente ao cruel) | O tipo das ações: extorquir, atacar quem pagou, matar quem fugia (cruel); poupar, cumprir quests, salvar (benevolente) | O caminho da main quest line, a relação com as tribos, a história no fim |
| **O time × cada tribo** | **Relação** (a diplomacia) | A conduta dos deuses do time e as ações diretas com a tribo | Comércio, quests, alianças, tributos |

- **Influência e conduta são eixos diferentes**, como no Black & White (a crença e o alinhamento): dá para ser um deus
  muito influente e cruel, ou pouco influente e benevolente. "Karma" e "influência" se complementam, não se
  substituem.
- **A influência é um peso, não uma moeda** (recomendação): não se gasta. Uma moeda divina pediria um sistema de
  milagres, que ninguém propôs.
- **Os tributos vão para o tesouro do time**, com o crédito da influência para o deus que converteu. Uma carteira do
  jogador seria um terceiro nível de economia, além do inventário do creep e do tesouro (GDD 03, decidido). E o
  tributo é físico: uma caravana da tribo traz, e ela pode ser emboscada (pilar 2).
- **A influência no domínio** (recomendação): dominar um creep famoso pede um deus com influência. Liga as duas
  escalas sem mexer no domínio comum (os parâmetros de custo, cooldown e distância já existem, em zero).
- **A fuga** (contraponto ao dono): recuar está **decidido** como possível, com custo (largar a bolsa), e a fuga é
  parte da emboscada. Se toda fuga tirar influência, o jogador para de recuar quando deveria. Recomendação: pesa
  contra só a fuga que **abandona aliados que ainda lutam** (a mesma ideia do laço "não foge enquanto o amigo luta").

### 8.4 Cruel × benevolente: o equilíbrio pelas regras [agente]

| Caminho | Ganha | Perde |
|---|---|---|
| **Cruel** | Recursos cedo e rápido: extorsão, saque, tributo pelo medo | As tribos ficam hostis; o ramo benevolente da main quest line se fecha (o final feliz); a crônica conta |
| **Benevolente** | O que dura: tribos aliadas, comércio, conversões, o ramo do final feliz | É mais lento no começo |

- **Quem equilibra são as regras e os números, medidos com os bots**, não o mestre por julgamento: um *sweep* com bots
  cruéis contra bots benevolentes, como o `geo battle sweep` mede os DNAs. É o "justo e imparcial" que o dono pediu,
  sem depender da opinião de ninguém.
- **O mestre não dá desvantagem a ninguém** (decidido: "neutro, sem mexer no placar"). O papel dele é **escolher o
  caminho do arco** que responde à conduta dos deuses: o mundo reage a eles.
- **A conduta nasce das ações**, como no Black & White: ninguém escolhe "sou mau" num menu.

### 8.5 O arco do mundo: a main quest line secreta [agente]

**A main quest line é o próprio arco do fim do mundo**, organizado como o dono descreveu:

```mermaid
flowchart LR
    I["Ato I<br/>a fundação"] -- "gatilho<br/>(tempo, cristal esgotado,<br/>eventos)" --> II
    subgraph II["Ato II · um preset"]
        IIa["ex.: o chamado das tribos<br/>(conduta benevolente)"]
        IIb["ex.: o pacto com a corrupção<br/>(conduta cruel)"]
    end
    II -- gatilho --> III
    subgraph III["Ato III · um preset"]
        IIIa["ex.: o ritual<br/>(o final feliz)"]
        IIIb["ex.: a terra devorada<br/>(o fim total)"]
    end
    III --> H["O fim e a história<br/>(os deuses pelo nome;<br/>o arco revelado)"]
```

(Os nomes dos presets são só ilustração do formato; o conteúdo é do dono.)

- **O que fica do que já foi decidido:** a corrupção continua sendo o apocalipse, e o final feliz das tribos continua
  sendo a única saída. Os presets são **ramos dentro do mesmo apocalipse**, o que respeita "um apocalipse só;
  variedade por seed só se o playtest pedir" (2026-11-15). Apocalipses diferentes seriam uma revisão do decidido
  (pergunta da §10).
- **O preset de cada ato** pode ser escolhido na criação do mundo ou durante o jogo, até o ato começar (a passagem de
  era do Age of Empires). Quem escolhe é o mestre: o humano, se houver, ou o diretor-bot, por regras (ex.: o ramo que
  responde à conduta dominante dos deuses).
- **O mestre ajusta os gatilhos dentro de limites** que o preset define, nunca livremente: cada ajuste é um
  **comando** (ADR-0002), registrado no log, e o replay continua determinístico.
- **O segredo e a confiança:** os jogadores descobrem o arco pela crônica ("a terra geme"), sem ver as regras. **No
  fim, a história revela o arco inteiro**, inclusive cada escolha do mestre. Isso dá confiança (quem quiser confere
  depois) e dá a melhor parte da tela de fim.
- **Para o dono, é uma ferramenta de playtest:** nos testes locais, ele mesmo pode sentar na cadeira do mestre e
  conduzir o arco.

### 8.6 A ficha e o painel do mestre [agente]

- **Uma ficha só, para o creep e para o deus:** no topo, um resumo de 3 a 5 números que pesam (fama, títulos, laços,
  HP e o item do creep; influência e conduta do deus); embaixo, a crônica dele, filtrada. Abre sob demanda, como hoje
  se escolhe um creep: nada a mais na tela do jogador casual.
- **O painel do mestre** junta o estado do arco (ato atual, presets disponíveis, gatilhos perto de disparar) com as
  fichas mais relevantes (os deuses, os creeps mais famosos, quem está perto de um título).
- **A ficha é barata e vem primeiro:** é uma leitura da crônica, sem regra nova. É a peça que torna visível tudo o que
  é "simbólico primeiro" (laços, títulos, fama, conduta).

### 8.7 Tributos e conversões [agente]

- **"Converter fiéis"** é uma ação de diálogo com os neutros, sobretudo as tribos (tema "O mundo vivo"). Uma tribo
  convertida vira tributária do time: manda uma parte do estoque dela, numa caravana física.
- **O deus que converteu ganha influência**, e a crônica registra. Os creeps do próprio time não precisam ser
  convertidos: eles já são do time.
- **Os errantes são hostis por natureza** (decidido), então não se convertem.

### 8.8 O que muda na reconciliação [agente]

| O quê | Antes (rodada 1) | Agora (proposta) |
|---|---|---|
| Reputação | Duas camadas: a fama do creep e a relação do time com as tribos | **Três escalas:** a fama do creep, a influência e a conduta do deus, a relação do time com as tribos (§8.3) |
| O tema "O fim do mundo" | Corrupção, ponto sem volta, vitória pírrica, crônica do fim, lendas | **"O arco do mundo":** a main quest line secreta, com atos, gatilhos e presets; a corrupção é o arco; o final feliz é o ramo benevolente; o mestre conduz |
| O mestre da mesa | No tema "A jungle hostil" | **No tema "O arco do mundo"**: conduz o arco e os neutros. O mandato decidido continua (neutro, sem mexer no placar) |
| Tema novo | — | **"Os deuses":** influência, conduta, a ficha do deus, os títulos de deus, o nome na história do mundo, a influência no domínio |
| O regime do time | Meritocracia pela fama dos creeps (descrição do dono, decidida como direção) | **Meritocracia pela influência dos deuses**: quem decide é o jogador, e a fama dos creeps que ele dominou entra na influência dele. **Revê o decidido:** pergunta da §10 |
| A fatia paralela ao próximo marco | Identidade simbólica: traits, fama, títulos | **"As fichas":** a identidade simbólica dos creeps **e dos deuses** (fama, títulos, influência e conduta na crônica, a ficha), sem nenhum efeito mecânico |
| O próximo marco | Os itens | **Continua Os itens.** Os deuses e o arco dependem do fim mínimo (E), da ficha e do mestre; o núcleo de diversão (lutar, ganhar e perder) ainda precisa ser provado antes, e o dono testa os itens sozinho |
| As fatias D e E | — | **Nada muda.** A tela de fim da E já tem o resumo da crônica; citar os deuses pelo nome fica para a spec da E decidir, se for barato |

### 8.9 Expectativa × realidade [agente]

| Ideia | O que se espera | O que custa de verdade | A favor | Contra | Recomendação |
|---|---|---|---|---|---|
| **O deus na crônica e a história no fim** | O jogador vira personagem do mundo | Barato: o `sim` já tem o jogador; o nome fica no servidor. Gravar entre mundos pede contas | A partida vira uma história contável | — | **Cedo, na fatia "As fichas"** |
| **Influência** | Ser ativo vale a pena | Uma leitura dos eventos por jogador; o peso de cada evento pede balanceamento | Premia a presença ativa sem punir a ausência (pilar 4) | Bola de neve, como a fama | Peso, não moeda; **simbólica primeiro** |
| **Conduta cruel × benevolente** | Dois caminhos de jogo | O equilíbrio é o difícil: precisa dos bots com as duas condutas e de um *sweep* | Rejogabilidade; o mundo reage | **Uma estratégia dominante** se o equilíbrio falhar | Portas que abrem e fecham; equilíbrio pelas regras, medido |
| **O arco secreto com presets** | Cada mundo conta uma história diferente | Conteúdo (cada preset é um ramo escrito e balanceado); os gatilhos como parâmetros e comandos | Variedade sem um apocalipse novo | Conteúdo; confiança no mestre | Começar com o arco padrão e **um ramo alternativo por ato**; o arco revelado no fim |
| **O painel do mestre** | O mestre decide bem e rápido | Uma tela nova, só para o mestre | Torna o mestre humano viável | Só se testa com um mestre humano (o dono serve) | Depois da ficha, junto do arco |
| **Tributos e conversões** | Uma economia de fé | Pede as tribos (tema "O mundo vivo") | Pilar 2 (a caravana do tributo) | Depende de um tema grande | Com as tribos |

## 9. O que o agente decide ou propõe sem perguntar (rodada 2) [agente]

- **O modelo de três escalas** (§8.3) como a estrutura da reputação.
- **Os ajustes do mestre são comandos com limites** e ficam no log; o arco é revelado no fim.
- **A ficha é uma só** para o creep e o deus, com o resumo no topo e a crônica embaixo.
- **Os errantes não se convertem;** os creeps do próprio time não precisam ser convertidos.
- **O tema "O fim do mundo" vira "O arco do mundo"**, o mestre vai para ele, e nasce o tema "Os deuses" (é
  organização do banco, não decisão de jogo).
- **O próximo marco continua Os itens**, com a fatia paralela "As fichas".

## 10. As perguntas da rodada 2

Onze perguntas em três grupos, numeradas depois das 16 da rodada 1. **Respondidas** (§10.1), com mais quatro do grupo
8 que surgiram no caminho.

**Grupo 5: o deus**

17. A influência é um peso (não se gasta) ou uma moeda (se gasta em domínio ou em poderes)?
18. A conduta nasce das ações, ou o jogador escolhe um caminho no começo?
19. Os tributos vão para o tesouro do time (com crédito ao deus) ou para uma carteira do jogador?
20. Os deuses são simbólicos primeiro (na ficha e na crônica), com os efeitos mecânicos depois?

**Grupo 6: conduta e equilíbrio**

21. O cruel ganha rápido e fecha portas (tribos, o final feliz), ou só ganha rápido?
22. Que fuga pesa contra a influência: toda fuga (menos a automática), ou só a que abandona aliados que ainda lutam?
23. A influência pesa no domínio: dominar creeps famosos pede influência, ela muda o custo e o cooldown, ou não pesa?

**Grupo 7: o arco e o mestre**

24. Os presets da main quest line: ramos dentro da corrupção, apocalipses diferentes, ou sem presets por ora?
25. O mestre conduz o arco: escolhe os presets e ajusta os gatilhos dentro de limites, com tudo revelado no fim; ou
    livre; ou só o diretor-bot?
26. Quem equilibra o cruel e o benevolente: as regras medidas com bots, ou o mestre por julgamento?
27. A meritocracia do regime: pela influência dos deuses, pela fama dos creeps, ou as duas?

### 10.1 Respostas do dono (rodada 2, 2026-11-20)

"Deus" é o nome provisório do papel do jogador: a moldura da saga (§11) pode renomeá-lo. As respostas valem para o
papel, seja qual for o nome.

| # | Pergunta | Resposta |
|---|---|---|
| 17 | Influência: peso ou moeda | **Os dois, separados:** a influência é um peso que abre portas, e existe **outro recurso, individual por jogador**, que se acumula e se gasta sem mexer na influência |
| 18 | A conduta | **Nasce das ações** |
| 19 | Os tributos | **No tesouro do time**, com o crédito da influência para o deus que converteu |
| 20 | Simbólico primeiro | **Sim:** influência e conduta primeiro na ficha, na crônica e na história do fim |
| 21 | O cruel | **Ganha rápido e fecha portas** (tribos hostis, o ramo do final feliz) |
| 22 | A fuga | **Só a que abandona aliados que ainda lutam** pesa contra a influência |
| 23 | Influência e domínio | **Dominar creeps famosos pede influência**; o domínio comum não muda |
| 24 | Os presets | **Ramos dentro da corrupção** (um apocalipse só) |
| 25 | O mestre e o arco | **Escolhe e ajusta com limites;** cada ajuste é um comando; o arco é revelado no fim |
| 26 | O equilíbrio | **Regras medidas com bots** (cruéis × benevolentes); o mestre não mexe no placar |
| 27 | A meritocracia | **Pela influência dos deuses** (revê a descrição da rodada 1: a fama dos creeps entra na influência de quem os dominou) |
| 28 | O recurso do deus | **Híbrido:** o recurso divino nasce dos feitos dos fiéis (as quests do deus para o creep, cumpridas) e pode ser **acelerado por oferendas e rituais**, que tomam o tempo dos creeps e têm risco |
| 29 | O gasto | **Os dois** (sussurros e poderes no mundo) e o **investimento em creeps qualificados**, com o retorno em influência quando eles evoluírem e espalharem a influência pela crônica. **O resultado de um sussurro depende da abordagem**, não só do trait |
| 30 | A saga como moldura | **Em aberto:** "isso é o que quero desenvolver antes de decidir" (§11) |
| 31 | O segredo | **Na instância:** o conteúdo pode estar no repositório; a surpresa vem de qual ramo, onde, quando e quem. **A história principal tem de ser entendida por quem joga às cegas** |

## 11. A 7ª leva: a moldura da saga (em análise, sem decisão)

> **O dono pediu para parar de decidir e analisar:** "não tem ideia melhor ou pior, é questão de pararmos um pouco de
> decidir e analisar as ideias e ver como cada uma se encaixa no contexto que construímos nessa conversa e o que
> temos documentado no repo". Esta seção só analisa. Nada nela está decidido.

### 11.1 O que o dono trouxe [dono]

- **Referências de manhwa, manhua e mangá:** isekai, deuses que sussurram ("esquizofrenia total, me identifico com
  esses, mas não sei como aplicar no jogo"), a torre dos deuses, portais e invasão de mundos. Muitas dessas histórias
  têm "uma receita de bolo que permite sagas infinitas"; o geometrix pode aproveitar a receita e adaptá-la ao mundo
  geométrico, com o terceiro ato apocalíptico e as lendas que se reúnem "durante um breve momento histórico daquele
  mundo. Será que é possível salvar o mundo?".
- **A quest do deus para o creep** pode substituir parte dos gambits e do piloto automático do bot. **A IA do
  deus-bot** tem de existir para os times sem jogador.
- **No começo, as interações divinas são um mistério para os creeps**, exceto para um **retornado** (*returnee*): ele
  evolui em segredo e muito mais rápido, nunca aceita ser dominado a não ser que você aceite a quest dele e pague o
  preço, às vezes age por conta própria mesmo dominado, e tenta sempre adiantar o fim do mundo com uma pequena **liga
  independente** de elite, discreta, que ele lidera. Creeps especiais como ele nascem da seed, de forma
  determinística, no começo ou durante a partida, e podem nascer neutros.
- **A moldura pode mudar o papel do jogador:** os deuses do Black & White poderiam virar jogadores *dokkaebis* (de
  *Omniscient Reader* e parecidos), ou o mestre seria o **administrador do andar da torre**. Isso pode definir, por
  exemplo, que **os jogadores começam sem time**: os "times" são grupos de creeps teletransportados do mundo de origem
  para a torre, cada um reage do seu jeito, e no começo a maioria está confusa e vulnerável.

### 11.2 Como as peças novas se encaixam no que existe [agente]

| Peça | No que se apoia | O que encaixa bem | Onde raspa no decidido |
|---|---|---|---|
| **A quest do deus para o creep** | O piloto declarativo (GDD 07), o ADR-0002 (tudo é comando), as quests nos verbos do mundo | Uma quest é uma ordem de alto nível com recompensa: o jogador diz **o quê** ("traga 20 cristais", "explore o norte"), e as regras do creep cuidam do **como**. Pode ser **mais casual** que editar gambits. O deus-bot é o estrategista de hoje, dando quests em vez de regras | Dois jeitos de comandar (regras e quests) confundem; precisam virar um só (ex.: a quest é uma regra temporária no topo da lista, com recompensa) |
| **O recurso híbrido** | A crônica (os feitos), a carga e o tempo dos creeps (pilar 2) | Os feitos dão o fluxo de base; oferendas e rituais aceleram, **com custo físico** (o creep para de trabalhar, pode ser emboscado) | A parte que nasce dos feitos não está no mapa: uma exceção estreita ao pilar 2, que precisa ficar escrita |
| **Investir em creeps qualificados** | A fama do creep → a influência do deus (§8.3) | É um **patrocínio**: o deus aposta num creep, e a morte permanente é o risco do investimento | A bola de neve (quem já tem mais investe mais) |
| **O sussurro depende da abordagem** | O diálogo do encontro, os traits | O resultado é trait × abordagem × **o que o creep sabe dos deuses** | — |
| **O mistério no começo** | Os atos do arco, a crônica | **Os creeps descobrindo os deuses é como o jogador às cegas descobre a história.** O que os creeps sabem cresce com os atos, e a crônica conta essa descoberta. Responde à exigência da pergunta 31 | — |
| **O retornado** | Os kits de crônica (um kit raro), o recrutamento ("side-quest para os traits raros", decidido), as ligas, o lado neutro, o arco, as lendas | Um coringa com história própria. **Pode ser uma lenda de um mundo anterior**, que já viu um fim: é o isekai e a regressão dentro das lendas que já existem. Como agente do fim, é a cara do ramo cruel do arco | (1) **"O creep dominado só muda de ordem por comando de quem o domina"** (M1, decidido): o rebelde que age sozinho revê isso. (2) **O espelho:** nascer num time dá a esse time uma elite; nascer neutro, ou um por time, mantém a justiça. (3) **Evoluir em segredo e exponencialmente** briga com a ficha legível e com números limitados |
| **A liga independente** | "Lados, não grupos" (decidido), o ADR do lado neutro | Um lado que não é time nem tribo: o 6º consumidor do lado neutro | — |
| **O deus-bot** | O estrategista dos bots, o diretor-bot do mestre | Toda mecânica de deus precisa do seu bot, como "toda regra nova precisa da sua IA" | O custo: cada sistema de deus pede o bot junto |

### 11.3 A moldura: quatro leituras [agente]

A pergunta que separa as leituras: **quem é o jogador, quem é o mestre, e por que os creeps estão ali?**

| Leitura | O jogador | O mestre | Os creeps e os times | O que muda no decidido |
|---|---|---|---|---|
| **A. Os deuses** (Black & White) | O deus do time, dentro da crônica | O mestre da mesa, que conduz o arco | Nascem no mundo; dois times fixos | Nada estrutural |
| **B. A torre** | Um deus que patrocina os creeps | **O administrador do andar**: o arco é o "cenário" daquele andar | **Convocados de outros mundos** (o isekai); o Núcleo é o portal, e produzir creeps é convocá-los | Pouco: produzir vira convocar (texto, não regra); as lendas sobem ou atravessam andares |
| **C. Os anfitriões** (tipo *dokkaebi*) | Um anfitrião que monta o espetáculo e é pago pela plateia | O dono da torre, acima dos anfitriões | Atores do espetáculo | O recurso do deus vira o pagamento pelo espetáculo; o papel do jogador fica mais de mestre que de líder de time |
| **D. Sem time no começo** (variação da B) | Escolhe quais creeps convocados patrocinar | O administrador | **Os times nascem do jogo:** grupos teletransportados e confusos | **Muito:** dois Núcleos e dois times fixos (M1), a economia do time, o regime, o espelho do mapa |

**A distinção que ajuda a analisar sem decidir: a pele e a estrutura.**

- **A pele** (quem os jogadores são na história, por que os creeps estão ali, os nomes) mora no texto: na crônica, no
  narrador, na ficha, nos sussurros, no cliente. **Ela pode mudar tarde e barato.** As leituras A, B e C são,
  sobretudo, peles sobre a mesma estrutura.
- **A estrutura** (dois times com Núcleos, a economia, o domínio, as batalhas) é o que o M1, o M1.5 e o M2 construíram.
  **Ela custa caro para mudar.** Só a leitura D mexe nela.
- **Então:** a estrutura atual segue (a D, a E, Os itens não dependem da moldura), e a pele se desenvolve com calma,
  numa rodada própria, até o tema "Os deuses" ou "O arco do mundo" precisar dela. A leitura D merece ser estudada como
  uma pergunta à parte: "os times podem nascer do jogo?".

### 11.4 Os primeiros minutos às cegas [agente]

Um jeito concreto de comparar as leituras é escrever o que um jogador que nunca leu o repositório vê e entende nos
primeiros minutos. Rascunhos, só para comparar:

- **A. Os deuses:** a crônica abre com "Um novo deus desperta sobre o Azul". Os creeps trabalham; quando o jogador
  domina um, a crônica diz "Fulano sente uma presença". A pergunta do mundo aparece no fim do ato I, pelo narrador.
- **B. A torre:** "O andar 7 se abre. Vinte formas caem do céu, sem lembrar de onde vieram." Os creeps começam
  confusos (a ficha diz "desorientado"); o Núcleo brilha como um portal; o primeiro sussurro do deus é ouvido como
  uma voz estranha. A administradora do andar anuncia o cenário: "Sobrevivam ao fim deste mundo. Ou salvem-no."
- **C. Os anfitriões:** "Bem-vindos à transmissão do andar 7." O jogador vê os creeps como atores, e a plateia reage
  aos feitos com pagamentos. É a leitura mais distante do jogo de hoje.
- **D. Sem time:** "Quarenta formas caem no andar 7, espalhadas." Os grupos se formam pelo jogo; o jogador escolhe
  quem patrocinar. O começo é o mais confuso de propósito, e o mais difícil de ensinar.

A **B** é a que encaixa mais peças com menos mudança: o isekai (a convocação), o mistério no começo (os creeps
desorientados), o retornado (quem já viveu um fim), as lendas (quem atravessa andares), o mestre (a administração do
andar) e a pergunta "é possível salvar o mundo?" (o cenário do andar). **Isso é uma observação, não uma
recomendação**: o dono pediu para analisar antes.

### 11.5 Um cuidado de identidade [agente]

As receitas (a torre, a convocação, o retornado, os patrocinadores, os anfitriões) são tropos de gênero, e cabem bem.
Os **termos de uma obra específica** (ex.: "dokkaebi", "constelações") como vocabulário do jogo fariam o geometrix
parecer uma adaptação. Proposta: usar as receitas com **nomes próprios, geométricos** (ex.: um "vértice" no lugar
de um deus, um "andar" ou um "plano"), que o glossário fixa quando a moldura for escolhida.

### 11.6 O que não muda, seja qual for a moldura [agente]

- A fatia D e a E, como estão; o próximo marco candidato, Os itens; a fatia paralela "As fichas" (a ficha e a crônica
  servem a qualquer leitura).
- As decisões das rodadas 1 e 2 (§0 e §10.1), com "deus" como nome provisório do papel do jogador.
- O segredo na instância, e a história legível às cegas.
- "Simbólico antes de mecânico."

### 11.7 Para seguir a análise [agente]

Quando o dono quiser retomar (sem prazo; nada do M2 depende disto):

1. **Uma página por leitura,** com o rascunho dos primeiros minutos (§11.4) mais completo e a lista do que cada uma
   revisaria no GDD.
2. **A pergunta estrutural à parte:** "os times podem nascer do jogo?" (a leitura D), com o custo no código e nos
   decididos.
3. **O retornado como um caso de teste:** escrever a ficha e a crônica de um retornado em cada leitura mostra rápido
   qual delas conta melhor a história.
