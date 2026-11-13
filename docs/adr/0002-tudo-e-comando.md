# ADR-0002: Toda ação na simulação é um comando

**Status:** Accepted (2026-11-13) · **Data:** 2026-11-12

## Contexto
Muitas fontes agem sobre os mesmos creeps: o humano dominando um creep, macros no cliente, o piloto automático
(declarativo ou scriptado) no servidor, bots de teste, delegação de voto. Se cada fonte tiver o seu próprio caminho
até a simulação, o resultado é regras duplicadas e brechas para trapaça.

## Decisão
A simulação (do mundo e da batalha) só muda por **comandos** validados pelo servidor (`moveTo`, `cast`, `gather`,
`deliver`, `build`, `vote`, …). Toda fonte de controle produz comandos, e a simulação não sabe quem os gerou.
Dominar um creep só troca a fonte dos comandos dele.

## Consequências
- Um script ou piloto automático nunca pode fazer mais do que um humano faria. Isso é o anti-cheat estrutural.
- Replays e testes reproduzíveis ficam baratos: estado inicial + seed + log de comandos. Isso exige simulação
  determinística (tick fixo, RNG com seed, nada de `Math.random`).
- Os bots de teste usam a mesma interface. É o que viabiliza o harness de balanceamento sem interface gráfica.
- O vocabulário de comandos vira um contrato, que precisa ser documentado e versionado.
