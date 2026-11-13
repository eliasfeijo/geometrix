# ADR-0001: Mundo e batalha como simulações separadas

**Status:** Accepted (2026-11-13) · **Data:** 2026-11-12

## Contexto
O jogo tem um mundo persistente de dias (economia, construção, governança) e combates em tempo real no estilo
MOBA. Os dois têm requisitos opostos:

| Mundo | Batalha |
|---|---|
| Tick baixo, roda 24/7 | 20–30 ticks por segundo, dura minutos |
| Precisa ser durável (não pode perder dias de partida) | Pode ser efêmera |
| Muitas entidades, pouca atividade cada | Poucas entidades, muita atividade |

## Alternativas
- **A. Uma simulação só, com tick variável por região** (regiões com humanos ativos tickam mais rápido).
  - Prós: sem fronteira entre os dois modos.
  - Contras: a parte durável e a parte em tempo real ficam no mesmo processo; difícil escalar e de manter
    consistente.
- **B. Instâncias de batalha separadas** (escolhida): snapshot dos participantes entra, eventos de resultado saem.
  - Prós: cada lado tem o seu próprio tick e o seu próprio modelo de persistência; batalhas rodam em paralelo,
    em outros processos; o auto-resolve reaproveita a mesma simulação.
  - Contras: semântica de fronteira (bolha, reforços, travar participantes, passagem de tempo).
- **C. Tudo em tempo real.**
  - Contras: custo alto e um mundo de dias não precisa disso.

## Decisão
Opção B, conforme o modelo descrito em [`gdd/06-batalhas.md`](../gdd/06-batalhas.md).

## Consequências
- O contrato entre mundo e batalha (o snapshot e os eventos de resultado) é a interface mais importante do jogo.
  Ele deve ser versionado.
- O mundo deve ser durável e recuperável após crash: log de comandos/eventos + snapshots periódicos.
- A simulação de batalha precisa rodar com ou sem cliente, e acelerada (auto-resolve, testes, balanceamento).
- Ficam em aberto para o design: o gatilho da batalha, a bolha e os reforços, a passagem de tempo.
