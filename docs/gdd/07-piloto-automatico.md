# 07 — Piloto automático e macros

## Decidido
- Os creeps têm um piloto automático **configurável** e, possivelmente, **scriptável**.
- A configuração persiste depois que o domínio termina.
- Macros no cliente, personalizáveis pelo jogador, automatizam tarefas.
- **M1** (2026-11-13; detalhes na [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md)): piloto automático
  declarativo por creep. A 1ª regra com condição verdadeira e ação possível vira a ordem; sem regra válida, o creep
  mantém o que fazia. Creeps nascem com o preset *coletor de matéria*.
- **Coletar com os depósitos zerados** (2026-11-14; revisto pelo dono na sessão 2 do M1.5, 2026-11-14): o creep
  escolhe o depósito não vazio a que chega mais rápido (tempo de viagem pelo mapa que o time conhece, contando as
  estradas) e fica com ele até encher. Se o depósito zerar, **só espera ali a regeneração se compensar**: compara o
  tempo de esperar encher a carga com o tempo de andar até o depósito conhecido mais próximo com matéria
  suficiente, e vai se andar for mais rápido. Se for cristal esgotado, escolhe outro. Motivo: no playtest, os
  coletores disputavam o depósito mais perto do Núcleo e esperavam a regeneração 1 a 1, em vez de pegar a estrada
  pronta até um depósito cheio um pouco mais longe.
- **O piloto automático respeita o fog** (M1.5, 2026-11-14): as condições (ex.: `resourceInRange`) e a escolha
  do depósito usam só o que o time sabe, a visão mais a memória ([01](01-mundo.md)). Um creep não coleta de um
  depósito que o time nunca viu.
- **Ação "explorar"** (M1.5, 2026-11-14): ir até a célula nunca vista mais próxima. Nenhum depósito é garantido à
  vista do Núcleo no início: os creeps começam explorando.
  - **Como começam** (spec do fog, D3): o preset coletor ganha "explorar" logo depois de "coletar", e a regra só
    vale quando o time não conhece depósito do recurso. Um preset novo, **batedor**, só explora; sem nada a
    explorar, volta ao Núcleo.
  - **Alvo** (spec do fog, D4; plan N4): a célula nunca vista mais próxima em passos pelo mapa que o time conhece,
    que nenhum outro creep do time já tenha como alvo. **Entre as igualmente próximas, vence a que revelaria mais
    células nunca vistas no raio de visão do creep** (dono, 2026-11-14, depois de ver o batedor varrer a borda do
    escuro uma linha por vez); o desempate que sobra fica no referencial do time, para os dois lados ficarem
    equivalentes no mapa espelhado.
- **Linha de comando e macros no chat, no M2** (dono, 2026-11-15): o campo do chat também invoca comandos por
  texto, no estilo do BYOND, e aceita macros de cliente. Detalhes no [08](08-cronica-chat-e-console.md). Os scripts
  no servidor continuam para depois (M4).

- **Posturas de encontro** (dono, 2026-11-15; [spec M2 do encontro](../specs/m2-encontro/spec.md) D13, D14): como quase todo encontro acontece sem
  humano olhando, a reação vem do piloto automático.
  - Condição **inimigo à vista** (raio, DNA, carga mínima); ações **abordar** (atacar ou extorquir o inimigo à vista
    mais próximo que passa no filtro) e **catar despojo**.
  - **Regras de reação**, avaliadas só no encontro e na luta: condições "exigência até X‰ da carga" e "HP abaixo
    de X‰"; ações pagar, lutar e fugir.
  - **Sem regra de reação que valha:** paga a extorsão, tenta fugir do ataque e, no meio da luta, continua
    lutando. Os presets de coletor seguem esses padrões.
  - **Preset salteador:** extorquir um inimigo carregado à vista → catar despojo à vista → entregar se cheio →
    explorar; luta quando é atacado e foge com o HP baixo.
  - **A carga mínima do alvo do salteador sobe** (dono, 2026-11-17, depois da F5 do encontro): com carga mínima 1,
    os salteadores do bot extorquiam 1 ou 2 de matéria e repetiam com a mesma vítima depois da fuga, e a crônica
    enchia de ruído. Vale para o preset (o botão "Salteador" do jogador e os salteadores do bot). **Carga mínima
    10** (dono, 2026-11-17, na abertura da F6 do encontro), a capacidade do círculo; provisória. No seed 42 em 3
    dias, os encontros caíram de 112 para 23 e os da zona do Núcleo da vítima, de 93% para 48%
    ([plan](../specs/m2-encontro/plan.md) §11.1, C11).

