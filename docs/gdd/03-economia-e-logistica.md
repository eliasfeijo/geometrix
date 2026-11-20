# 03 — Economia, transporte e impostos

## Decidido
- Há dois níveis de economia:
  - **individual:** o inventário de cada creep;
  - **do time:** o tesouro público.
- Todo recurso e moeda precisa ser **transportado fisicamente** até a base, por creeps ou mulas.
- O "estado" da base cobra um **imposto**, com taxa votada pelo time, e o valor vai para o tesouro público.
- O tesouro reflete os recursos de fato coletados e a diplomacia com as tribos.
- A riqueza pode ser investida em upgrades, fortificações, itens individuais e na produção de creeps.
- **Direção para o M1: dois recursos, matéria + cristal** (descritos abaixo). Os valores são provisórios.
- **Coleta de cristal mais lenta** (dono, sessão 2 do M1.5, 2026-11-14): o ritmo de coleta passa a ser por
  recurso, e o cristal é coletado mais devagar que a matéria: **1 unidade a cada 5 s** (a matéria, 1 por segundo),
  provisório. Motivo: o cristal do mapa inteiro se esgotava em 8,6 h de um mundo de 72 h. **Medido no checkpoint
  da F6 do fog, o ritmo quase não adia o esgotamento** (1 s → 8,7 h; 5 s → 9,1 h; 30 s → 12,6 h, nas seeds 1–3): os
  bots coletam todo o cristal do mapa e terminam com ~68% dele parado no estoque. **O dono fixou os 5 s como
  provisórios e deixou o esgotamento para o M2** (2026-11-14), com o papel do cristal (abaixo).
- **Regras de economia do M1** (2026-11-13, na F3; detalhes na
  [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md)): coleta de 1 unidade/s (provisório), com a capacidade
  contando os dois recursos somados; entrega instantânea no Núcleo; matéria regenera até o valor inicial; o Núcleo
  produz um creep por vez, com "repetir" que espera recurso; estradas são neutras (os dois times andam nelas),
  construídas célula a célula a partir da rede, nunca numa travessia do rio. Por isso, no M1 nenhuma estrada
  cruza o rio.
- **Saque e despojo** (dono, 2026-11-15; registro no [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md)): se
  ninguém fugir, o lado vencedor fica com os recursos dos perdedores que morreram na batalha. O **despojo** é uma
  pilha no chão que qualquer creep pode catar: guarda o saque que não coube na carga de quem venceu, a bolsa largada
  na fuga ([06](06-batalhas.md)) e o artefato que cai quando o portador morre.
- **Spec do M2, fatia A, o encontro** (dono, 2026-11-15; [spec M2 do encontro](../specs/m2-encontro/spec.md)):
  - **Extorsão física** (D8): a exigência é a carga da vítima até a capacidade livre do agressor, cristal primeiro;
    pagar passa a exigência da carga da vítima para a do agressor. Não dá para extorquir quem está vazio, nem
    estando cheio. O DNA pesa sem número novo: o quadrado extorque muito e é lento; o círculo extorque pouco e
    alcança.
  - **Saque e despojo** (D11): o vencedor recolhe a carga do morto até a capacidade livre, cristal primeiro, e o
    resto vira despojo; despojos na mesma célula se somam; o despojo **não expira** no M2 (fatia A) e fica na
    memória do time como um depósito.
  - **O que cai na fuga** (D10): quem escapa larga de 50% a 100% de cada recurso (sorteado), provisório. Nem toda
    fuga perde a bolsa inteira, mas fugir sempre dói.
- **Construções só se recuperam com reparo pago** (dono, 2026-11-15): o Núcleo, as estradas prontas e as obras têm
  HP no M2 ([01](01-mundo.md)).
- **O esgotamento do cristal é a semente do fim do mundo** (dono, 2026-11-15; registro no
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §0): todo depósito de cristal esgotado
  vira um foco de **corrupção**, que envenena quem está perto e cresce até cobrir o mapa (M2.5, [01](01-mundo.md)).
  Quantos depósitos se esgotaram decide se o fim já é inevitável. A corrupção **não pode ser limpa** pelos
  jogadores, nem gastando recurso.
