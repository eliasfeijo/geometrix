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

## Proposta
- Dominar só troca **quem emite os comandos** do creep. Ver [ADR-0002](../adr/0002-tudo-e-comando.md).
- **Com morte permanente, recuar precisa ser possível.** Se toda batalha for tudo-ou-nada, os jogadores passam a
  evitar o combate para não perder creeps evoluídos. Recuar ou fugir de uma batalha deve ser uma opção real, com
  custo.
- **A população precisa de um limitador.** Num mundo de dias, sem limite, o número de creeps cresce sem parar e
  pesa na performance e no balanceamento. Candidatos: manutenção (consumo contínuo de recurso), teto por moradia, ou
  envelhecimento.

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
