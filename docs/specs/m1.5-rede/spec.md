# Spec M1.5 — Rede: deltas da visão de cada time

**Status:** Aprovada (2026-11-14) · **Data:** 2026-11-14 · **Marco:** M1.5 — A névoa ([ROADMAP](../../ROADMAP.md)), fatia 1 de 2
**ADR:** [0006](../../adr/0006-sync-do-mundo.md) (`Accepted`, 2026-11-14) · **GDD relacionado:**
[01](../../gdd/01-mundo.md) (fog of war, a fatia seguinte)

## 1. Hipótese

> Mandar a cada cliente só **o que mudou na visão do time dele** reduz a banda por cliente para dentro da estimativa
> do ADR-0005, a um custo de CPU que cabe em centenas de mundos por processo, **sem divergência** entre o que o
> servidor acredita que o cliente vê e o que ele vê, inclusive com quedas, reconexões e restarts do servidor.

Esta fatia **não muda o gameplay**: o que cada jogador vê na tela continua igual ao M1. Ela responde:
1. O ADR-0006 é viável na prática (banda, CPU, correção)? Se não for, o ADR volta à mesa (regra 10 do ADR).
2. A **visão do time** como função pura do `sim` está pronta para a fatia de fog of war filtrar o que é escondido?

## 2. Contexto

Hoje (plan M1 P3) o servidor manda o estado dinâmico completo em JSON depois de cada tick, no máximo 5 vezes por
segundo: 26,5 KB por mensagem com 60 creeps. As medições do ADR-0006 (seed 42, `default.json`, versão ingênua):

| | Por mensagem, 60 creeps | CPU por mundo por envio |
|---|---|---|
| Estado completo (hoje) | 26,5 KB | ~0,12 ms (`JSON.stringify`) |
| Delta por campo da visão, sem `movePoints`/`trip`/`path` | ~0,4 KB por time | ~0,8 ms (montar as 2 visões + 2 diffs) |

A banda já está provada. A CPU e a correção (a classe de bug "patch aplicado sobre a base errada") são o que esta
fatia precisa validar.

## 3. Decisões de escopo que esta spec assume

Aceitas pelo dono com a spec (2026-11-14).

| # | Decisão | Padrão proposto | Por quê |
|---|---|---|---|
| D1 | O que a visão contém, sem fog | Exatamente o que o cliente recebe hoje (`DynamicState`), **menos** `movePoints`, `trip` e `path`, que o cliente não usa. O outro time continua visível, como no M1 (spec M1, D5) | Sem mudança visível; a fatia de fog filtra depois |
| D2 | Um stream por time | Os jogadores do mesmo time veem a mesma coisa: um diff e uma sequência por time, compartilhados pelos sockets dele | 2 diffs por mundo por envio, não um por jogador |
| D3 | Bots leem a visão | O estrategista decide a partir da visão do próprio time mais o mapa estático (que todo cliente recebe no `welcome`), não do estado completo | Regra 2 do ADR-0006: um bot não sabe mais que um humano do time |
| D4 | Sem mudança de gameplay | O hash de 3 dias do seed 42 (`10662729…`) **não muda**, e o `SIM_VERSION` continua 2 | Prova que D3 não alterou nenhuma decisão |
| D5 | Formato | JSON cru, sem compressão nem binário | ADR-0006; binário só se a medição pedir |
| D6 | Versão do protocolo | O `welcome` leva uma versão do protocolo; o cliente com outra versão avisa e recarrega a página | Uma aba velha não aplica deltas num formato que não conhece |
| D7 | Spike de biblioteca | O plan começa com um spike curto (alternativa E do ADR-0006: o schema do Colyseus) antes de escrever o diff à mão; o resultado vai para o plan | Recomendação do ADR; a parte mais sujeita a bug pode já existir pronta |
| D8 | Painel de rede no cliente | Um painel discreto, só com `?net=1` na URL: bytes/s recebidos, `seq` atual, retomadas e resyncs | Validar localmente sem abrir o DevTools; não é UI de jogo |

## 4. Escopo

### Dentro
- **Visão do time** no `sim`: função pura `estado + time → visão` (D1).
- **Estrategista** lendo a visão (D3, D4).
- **Diff e patch** da visão: entidades novas, campos alterados, ids removidos, estradas novas.
- **Protocolo:** `welcome` com a visão-base e o `seq`; delta numerado; hash periódico; pedido de resync; retomada
  na reconexão; versão do protocolo (D6).
- **Servidor:** a última visão enviada e um buffer de deltas recentes por time; resposta a resync e retomada.
- **Cliente:** aplica deltas no lugar de trocar o estado; interpolação igual; painel de rede (D8).
- **Harness:** teste de propriedade, medição de banda e CPU, e o soak com clientes conectados (seção 7).

### Fora
Fog of war (a fatia seguinte, depois da rodada de design do GDD 01), restringir o export de replay a mundos
encerrados (vai junto com o fog), compressão, formato binário, sincronização da batalha (M2), deploy (M2), podar
snapshots, mudanças de gameplay ou de visual.

## 5. Comportamento

Formato: *Quando [gatilho], o sistema deve [resposta].*

### Visão
- **V-1** Dado um estado e um time, a visão deve ser sempre a mesma (função pura, sem relógio nem aleatoriedade).
- **V-2** Sem fog, a visão deve conter tudo o que o `DynamicState` do M1 contém, menos `movePoints`, `trip` e
  `path` (D1).
- **V-3** Quando o estrategista bot decide, ele deve ler só a visão do próprio time e o mapa estático (D3), e um
  mundo bot × bot de 3 dias deve terminar com o mesmo hash de antes (D4).

