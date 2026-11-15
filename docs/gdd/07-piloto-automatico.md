# 07 — Piloto automático e macros

## Decidido
- Os creeps têm um piloto automático **configurável** e, possivelmente, **scriptável**.
- A configuração persiste depois que o domínio termina.
- Macros no cliente, personalizáveis pelo jogador, automatizam tarefas.
- **M1** (2026-11-13; detalhes na [spec M1 §5](../specs/m1-ciclo-da-riqueza/spec.md)): piloto automático
  declarativo por creep. A 1ª regra com condição verdadeira e ação possível vira a ordem; sem regra válida, o creep
  mantém o que fazia. Creeps nascem com o preset *coletor de matéria*.
- **Coletar com os depósitos zerados** (2026-11-14): o creep escolhe o depósito não vazio mais próximo e fica com
  ele até encher. Se o depósito zerar, espera ali a regeneração; se for cristal esgotado, escolhe outro. Deixar um
  depósito rico sem uso é uma decisão do jogador, que pode mandar creeps para lá.
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
