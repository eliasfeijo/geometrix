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
- **Regras de economia do M1** (2026-11-13, na F3; detalhes na
  [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md)): coleta de 1 unidade/s (provisório), com a capacidade
  contando os dois recursos somados; entrega instantânea no Núcleo; matéria regenera até o valor inicial; o Núcleo
  produz um creep por vez, com "repetir" que espera recurso; estradas são neutras (os dois times andam nelas),
  construídas célula a célula a partir da rede, nunca numa travessia do rio. Por isso, no M1 nenhuma estrada
  cruza o rio.

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
  no playtest se o fim fica chato.
- **Papel do cristal no M1.** Cada time precisa de ~390 cristais e coleta ~1 200, que se esgotam em ~8 h. Os
  depósitos disputados quase não são disputados, então o sinal do M2 não aparece. Depósitos disputados mais ricos,
  mais perto das travessias, ou aceitar até o M2 dar mais usos ao cristal?
