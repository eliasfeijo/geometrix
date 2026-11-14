# 01 — Mundo persistente e mapa

## Decidido
- A partida é um **mundo persistente que dura dias**: sandbox, construção e a camada RTS vivem aqui.
- Começa com times de 3 jogadores e pode crescer (o que leva a representantes, ver [04](04-governanca.md)).
- **Vitória: destruir a base inimiga.** A definição será aprofundada.
- **Direção de início de partida: "fundação"** (descrita abaixo). Os detalhes serão ajustados conforme os playtests
  revelarem o que é divertido.
- **Duração: hipótese inicial de 3 dias**, com faixa plausível de 1 dia a 1 semana. O valor definitivo só será
  fixado depois de testes controlados e observados.

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

### Fog of war
- **Inclinação do dono (2026-11-14): o mundo deve ter fog of war**, e nenhum cliente, nem um bot, deve enxergar o
  estado completo; só o que o próprio time vê. Ainda não decidido. A sincronização aceita no
  [ADR-0006](../adr/0006-sync-do-mundo.md) (delta da visão de cada time, calculado no servidor) foi escolhida para
  suportar isso.

## Perguntas abertas
- O Núcleo pode ser movido ou reconstruído? Pode existir mais de uma base por time?
- Existe fog of war no mundo? (ver a proposta acima). Se sim: o que dá visão e até onde? O que um time vê do
  outro (Núcleo, estoque, regras de piloto automático)? As condições do piloto automático (ex.: "recurso visível
  num raio R") respeitam o fog? Depósitos e estradas já vistos continuam visíveis?
- Jogadores podem entrar num mundo já em andamento?
- O que se pode construir e onde (só perto do Núcleo, em território controlado, em qualquer lugar)?
- O rio é só obstáculo, ou também é rota de transporte (barcos levam carga pesada mais rápido, mas ficam expostos)?
