# 08 — Crônica, chat e console

## Decidido
- **Rodada de design do M2** (dono, 2026-11-15; registro no
  [brainstorm M2–M3](../brainstorm/2026-11-15-m2-m3.md) §2):
  - **Crônica:** os diálogos dos encontros ([06](06-batalhas.md)) e os eventos do jogo aparecem como texto na
    partida, para jogadores e bots. O diálogo com uma tribo só aparece para o time que interagiu com ela
    ([05](05-tribos-e-diplomacia.md)).
  - **Chat livre** entre humanos, no M2.
  - **Linha de comando no chat**, no estilo do BYOND (em que o chat global se digitava como `OOC:"texto"` e um verbo
    invocava um comando sem interface): o campo do chat também aceita os comandos do vocabulário que já existe
    ([ADR-0002](../adr/0002-tudo-e-comando.md)) e outros complementares. Tira peso do painel lateral, que cresce a
    cada sistema (e o HP, os stats e o level ainda nem entraram).
  - **Macros de cliente** no M2: sequências de verbos num atalho, com **rate limit**. Os scripts personalizados no
    servidor ficam para o M4 ([07](07-piloto-automatico.md)).
  - **Sem LLM** para gerar o texto em tempo de execução.

## Proposta
- **O texto não mora no `sim`** (agente): o `sim` emite eventos estruturados (quem, o quê, quanto, uma semente) e o
  cliente os narra por modelos e uma gramática simples, escolhida pela semente. Todos leem a mesma frase, o texto muda
  sem trocar o `SIM_VERSION`, pode ser traduzido e o dono escreve sem mexer na simulação. Os bots leem o evento, não
  o texto. Hoje o `sim` não emite eventos: é um contrato novo, provável ADR na spec do M2.
- **Voz pelo DNA no M2, pelo temperamento no M2.5** (agente): sem temperamentos no M2
  ([02](02-creeps-e-dominio.md)), a frase de cada creep vem do DNA e da ação.
- **Um verbo, um comando** (agente): cada verbo do console vira um comando do mesmo vocabulário versionado, com as
  mesmas validações e recusas de quem clica. Nenhum verbo tem mais poder do que a interface.
- **LLM na autoria** (agente): gerar e revisar o banco de modelos offline, fora do jogo.

## Perguntas abertas
- Que canais existem: time, global (o `OOC` do BYOND), sussurro? O que um bot "lê" no chat?
- Sintaxe dos verbos: `say`, `ooc`, `/comando`? Nomes em português, em inglês ou os dois?
- O rate limit: quantas mensagens e quantos comandos por janela? É igual para macro e para digitação?
- Onde as macros ficam guardadas: só no navegador, ou no servidor, por jogador?
- Com três ou mais lados num encontro, quem vê a crônica dele? Mostrar para todos revela a posição e a carga de
  creeps sob o fog.
- No deploy, o chat livre precisa de moderação (denúncia, silenciar, filtro)?
