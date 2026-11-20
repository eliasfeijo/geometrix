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
- *(Do conceito inicial)* 3 skills base + 1 ultimate desbloqueada por level-up. **Revisto em 2026-11-20:** o modelo
  híbrido (abaixo).
- **M1** (2026-11-13): dominar é livre (custo, cooldown e distância existem como parâmetros, em 0). O custo sai do
  estoque do time; o cooldown é por jogador; a distância vai do Núcleo do time ao creep. O creep dominado só muda
  de ordem por comando de quem o domina. Detalhes na [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md).
- **Os DNAs se equivalem no impacto econômico** (2026-11-14). Capacidade × velocidade dá praticamente a mesma
  vazão para os três (30 × 2, 20 × 3, 10 × 5, provisórios); a diferença entre eles aparece em outros sistemas, a
  partir do M2. Medição na [passada de balanceamento 1](../specs/m1-ciclo-da-riqueza/balance.md) §6.
- **Visão por DNA** (M1.5, 2026-11-14): o círculo enxerga mais longe (raio 6), depois o triângulo (4) e o
  quadrado (3), provisórios. O rápido e leve é o batedor natural; o quadrado de carga pesada é o mais cego. É a
  primeira diferença entre os DNAs fora da economia. Fog of war no [01](01-mundo.md).
- **Rodada de design do M2** (dono, 2026-11-15; registro no
  [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md)):
  - **No M2, só stats base por DNA** (vida, dano, alcance, velocidade na batalha), nos params. **Level, XP, a
    evolução e as skills ficam para o M2.5**, para ver o combate sem a progressão por cima. Na batalha, quem vence
    depende do level, dos stats, das skills e da micro, não do DNA sozinho ([06](06-batalhas.md)).
  - **HP persiste no mundo:** o creep que sai ferido de uma batalha volta ferido ao mapa e recupera HP devagar, mais
    rápido perto do Núcleo. Ferido, vira alvo: a punição vale entre as lutas.
  - **Recuar é possível, com custo:** a fuga do encontro é largar a bolsa e correr ([06](06-batalhas.md)).
  - **Temperamentos** (traço de personalidade ao nascer) ficam para o M2.5.
- **Spec do M2, fatia A, o encontro** (dono, 2026-11-15; [spec M2 do encontro](../specs/m2-encontro/spec.md)):
  - **Nome no estado** (D1): o creep ganha o nome ao nascer, no `sim`, da lista de palavras que o cliente usava,
    pela mesma regra (ordem de nascimento, nascimentos seguidos com nomes distantes, sufixo quando a lista acaba).
    **Sem renomear no M2**: o comando entra quando o creep tiver identidade de jogo (M2.5).
  - **Stats base na fatia A** (D2): cada DNA ganha só o HP máximo e um peso de luta para o sorteio descartável
    (igual para os três de início). Dano, alcance e velocidade de batalha nascem no laboratório de batalha (fatia
    B). Chutes provisórios de HP: quadrado 300, triângulo 200, círculo 120.
  - **Regeneração do HP** (D3): em ‰ do HP máximo por minuto de mundo, igual para os três DNAs, devagar no mapa e
    mais rápido a até um raio do próprio Núcleo; não regenera durante um encontro ou uma luta. Chutes provisórios:
    de 0 a cheio em 100 min no mapa e em 10 min perto do Núcleo (raio 8).
  - **Morte de um creep dominado** (D4): o domínio termina, como um `release`, sem cooldown.
- **Spec do M2, fatia B, o laboratório de batalha** (dono, 2026-11-15;
  [spec M2 do laboratório](../specs/m2-laboratorio/spec.md) D6): os stats base de combate por DNA (HP máximo, dano,
  alcance, recarga do ataque, velocidade de batalha, velocidade do projétil, capacidade) moram nos params do pacote
  de batalha até a junção, que escolhe uma fonte só para o que existe dos dois lados. Chutes provisórios na spec.
- **As lendas** (dono, 2026-11-15; registro no
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §0): **qualquer creep vivo no fim do
  mundo vira lenda**, inclusive do time derrotado. Se o apocalipse não deixa ninguém vivo, ninguém leva lenda,
  nem os vencedores. Uma lenda pode invadir outro mundo (M5, As lendas; [01](01-mundo.md)).

