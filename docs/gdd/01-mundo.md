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
  - **Névoa negra:** fora da própria visão, o time não conhece nada no início da partida: nem o terreno, nem os
    depósitos, nem o Núcleo inimigo.
  - **Do inimigo, dentro da visão:** os creeps (posição, DNA e carga), as estradas e as obras. Estoque, produção,
    upgrades, regras de piloto automático e ordem dos creeps inimigos ficam sempre escondidos.
  - **Memória do time:** os depósitos guardam o último valor visto; estradas e obras vistas continuam no mapa;
    creeps inimigos somem quando saem da visão.
  - **Caminho pelo que o time sabe:** uma célula nunca vista conta como jungle passável; quando o creep descobre
    pedra ou rio no caminho, recalcula. Nenhuma ordem revela terreno escondido.
  - O piloto automático também decide só pelo que o time sabe ([07](07-piloto-automatico.md)).

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

### Fog of war: detalhes ainda não decididos
- **O que já foi visto e não muda fica conhecido:** o terreno explorado e a posição do Núcleo inimigo, depois de
  vistos, ficam no mapa do time (é o que o "caminho pelo que o time sabe" pressupõe).
- **Três estados na tela:** nunca visto (negro), lembrado (esmaecido, com o último valor) e visível agora. É o que o
  playtest de legibilidade do M1.5 vai avaliar.

## Perguntas abertas
- O Núcleo pode ser movido ou reconstruído? Pode existir mais de uma base por time?
- **Sem depósito garantido à vista no início** (névoa negra, 2026-11-14), o começo de partida fica lento ou
  desigual demais em alguma seed? Medir com os bots antes do playtest.
- Jogadores podem entrar num mundo já em andamento?
- O que se pode construir e onde (só perto do Núcleo, em território controlado, em qualquer lugar)?
- O rio é só obstáculo, ou também é rota de transporte (barcos levam carga pesada mais rápido, mas ficam expostos)?
