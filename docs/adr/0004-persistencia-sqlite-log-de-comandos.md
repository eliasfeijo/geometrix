# ADR-0004: Persistência do mundo: SQLite + snapshots + log de comandos + Litestream

**Status:** Accepted (2026-11-13) · **Data:** 2026-11-13
**Relaciona:** ADR-0001 (o mundo precisa ser durável), ADR-0002 (tudo é comando), ADR-0003 (simulação
determinística)

## Contexto
Um mundo dura dias e não pode ser perdido num restart ou crash. Cada mundo tem **um único escritor**: o processo
que o simula. A simulação é determinística, então o estado pode ser reconstruído a partir de um snapshot + os
comandos seguintes. Também precisamos guardar as métricas do harness e os logs de replay.

## Alternativas
- **A. SQLite embutido, um arquivo por servidor, com backup contínuo via Litestream** (escolhida).
  - Prós: zero infraestrutura; transações; latência de disco local; casa com o modelo de escritor único; o backup
    para object storage custa centavos.
  - Contras: preso à máquina (escala por shard de mundos, não por réplicas de escrita).
- **B. Postgres gerenciado.**
  - Prós: padrão de mercado; serve vários processos.
  - Contras: custo e operação desnecessários para escritor único; latência de rede a cada snapshot.
- **C. Só arquivos (snapshot JSON + log JSONL).**
  - Prós: o mais simples possível.
  - Contras: sem transação; métricas e consultas ficam desconfortáveis; reinventa durabilidade.
- **D. Event sourcing completo** (gravar todos os eventos, inclusive os gerados pelo piloto automático).
  - Contras: redundante, porque a simulação é determinística; o volume cresce sem necessidade.

## Decisão
Opção A, com o modelo:
- **Log de comandos:** só as entradas **externas** à simulação, ou seja, comandos humanos, edições de regras de
  piloto automático e parâmetros de criação do mundo. Cada uma leva o número do tick em que foi aplicada. O que o
  piloto automático decide é recalculado a partir do estado e não é gravado.
- **Snapshot** do estado completo a cada N ticks (N é parâmetro), mais o hash do estado.
- **Recuperação:** carregar o último snapshot e reaplicar os comandos posteriores. A perda máxima é o que estava
  em memória antes da escrita (alguns ticks).
- **Métricas do harness** em tabelas próprias, no mesmo arquivo ou num arquivo separado.
- **Replay** = snapshot inicial + log. É o mesmo formato da recuperação.
- **Backup:** Litestream replica o SQLite continuamente para object storage S3 compatível.

## Consequências
- O log de comandos vira contrato: é versionado junto com o vocabulário de comandos (ADR-0002).
- Uma mudança nas regras da simulação invalida o replay de mundos antigos. Mundos e replays guardam a versão da
  simulação; um mundo em andamento termina na versão em que começou, ou passa por uma migração explícita.
- A escala horizontal acontece por **shard de mundos** entre processos e máquinas, nunca com dois escritores no
  mesmo mundo.
- Driver: `better-sqlite3` (maduro e síncrono, o que combina com o loop de tick) ou `node:sqlite`, a decidir no
  `plan.md`.