- **Rodada do consolidado depois do M2** (dono, 2026-11-20; [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §0). Direções para os temas do
  banco ([ROADMAP](../ROADMAP.md)); os detalhes ficam para a spec de cada tema:
  - **A progressão é híbrida** (revê "3 skills base + 1 ultimate desbloqueada por level-up", acima): **o DNA dá uma
    skill natural ao creep, os itens dão as outras**, e o level do creep continua, com peso menor. Tema "Os itens",
    o próximo marco candidato.
  - **Cada item faz o mesmo efeito para todos os DNAs**, e alguns têm efeitos simbióticos com DNAs específicos. Os
    bots têm presets de itens, que viram a dica da interface para o jogador casual (uma nota curta e amigável); os
    presets da comunidade e o ranking ficam com o deploy (dono, 5ª leva).
  - **A liga é de um creep líder:** o jogador domina um creep para formá-la; solto, o líder continua pelos gambits.
    Um jogador pode formar várias ligas ao longo da partida. **Piloto de grupo:** o jogador controla o líder, os
    seguidores ficam na formação pelo DNA e lutam pelos gambits, com até três ordens de liga. **Recrutamento por
    diálogo**, dominando o líder: a maioria aceita pela fama do líder ou pelo laço, alguns pedem algo simples, e a
    side-quest pessoal fica para os traits raros. **O símbolo é só identidade**, por ora (o estandarte físico, com os
    itens). Tema "As ligas".
  - **Laços simbólicos primeiro:** a camaradagem aparece na ficha e na crônica; os buffs e a reação à morte de um
    amigo entram quando o playtest mostrar que o jogador se importa. **Títulos conquistados** (permanentes, por um
    feito único) **e disputados** (do melhor do mundo num feito agora, passam para quem superar), de início só
    simbólicos, na crônica. Tema "Os personagens".

## Proposta
- Dominar só troca **quem emite os comandos** do creep. Ver [ADR-0002](../adr/0002-tudo-e-comando.md).
- **A população precisa de um limitador.** Num mundo de dias, sem limite, o número de creeps cresce sem parar e
  pesa na performance e no balanceamento. Candidatos: manutenção (consumo contínuo de recurso), teto por moradia, ou
  envelhecimento.
- **Renomear o creep** (levantada no F7, 2026-11-14): um comando novo no vocabulário versionado
  ([ADR-0002](../adr/0002-tudo-e-comando.md)), quando o creep tiver identidade de jogo (M2.5). O nome no estado já
  está decidido (acima).

- **Brainstorm de 2026-11-15** (não aprovado; [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §2 e §5),
  para o M2.5:
  - **evolução pelo uso** (agente, inspirada no treino dos jogos de ação do BYOND): o creep melhora no que faz pelo
    piloto automático. Precisa de teto, ou de ficar fora da economia, para não quebrar a equivalência econômica dos
    DNAs;
  - **temperamento ao nascer** (agente): um traço sorteado (ex.: ganancioso, bravo, cauteloso) que dá a postura
    padrão nos encontros e a voz do creep na crônica.

- **As lendas: como fazer** (agente, 2026-11-15, não aprovado;
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §4.7): a lenda guarda nome, DNA, level,
  stats e uma **ficha** dos feitos tirada da crônica. A morte permanente vale para ela: invadir arrisca perdê-la. O
  poder escala para o mundo invadido, para evitar *power creep* entre partidas. Em camadas: registrar as lendas no
  fim do mundo (M2.5), a invasão por bots e a invasão por jogadores com contas entre mundos (M5, com o control
  plane).

- **Os itens e os personagens: como fazer** (agente, 2026-11-20, não aprovado; [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §2 e §3,
  com o detalhe nas levas): o creep guarda a identidade (nome, trait, fama, títulos, laços) e uma maestria pequena; o
  item evolui pelo uso, tem durabilidade e cai no despojo. **Traits** de um catálogo pequeno de presets, cada um com
  a postura, a exigência de recrutamento, a reação à morte de um amigo, a voz e um **kit de crônica** (origem e
  modelo de side-quest), sorteados no nascimento pelo `state.rng`, com o texto no cliente. A **fama** em duas
  camadas (a do creep e a relação do time com cada tribo, [05](05-tribos-e-diplomacia.md)), que cai com as
  derrotas. O teto da liga começa em 1 seguidor e cresce com o level do líder. Se o líder morre, os membros voltam às
  próprias regras, e a liga e o símbolo ficam para quem assumir. Os **laços**, quando ganharem efeito, seriam buffs
  pequenos de coordenação, e a morte de um amigo, fúria, luto ou vingança, conforme o trait.

## Ideias em incubação (não entram antes do M3)
- **Reprodução e gerações:** creeps M/F, idade, morte natural, herança de DNA. Seria um limitador de população
  elegante e daria planejamento de longo prazo num mundo de dias. O custo é a carga de gerenciamento. Reavaliar
  depois do playtest do M3.

## Perguntas abertas
- Dominar tem custo, cooldown ou restrição de distância?
- As skills e a ultimate valem para todo creep, ou só a partir de certo level?
- Um creep pode mudar de forma ao evoluir, ou o DNA é fixo para sempre?
- É possível dominar creeps de tribos aliadas?
- **Vários creeps na mesma célula** (levantada no F7, 2026-11-14): no M1 os creeps não colidem, e os "gêmeos"
  (mesmo DNA, nascidos juntos) escolhem o mesmo depósito e andam colados na mesma célula por até ~16 min de mundo.
  Eles devem se espalhar? Caminhos possíveis: limite de ocupação por célula, colisão, ou desempate diferente na
  escolha do depósito. É regra de jogo: muda a economia (tráfego nos depósitos) e provavelmente as batalhas do M2.
  Enquanto isso, o cliente mostra cada creep individualmente e deixa escolher um deles numa pilha.