- **Gambits de batalha** (dono, 2026-11-15; [spec M2 do laboratório](../specs/m2-laboratorio/spec.md) D14, D15):
  na batalha, cada creep não dominado segue uma lista ordenada condição → ação, como o piloto do mundo. Condições
  de HP, distância, alinhamento, projétil vindo, carga e aliado ferido; ações de atacar, aproximar, manter
  distância, esquivar, proteger aliado, fugir, largar a bolsa e catar. Presets por DNA (linha de frente, atirador,
  escaramuçador, portador), editáveis no laboratório. A IA decide com um **tempo de reação** (250 ms ± 100 ms,
  provisório; plan do laboratório, P12): sem ele, ela desviaria de todo projétil.

- **O povo sem o deus online** (dono, 2026-11-20, rodada 5 da
  [estrutura](../brainstorm/2026-11-20-estrutura-seu-time.md) §10.1; com um deus por povo, ninguém do time cobre a
  ausência): por padrão, valem o piloto dos creeps e **o piloto das decisões divinas que o jogador deixou** (o pilar 4).
  **O piloto divino ainda não foi desenhado** (que quests, sussurros e escolhas do povo ele cobre é do tema "Os
  deuses"). Se o jogador quiser, **um deus-bot regente**, com o perfil do kit dele, decide pelo povo enquanto ele está
  fora; a crônica marca o que foi decisão do regente.

## Proposta
- Humanos, macros, piloto automático e bots emitem os **mesmos comandos** ([ADR-0002](../adr/0002-tudo-e-comando.md)).
  Um script nunca tem mais poder do que um humano.
- **Fase 1, declarativo:** uma lista ordenada de regras `condição → ação`, no estilo dos *gambits* de Final
  Fantasy XII. Configurável sem programar, seguro e barato de rodar no servidor.
- **Fase 2, script:** JS rodando em sandbox no servidor (QuickJS/WASM ou isolated-vm), com limite de CPU e
  memória. Referências: Screeps, Gladiabots.
- A mesma interface serve aos **bots de teste**: partidas inteiras rodando sem interface, para balanceamento.

- **A quest do deus para o creep** (ideia do dono, 2026-11-20, em análise; [consolidado](../brainstorm/2026-11-20-consolidado-depois-do-m2.md) §11.2): o deus dá ao
  creep um objetivo ("traga 20 cristais", "explore o norte"), e as regras do creep cuidam do como; pode substituir
  parte dos gambits e do piloto, e ser mais casual que editar regras. O agente propõe que a quest seja uma regra
  temporária no topo da lista, com recompensa, para não haver dois jeitos de comandar. **O deus-bot** (o
  estrategista dos bots com o papel de deus) tem de existir para os times sem jogador.

## Perguntas abertas
- Onde fica o piloto automático: por creep, por grupo de creeps, ou por jogador? (Em parte respondida em 2026-11-20:
  a liga é um **piloto de grupo**, "seguir o líder" numa vaga da formação, [02](02-creeps-e-dominio.md); o resto
  continua por creep.)
- A complexidade permitida (número de regras, CPU do script) é uma mecânica de progressão?
- Qual é a diferença entre uma macro de cliente (só quando você está online) e o piloto automático (no servidor)?
- **Depósito lembrado como vazio** (M2 encontro, checkpoint da F3, 2026-11-17): o piloto só escolhe um depósito
  com quantidade lembrada acima de zero, e um depósito visto esgotado fora da visão do time regenera sem que o time
  saiba. Os coletores esperam em depósitos secos enquanto o outro time coleta ali: no seed 42, 3 dias, o time
  prejudicado entrega 20–25% menos matéria. Revisitar o depósito lembrado vazio depois de um tempo? Mandar um
  creep olhar? O dono decidiu tratar na rodada de balanceamento, fora da F3.
