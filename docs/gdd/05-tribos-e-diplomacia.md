# 05 — Tribos neutras e diplomacia

## Decidido
- A jungle tem **monstros** (fonte de XP) e **tribos neutras**.
- Uma tribo pode se tornar **aliada ou rival** de qualquer time e decidir o resultado da partida.
- A diplomacia com as tribos afeta a economia do time.
- **Rodada de design do M2** (dono, 2026-11-15; registro no
  [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md)):
  - **Errantes no M2:** creeps hostis por natureza que vagam rápido, mais frágeis e fracos que os chefões, e
    reaparecem cada vez mais frequentemente conforme a partida avança. Podem entrar numa batalha entre times que
    estiver por perto ([06](06-batalhas.md)).
  - **Chefões no M2.5** (marco novo, "A jungle hostil"): moram num ponto do mapa, são lentos e reaparecem bem mais
    devagar. Os **chefões-buff** dão ao time que os derrotar um buff (ex.: carga máxima, velocidade) que dura no
    máximo até o respawn, e ficam **no caminho do inimigo**, para o buff ser disputado. O **chefão do rio**, mais forte,
    fica no meio do caminho entre os Núcleos, perto do rio, dropa um item raro e mora numa **casinha de pedra** que é
    ao mesmo tempo ponto cego dele (não vê quem chega pela frente imediata) e esconderijo dele (não é visto de
    longe). Quando dois lados ferem o mesmo chefão, leva o buff ou o item **quem dá o último golpe**.
  - **Tribos no M4**, como no ROADMAP. Uma tribo-protótipo (conversa e uma quest de entrega) só antecipa se os
    encontros do M2 provarem diversão.
- **Fim do mundo** (dono, 2026-11-15; registro no
  [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md) §0):
  - **O final feliz secreto:** a única forma de não morrer no apocalipse ([01](01-mundo.md)) é seguir a quest das
    tribos neutras. Ele **salva o mundo inteiro**, inclusive o time inimigo. Entra no M4, com as tribos.
  - **A jungle que acorda:** as ondas de errantes e os chefões despertos são camadas do apocalipse, por cima da
    corrupção.
  - **Invasores de outros mundos:** lendas ([02](02-creeps-e-dominio.md)) invadem um mundo no fim, no M5 (As lendas).

## Proposta

### Brainstorm de 2026-11-15 (não aprovado)
Detalhes e análise no [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §3 e §4.
- **Encontro com a tribo** (ideia do dono): iniciar batalha ou conversar, com uma história por DNA de tribo. O
  diálogo só aparece para o time que interagiu.
- **Quests pagas pelo estoque físico da tribo** (ideia do dono): ex.: 150 cristais por um creep único, ou derrotar
  um chefão pelo artefato sagrado (item que cai no chão se o portador morrer). O agente propõe que toda quest seja um
  pedido nos verbos que o mundo já tem: carregar, explorar, construir, lutar, escoltar.
- **Relação por creep** (ideia do dono): troca de material e ações novas conforme a afinidade do creep que
  interage, o DNA, o level e os stats, além da relação do time.
- **Jungle hostil** (agente): nada de buff de dano puro (o buff é logístico, a assinatura do geometrix); o item do
  rio só funciona entregue no Núcleo (escolta pelo mapa, cruzando um vau); os monstros são a primeira facção neutra
  do `sim`, a base das tribos.

### Fim do mundo: como fazer (agente, 2026-11-15, não aprovado)
A direção está em Decidido; o detalhe, no [brainstorm do fim do mundo](../brainstorm/2026-11-15-fim-do-mundo.md)
§4.3, §4.6 e §4.7.
- **O caminho do final feliz varia por seed** (qual tribo, qual artefato, onde) e se descobre sob o fog, porque um
  segredo fixo morre no primeiro replay compartilhado. A quest final é física: ex.: escoltar o artefato da tribo até
  o foco mais antigo da corrupção, cruzando um vau. Como ele salva o mundo inteiro, os dois times podem cooperar
  ou sabotar o ritual um do outro.
- **A curva dos errantes por ato** do fim do mundo, na fatia D do M2; no ato 3, os chefões do M2.5 saem da toca e
  marcham para os Núcleos.
- **Invasores:** um por time, com o mesmo orçamento de poder, cada um com o objetivo de destruir um dos times.
- **Um lado que não é um time:** errantes, chefões, tribos e invasores. O ADR do lado neutro, na fatia D, lista
  esses quatro consumidores como restrições, sem construir nenhum antes da hora.

## Perguntas abertas
- Onde exatamente fica cada chefão-buff "no caminho do inimigo": no lado do rio do inimigo, ou perto de um vau?
- Como a relação com uma tribo sobe ou desce: comércio, tributo, missões, ataques, proximidade?
- O que uma tribo aliada faz: luta junto, comercia, cede território, fornece creeps?
- A diplomacia é decisão coletiva (governança) ou qualquer jogador pode negociar?
- As tribos se relacionam entre si?
- Uma tribo pode ser conquistada ou absorvida?