### Servidor
- **S-1** Quando um cliente conecta, o servidor deve mandar no `welcome` a **última visão enviada** ao time dele (não
  o estado atual) e o `seq` dessa visão, além do que o `welcome` já leva hoje (mapa estático, parâmetros…) e da
  versão do protocolo.
- **S-2** Depois de cada envio (o teto de 5 por segundo continua), o servidor deve mandar a cada time um delta com
  `seq` = anterior + 1, o `tick` e as mudanças da visão desde o envio anterior.
- **S-3** O delta deve listar, por coleção, as entidades novas (inteiras), os campos que mudaram nas existentes e os
  ids removidos, e as estradas novas.
- **S-4** A cada `N` ticks (configuração do servidor), o delta deve levar o hash da visão do time depois de
  aplicado.
- **S-5** Quando um cliente reconecta informando o último `seq` aplicado, e esse `seq` ainda está no buffer de
  deltas recentes do time, o servidor deve reenviar os deltas seguintes, em ordem. Se o `seq` não está no buffer
  (inclusive depois de um restart do servidor), deve mandar a visão completa, como um `welcome`.
- **S-6** Quando um cliente pede resync, o servidor deve mandar a visão completa e registrar o incidente (time,
  tick, `seq`, motivo).
- **S-7** Comandos (`command`, `ack`, `reject`) não mudam.

### Cliente
- **C-1** Quando chega um delta com o `seq` esperado, o cliente deve aplicá-lo à visão que tem. A interpolação (os
  dois últimos estados) e tudo o que a tela mostra devem continuar como no M1.
- **C-2** Quando chega um delta com `seq` fora de ordem numa conexão viva, o cliente deve pedir resync e registrar o
  incidente (sobre TCP isso indica bug; ADR-0006, regra 5).
- **C-3** Quando o hash do delta não confere com o da visão do cliente, ele deve pedir resync e registrar o
  incidente.
- **C-4** Quando a conexão cai, o cliente deve reconectar informando o último `seq` aplicado (S-5).
- **C-5** Quando a versão do protocolo do `welcome` difere da sua, o cliente deve avisar e recarregar a página (D6).
- **C-6** Com `?net=1` na URL, o cliente deve mostrar o painel de rede (D8).

## 6. Parâmetros iniciais (chutes, para serem quebrados)

Configuração do servidor (não é balanceamento; fica fora dos parâmetros do `sim`, como no F6):

| Parâmetro | Chute |
|---|---|
| Hash da visão a cada `N` ticks | 60 (1 min de mundo) |
| Buffer de deltas recentes por time | 30 s reais |
| Envios por segundo (teto) | 5 (sem mudança) |

## 7. Harness e critérios de viabilidade

Os critérios abaixo decidem a regra 10 do ADR-0006. **Se algum reprovar, o ADR volta a ser discutido** antes de
seguir para o fog. Os alvos são chutes provisórios.

| Critério | Alvo | Como se mede |
|---|---|---|
| Banda por cliente, ×1, 60 creeps | ≤ 2 KB/s em média (teto do ADR-0005) | Harness: visão + diff a cada tick de um mundo bot × bot de 3 dias, bytes do delta serializado |
| CPU de visão + diff, os 2 times, 60 creeps | ≤ 0,25 ms por mundo por envio, na mediana (hoje ~0,12 ms; ingênuo ~0,8 ms) | Harness, na mesma execução; o hash periódico entra amortizado |
| Correção do diff | `patch(visão anterior, diff) = visão nova`, em todo tick, para os 2 times | Teste de propriedade: 6 h de mundo nos seeds do CI (1, 42, 649) no CI; 3 dias no checkpoint |
| Sem mudança de gameplay | Hash de 3 dias do seed 42 igual a `10662729…` | `geo sim` / `geo verify` |
| Sem divergência com quedas | 0 hashes divergentes; visão final de cada cliente com o hash do servidor | `npm run soak` com clientes conectados (abaixo) |
| Retomada | Queda curta dentro do buffer retoma sem visão completa; depois de um restart, visão completa | Teste de integração do servidor e relatório do soak |

**Soak com clientes:** o `npm run soak` passa a manter clientes WebSocket sem interface (Node) conectados o mundo
inteiro (chute: 2 por time), que aplicam os deltas como o cliente do navegador. O relatório acrescenta, por
cliente: bytes recebidos (média e pico por segundo), retomadas, visões completas por causa (entrada, restart,
resync), hashes divergentes, e se a visão final confere com a do servidor.

**Métricas registradas:** banda média e pico por cliente; CPU de visão, de diff e do hash por envio (mediana e
p95); tamanho do delta ao longo do mundo; incidentes de resync por causa.

## 8. Protocolo de teste

1. **Testes** (`sim`, `protocol`, `server`, `client`): visão, diff, patch, sequência, retomada, resync, versão do
   protocolo. O teste de propriedade roda no CI.
2. **Medição no harness:** banda e CPU num mundo de 3 dias (seção 7).
3. **Soak com clientes:** `npm run soak` completo (×360, quedas forçadas), com o relatório da seção 7.
4. **Sessão do dono:** `npm run dev:multi` com `?net=1`. A tela deve ser idêntica à do M1; derrubar e subir o
   servidor no meio para ver a retomada.

### Critério para seguir para a fatia de fog
- Todos os critérios da seção 7 verdes, ou o dono decide o que fazer com o que reprovou.
- O dono revisa o relatório de viabilidade no checkpoint.

## 9. Pré-requisitos antes do `plan.md`

- [ADR-0006](../../adr/0006-sync-do-mundo.md) `Accepted` ✅ (2026-11-14).
- Se o spike (D7) recomendar uma biblioteca no centro do protocolo, isso vira uma emenda ao ADR-0006 (skill `adr`)
  antes das tasks.

## 10. Perguntas abertas

Nenhuma no momento.
