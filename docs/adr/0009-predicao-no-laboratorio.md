# ADR-0009: Predição do próprio creep como opção de experimento do laboratório

**Status:** Proposed · **Data:** 2026-11-20
**Relaciona:** ADR-0008 (item 9: a página do laboratório renderiza só o que recebe, sem predição; este ADR é uma
emenda a ele), ADR-0002 (tudo é comando: a autoridade continua na simulação), [plan do laboratório](../specs/m2-laboratorio/plan.md)
§15 (C10, C11), [spec do laboratório](../specs/m2-laboratorio/spec.md) (L-3)

## Contexto

No checkpoint da F5 (2026-11-19 e 20), às cegas, a regra de grade ficou com nota 4 ou mais até 100 ms de RTT. O que
mais incomodou o dono não foi a latência em si, mas **"a pausa entre cada movimento"**: a página desliza o creep
durante um tick (50 ms, plan P8), e o ▲ leva 250 ms por célula, então, segurando a tecla, ele desliza 50 ms e fica
~200 ms parado em cada célula. Sem interpolar, a pausa continua, mas o creep pula no mesmo tick da ação. O dono
pediu para comparar as opções antes de decidir (C11), e a predição no cliente voltou à mesa para depois da junção
(C10).

O ADR-0008 (item 9) diz que a página do laboratório **renderiza só o que recebe, sem predição**. Uma das opções a
comparar, a de "prever o meu creep", desenha o creep dominado adiantado, antes de o quadro do *worker* chegar.
Isso contradiz o item 9 ao pé da letra, embora a simulação não mude.

## Alternativas

- **A. Uma opção de experimento, só de desenho, no laboratório** (recomendada).
  - O que é: no seletor "Movimento" da "Rede simulada", ao lado de "sem interpolar", "interpolar (1 tick)" e
    "deslizar o passo inteiro", a opção "prever o meu creep": enquanto uma direção está segurada e as células à frente
    estão livres no último quadro, a página desliza o creep dominado na velocidade do DNA, sem esperar o quadro; cada
    quadro o puxa de volta se ele correu demais ou saiu do caminho. A autoridade continua no *worker*: os comandos, o
    log, o hash e o resultado não mudam, e os outros creeps continuam desenhados só pelos quadros.
  - Prós: o dono compara as quatro opções na mesma página, às cegas se quiser, com o atraso medido; não cria
    código de rede nem de simulação novo; não decide nada para o jogo.
  - Contras: a página passa a desenhar algo que não veio do canal (só para essa opção); a correção pode "puxar" o
    creep de volta quando a previsão erra (bloqueio por outro creep, disputa de célula).
- **B. Manter o item 9 e comparar só as opções sem predição.**
  - Prós: nada muda no ADR-0008.
  - Contras: o dono não teria como sentir a predição antes de decidir, e a C11 pede a comparação.
- **C. Predição de verdade, com reconciliação pelo log de comandos (rodar a simulação no cliente).**
  - Prós: é o que um deploy com latência alta talvez precise.
  - Contras: é a decisão de rede da junção e do deploy (C10), grande demais para um experimento; fica para depois.

## Decisão

Proposta: a alternativa A. O item 9 do ADR-0008 ganha uma exceção: **no laboratório, uma opção de experimento
pode desenhar o creep dominado adiantado; a simulação e a autoridade continuam só no *worker***. A predição no jogo
(mundo e batalha da junção) não é decidida aqui: volta à mesa depois da junção, com o que o dono achar desta
comparação.

## Consequências

- A F7 do laboratório implementa as quatro opções (`apps/client/src/lab/motion.ts`), o registro de cada batalha
  guarda a opção usada e o PLAYTEST ganha um grupo para compará-las a 0 e a 150 ms.
- Se o dono aceitar, o ADR-0008 (item 9) ganha uma nota apontando para este ADR. Se rejeitar, a opção "prever o
  meu creep" sai do laboratório.
- A escolha do desenho do movimento no jogo (qual opção, ou nenhuma) é uma decisão de gameplay do dono, que vem
  depois de jogar; ela não depende deste ADR.
