# 02 — Creeps, domínio e progressão

## Decidido
- **Herói = creep aliado dominado.** Não existe herói fixo.
- Cada jogador tem no máximo **1 domínio ativo**. Um creep só pode ser dominado por um jogador de cada vez.
- Ao ser **liberado**, o creep mantém a configuração de piloto automático e continua obedecendo a ela. Ele fica
  elegível para um novo domínio, pelo mesmo jogador ou por outro do time.
- **Creeps são produzidos com recursos.**
- **DNA = a forma/arquétipo inato do creep:** quadrado = tank melee; círculo = glass cannon ranged; triângulo = vida
  média-alta, médio alcance.
- Progressão própria por creep: level, alocação de stats, DNA (inato) × evolução individual.
- Cada creep tem um **inventário**. A capacidade varia com level, stats e DNA.
- **A morte é permanente.** A exceção é uma eventual skill, magia ou ultimate de reviver.
- *(Do conceito inicial)* 3 skills base + 1 ultimate desbloqueada por level-up.
- **M1** (2026-11-13): dominar é livre (custo, cooldown e distância existem como parâmetros, em 0). O custo sai do
  estoque do time; o cooldown é por jogador; a distância vai do Núcleo do time ao creep. O creep dominado só muda
  de ordem por comando de quem o domina. Detalhes na [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md).
- **Os DNAs se equivalem no impacto econômico** (2026-11-14). Capacidade × velocidade dá praticamente a mesma
  vazão para os três (30 × 2, 20 × 3, 10 × 5, provisórios); a diferença entre eles aparece em outros sistemas, a
  partir do M2. Medição na [passada de balanceamento 1](../specs/m1-ciclo-da-riqueza/balance.md) §6.
- **Visão por DNA** (M1.5, 2026-11-14): o círculo enxerga mais longe (raio 6), depois o triângulo (4) e o
  quadrado (3), provisórios. O rápido e leve é o batedor natural; o quadrado de carga pesada é o mais cego. É a
  primeira diferença entre os DNAs fora da economia. Fog of war no [01](01-mundo.md).

## Proposta
- Dominar só troca **quem emite os comandos** do creep. Ver [ADR-0002](../adr/0002-tudo-e-comando.md).
- **Com morte permanente, recuar precisa ser possível.** Se toda batalha for tudo-ou-nada, os jogadores passam a
  evitar o combate para não perder creeps evoluídos. Recuar ou fugir de uma batalha deve ser uma opção real, com
  custo.
- **A população precisa de um limitador.** Num mundo de dias, sem limite, o número de creeps cresce sem parar e
  pesa na performance e no balanceamento. Candidatos: manutenção (consumo contínuo de recurso), teto por moradia, ou
  envelhecimento.
- **Nome do creep no estado do mundo** (levantada no F7, 2026-11-14): cada creep ganha um nome curto ao nascer,
  guardado no estado (igual para todos, persistido e no replay), e um comando para renomear. Ganha sentido quando
  o creep tiver identidade de jogo (o herói dominado, level/XP e progressão no M3). Precisa chegar no M2, no
  mais tardar: no M1 o cliente gera o nome pela ordem de nascimento, que só é estável porque nenhum creep morre;
  com morte (M2), a ordem muda e os nomes trocariam. Renomear é um comando novo no vocabulário versionado
  ([ADR-0002](../adr/0002-tudo-e-comando.md)).

- **Brainstorm de 2026-11-15** (não aprovado; [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §2 e §5):
  - o dono quer o level, os stats individuais e as skills pelo DNA a tempo do combate. O agente propõe só stats
    base por DNA no M2 (vida, dano, alcance, velocidade na batalha) e level e XP depois, para ver o combate sem a
    progressão por cima;
  - **evolução pelo uso** (agente, inspirada no treino dos jogos de ação do BYOND): o creep melhora no que faz pelo
    piloto automático. Precisa de teto, ou de ficar fora da economia, para não quebrar a equivalência econômica dos
    DNAs;
  - **temperamento ao nascer** (agente): um traço sorteado (ex.: ganancioso, bravo, cauteloso) que dá a postura
    padrão nos encontros e a voz do creep na crônica;
  - o nome no estado passa a ser necessário para a crônica dos encontros.

## Ideias em incubação (não entram antes do M3)
- **Reprodução e gerações:** creeps M/F, idade, morte natural, herança de DNA. Seria um limitador de população
  elegante e daria planejamento de longo prazo num mundo de dias. O custo é a carga de gerenciamento. Reavaliar
  depois do playtest do M3.

## Perguntas abertas
- Dominar tem custo, cooldown ou restrição de distância?
- O que acontece com o domínio quando o creep dominado morre?
- As skills e a ultimate valem para todo creep, ou só a partir de certo level?
- Um creep pode mudar de forma ao evoluir, ou o DNA é fixo para sempre?
- É possível dominar creeps de tribos aliadas?
- **Vários creeps na mesma célula** (levantada no F7, 2026-11-14): no M1 os creeps não colidem, e os "gêmeos"
  (mesmo DNA, nascidos juntos) escolhem o mesmo depósito e andam colados na mesma célula por até ~16 min de mundo.
  Eles devem se espalhar? Caminhos possíveis: limite de ocupação por célula, colisão, ou desempate diferente na
  escolha do depósito. É regra de jogo: muda a economia (tráfego nos depósitos) e provavelmente as batalhas do M2.
  Enquanto isso, o cliente mostra cada creep individualmente e deixa escolher um deles numa pilha.
