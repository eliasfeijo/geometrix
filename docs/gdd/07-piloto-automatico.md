# 07 — Piloto automático e macros

## Decidido
- Os creeps têm um piloto automático **configurável** e, possivelmente, **scriptável**.
- A configuração persiste depois que o domínio termina.
- Macros no cliente, personalizáveis pelo jogador, automatizam tarefas.
- **M1** (2026-11-13; detalhes na [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md)): piloto automático
  declarativo por creep. A 1ª regra com condição verdadeira e ação possível vira a ordem; sem regra válida, o creep
  mantém o que fazia. Creeps nascem com o preset *coletor de matéria*.

## Proposta
- Humanos, macros, piloto automático e bots emitem os **mesmos comandos** ([ADR-0002](../adr/0002-tudo-e-comando.md)).
  Um script nunca tem mais poder do que um humano.
- **Fase 1, declarativo:** uma lista ordenada de regras `condição → ação`, no estilo dos *gambits* de Final
  Fantasy XII. Configurável sem programar, seguro e barato de rodar no servidor.
- **Fase 2, script:** JS rodando em sandbox no servidor (QuickJS/WASM ou isolated-vm), com limite de CPU e
  memória. Referências: Screeps, Gladiabots.
- A mesma interface serve aos **bots de teste**: partidas inteiras rodando sem interface, para balanceamento.

## Perguntas abertas
- Onde fica o piloto automático: por creep, por grupo de creeps, ou por jogador?
- A complexidade permitida (número de regras, CPU do script) é uma mecânica de progressão?
- Qual é a diferença entre uma macro de cliente (só quando você está online) e o piloto automático (no servidor)?
