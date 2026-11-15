# 06 — Batalhas em tempo real

## Decidido
- O **world state** e o **battle state** são conceitos separados.
- A batalha é uma **instância dedicada** de combate em tempo real, no estilo MOBA. Ela não sincroniza em tempo
  real com o mundo e emite para ele só os eventos que importam.
- Batalhas ganham confrontos, não a guerra (pilar 1).
- **Rodada de design do M2** (dono, 2026-11-15; registro no
  [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md)):
  - **O encontro dispara a batalha.** Quando creeps de lados adversários se encontram, abre uma abordagem com
    diálogo: o agressor escolhe a primeira ação, e a vítima reage se a ação não abrir batalha na hora. O Mount &
    Blade inspira só essa conversa, não o combate. **No M2:** o agressor ataca ou extorque; a vítima paga, recusa
    (batalha) ou foge. A 3ª ação por DNA fica para o M2.5.
  - **Lados, não grupos.** O encontro é no mínimo 1×1 e pode ter mais de dois lados (times, tribos, monstros). Dá
    para entrar numa batalha já começada (ex.: roubar o buff do chefão que o inimigo enfrenta, ou defender a tribo
    atacada). Entra no M2.
  - **Quem vence:** o level, os stats, as skills e a micro de quem joga, humano ou bot. O DNA e a carga não decidem
    sozinhos. No M2, só os stats base por DNA ([02](02-creeps-e-dominio.md)).
  - **Combate experimental e configurável:** regras de combate diferentes atrás do contrato do
    [ADR-0001](../adr/0001-mundo-e-batalha-separados.md), sem uma bloquear a outra. O M2 toca **em paralelo** o
    encontro no mundo e um **laboratório de batalha** local, e junta os dois depois. Até a junção, a luta do encontro
    se resolve por um **sorteio descartável**, que ninguém balanceia.
  - **Salvo-conduto depois de pagar a extorsão:** a vítima fica imune só a novas abordagens do time que extorquiu,
    por um tempo ou até chegar à própria rede de estradas, e perde a proteção se abordar alguém. O mesmo agressor não
    extorque o mesmo creep de novo por um tempo.
  - **Fuga: largar a bolsa e correr.** A vítima larga parte da carga, ou toda, num despojo no chão
    ([03](03-economia-e-logistica.md)) e fica mais rápida; o agressor escolhe entre catar ou perseguir.
  - **As perdas valem no mundo:** a morte é permanente ([02](02-creeps-e-dominio.md)), e o HP de creeps e
    construções persiste depois da batalha ([01](01-mundo.md), [02](02-creeps-e-dominio.md)).
  - **Chefão disputado** (M2.5): quando dois lados ferem o mesmo chefão, leva o buff ou o item quem dá o último
    golpe ([05](05-tribos-e-diplomacia.md)).

## Proposta
Ver [ADR-0001](../adr/0001-mundo-e-batalha-separados.md).
- **Entrada:** quando uma batalha começa, o mundo congela os participantes (creeps, inventários, um recorte do
  terreno) e os entrega à instância.
- **Saída:** ao terminar, a batalha devolve um **resultado em forma de eventos** (mortes, XP, saques,
  transferências de recursos, estruturas destruídas). O mundo aplica esses eventos.
- **Sem humanos:** se nenhum jogador estiver presente, a batalha roda sem interface e em velocidade acelerada, com
  a **mesma simulação**, decidida pelo piloto automático (auto-resolve). Humanos que chegam no meio podem dominar
  um creep e assumir.

```mermaid
sequenceDiagram
    participant W as Mundo (tick baixo)
    participant B as Batalha (tempo real)
    W->>B: snapshot dos participantes + terreno
    Note over W: participantes ficam travados no mundo
    B-->>B: combate (humanos dominando e/ou piloto automático)
    B->>W: eventos de resultado
    W->>W: aplica os eventos e libera os participantes
```

### Brainstorm de 2026-11-15 (não aprovado)
Detalhes e análise no [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §2 e §6.
- **Candidatas de combate** (agente): grade (jogos de ação do BYOND, a primeira), livre (MOBA-lite), a camada de
  forja (Summon Night: Swordcraft Story: armas físicas, durabilidade, vencer quebrando a arma) e o tático só com
  gambits, que é o próprio auto-resolve. O laboratório mede a latência aceitável de cada uma com latência simulada.
- **Contrato com entrada no meio da luta** (agente): com lados e participantes que chegam depois, a instância deixa
  de receber o snapshot uma vez só; o mundo continua a alimentá-la. Pede um ADR (`Proposed`) na spec do M2.
- **Iniciativa no encontro mútuo** (ideia do dono, forma do agente): quem está fora do rio e com menos carga
  relativa escolhe primeiro; desempate pelo `state.rng`, nunca pelo id. Decide só quem escolhe, não quem vence.
- **Batalha curta** (agente): 1 a 2 min; cada humano controla só o creep que domina.
- **Diálogo só na abertura** (agente): quem entra no meio da luta não passa pela conversa; a crônica registra a
  entrada ([08](08-cronica-chat-e-console.md)).

## Perguntas abertas
- Qual é o raio do encontro e da "bolha" da batalha? Até que distância alguém pode entrar no meio da luta? (Que
  reforços e terceiros entram já está decidido.)
- Quanto dura a janela de resposta do encontro, em segundos de mundo?
- Duração máxima de uma batalha e como ela termina (aniquilação, recuo, tempo).
- Quanto tempo do mundo passa durante uma batalha?