- **O Núcleo é a forja e o cofre** (dono, 2026-11-20, na rodada do [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md); tema "Os itens"): os itens
  se fazem e evoluem no Núcleo, com material carregado até lá; o item guardado no Núcleo não se perde quando o creep
  morre. Detalhes (receitas, custo, o papel exato do cristal) na spec do tema.
- **Tributos e o recurso do deus** (dono, 2026-11-20, rodada 2 do [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §10.1; "deus" é o nome provisório do papel do jogador, a moldura
  da saga está em análise, §11):
  - **os tributos** das tribos convertidas vão para o **tesouro do time**, numa caravana física; o deus que converteu
    ganha influência;
  - **o recurso individual do deus** é separado da influência: acumula-se e se gasta. **É híbrido:** nasce dos
    feitos dos fiéis (as quests do deus para o creep, cumpridas) e é **acelerado por oferendas e rituais**, que tomam
    o tempo dos creeps e têm risco. Gasta-se em sussurros, poderes no mundo e investimento em creeps
    ([02](02-creeps-e-dominio.md)). A parte que nasce dos feitos não está no mapa: é uma exceção ao pilar 2, a
    escrever com limites (não se rouba, não se troca, não compra nada material) quando o tema "Os deuses" tiver
    marco.

## Proposta

### Recursos se definem por eixos, não por nome
Primeiro escolhemos que **problemas logísticos** queremos criar. O nome e o tema vêm depois.

| Eixo | Pergunta |
|---|---|
| Origem | Onde nasce? Perto da base, na jungle, só em território disputado? |
| Renovação | Regenera ou se esgota? |
| Peso | Quanto ocupa no inventário? (define quantas viagens ou mulas são necessárias) |
| Valor por unidade | Vale a pena emboscar? |
| Perecibilidade | Estraga em trânsito ou parado? |
| Uso | O que desbloqueia? |

Um conjunto mínimo para o M1 com problemas opostos:
- **Matéria:** pesada, de pouco valor, abundante perto da base e renovável. Serve para construir e produzir
  creeps. *Problema: volume.*
- **Cristal:** leve, valioso, raro, em pontos disputados da jungle e esgotável. Serve para evolução, skills e
  ultimates. *Problema: risco; é o alvo natural de emboscadas.*

Candidato para depois do M1:
- **Energia:** perecível, é a manutenção dos creeps e o limitador de população. *Problema: fluxo contínuo.*

### Recurso × moeda (o dono ainda não está convencido)
- **A moeda só existe depois que a base "cunha".** Recursos entregues ao estado viram moeda (o imposto é cobrado
  nessa conversão).
- A moeda é leve e fácil de carregar. Serve para pagar creeps, comprar itens individuais e negociar com tribos.
- O recurso bruto é o que se transporta na jungle; a moeda é o que circula dentro e entre as economias.

### Sumidouros
Uma partida de dias precisa de sumidouros para a economia não inflacionar: manutenção, desgaste de estruturas,
consumo de cristal em evoluções.

### Brainstorm de 2026-11-15 (não aprovado)
Detalhes no [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §2, §4 e §5.
- **Escambo entre times** (agente): uma ação do encontro. Os bots terminam a partida com ~68% do cristal parado.
- **Sumidouros candidatos** (agente): a pressão crescente dos errantes no fim da partida e a durabilidade das armas
  (camada de forja).

### A corrupção: como fazer (agente, 2026-11-15, não aprovado)
A direção está em Decidido; o detalhe, no [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md)
§4.2.
- **Uma tragédia dos comuns:** os dois times ganham minerando, e os dois pagam pelo esgotamento. É o papel que
  falta ao cristal.
- **Approach** (agente): cada depósito de cristal que chega a zero vira um foco (célula + tick de nascimento); o
  raio é uma função inteira do tempo e do ato; dreno de HP em ‰ do HP máximo por minuto; depósitos de matéria na
  terra corrompida ficam inúteis; o A* pesa as células corrompidas. Estado pequeno, delta trivial, custo O(focos).
- **Restrição que já vale** (agente): o depósito esgotado continua no estado, com `amount` 0. Nenhuma decisão do
  cristal no M2 deve removê-lo nem fazê-lo regenerar sem considerar esta proposta.
- **Risco** (agente): os bots esgotam o cristal em ~9,7 h, o que dispararia o fim total em toda partida; o esgotamento
  precisa ser rebalanceado junto, com o `geo sweep`.

### Itens e o Núcleo (ideias do dono, 2026-11-20, não aprovadas)
Detalhes no [brainstorm de itens, reputação e governança](../brainstorm/2026-11-20-itens-reputacao-governanca.md) §2 e §3.
- **Itens como fonte das skills** ([02](02-creeps-e-dominio.md)): o agente propõe que se façam com material físico,
  com o **cristal como ingrediente** (o papel que falta a ele), e que a **durabilidade** seja o sumidouro que esta
  seção procura. A forja puxa a mineração, e a mineração puxa a corrupção.
- **A forja e o cofre no Núcleo** foram decididos (acima, 2026-11-20).

## Ideias em incubação (sem marco definido)
- **Pontes e construções no rio:** um conceito próprio de travessia construída, que deixaria a estrada cruzar o rio.
  O dono quer considerar mais à frente; não entra no M1.

## Perguntas abertas
- Validar os eixos de recurso.
- Recurso × moeda: moeda cunhada, ou recurso e moeda são a mesma coisa? **Não bloqueia o M1**, que pode rodar
  só com matéria e cristal, sem moeda. Decidir quando impostos e comércio entrarem (M3).
- O creep pode gastar o próprio inventário sem passar pelo tesouro (comprar item para si)?
- Existe comércio entre times, ou com tribos?
- **Sumidouro no M1?** Na passada de balanceamento 1 ([balance.md](../specs/m1-ciclo-da-riqueza/balance.md) §5),
  depois do teto de população o estoque cresce sem uso nas últimas ~20–30 h do mundo. Trazer um sumidouro
  (manutenção, desgaste) ou um limitador de população para o M1 aumenta o escopo do marco; a alternativa é medir
  no playtest se o fim fica chato. **Adiada pelo dono (2026-11-14):** não entra no M1; volta quando houver
  playtest humano.
- **Papel do cristal no M1.** Cada time precisa de ~390 cristais e coleta ~1 200, que se esgotam em ~8 h. Os
  depósitos disputados quase não são disputados, então o sinal do M2 não aparece. Depósitos disputados mais ricos,
  mais perto das travessias, ou aceitar até o M2 dar mais usos ao cristal? **Fica para o M2 (dono,
  2026-11-14)**, onde o cristal vira o alvo da emboscada. O ritmo de coleta entrou antes, no M1.5 (coleta de
  cristal mais lenta, em Decidido), mas não resolve o esgotamento: o que esvazia o mapa é coletar sem precisar.
  Os usos, a disputa e o esgotamento continuam para o M2. O esgotamento ganhou um destino (a corrupção, em
  Decidido); os usos e o ritmo do esgotamento vão para a **rodada de design do cristal, logo depois do checkpoint
  da fatia A, F3**, que mede o cristal (dono, 2026-11-15; [ROADMAP](../ROADMAP.md)).
- **Desempate em depósito disputado.** Quando creeps dos dois times coletam no mesmo depósito quase vazio, o de id
  menor leva a unidade (regra do M1, ordem do tick). Com o fog, os creeps passam a disputar depósitos e, no seed 42,
  o time 0 fica à frente depois de ~15 h (151 mil × 140 mil de matéria em 3 dias). **Aceito por ora; rever numa
  rodada de rebalanceamento futura (dono, 2026-11-14).**
