# ADR-0006: Sincronização do mundo por fluxo de comandos, com a simulação rodando no cliente

**Status:** Proposed · **Data:** 2026-11-14
**Relaciona:** ADR-0002 (tudo é comando: é o que torna esta opção possível), ADR-0003 (o mesmo `sim` no navegador),
ADR-0004 (o que o banco guarda), ADR-0005 (transporte por WebSocket, que não muda), plan M1 P3 (estado completo, que
este ADR revisita), [OVERVIEW §7](../OVERVIEW.md#7-sync-via-websocket-quanto-custa-e-escala), GDD
[01](../gdd/01-mundo.md) (fog of war, pergunta aberta)

## Contexto

No M1, o servidor manda o **estado dinâmico completo** em JSON depois de cada tick, com no máximo 5 envios por
segundo (plan P3: "deltas só se a medição mostrar necessidade"). Para o M1 local foi a escolha certa: simples e sem
bug de dessincronização. A medição agora mostra a necessidade. A ×1 sai uma mensagem por segundo, e com 60 creeps
ela tem 26,5 KB. São 13–26× a estimativa do ADR-0005 (1–2 KB/s por cliente), ~2,3 GB por cliente por dia de mundo
e ~128 Mbit/s com 100 mundos de 6 jogadores. O deploy é a primeira etapa do M2 ([ROADMAP](../ROADMAP.md)), e esta
decisão precisa vir antes dele.

Depois de ler o OVERVIEW, um dev de fora do projeto fez três observações. Elas são o ponto de partida deste ADR:
1. **Compressão (`permessage-deflate`) tem custo.** Correto: o próprio README do `ws` avisa que o deflate no Node
   pode causar fragmentação de memória e lentidão sob concorrência, e recomenda um teste de carga antes de usar em
   produção. O custo fica no servidor (um contexto zlib por socket); no navegador, descomprimir é nativo e barato.
2. **Mandar só o que mudou em vez do estado completo.** Correto, e a medição abaixo mostra que o OVERVIEW subestimou
   o ganho.
3. **Capturar as mudanças do banco e mandar esse delta.** Não se aplica literalmente (alternativa D), mas, levada à
   fonte das mudanças, a ideia vira a alternativa C.

### Medições

Seed 42, `default.json`, bot × bot, média de 20 pares de estados consecutivos, a ×1 (1 tick entre mensagens).

| Modelo | Por mensagem, 60 creeps (48 h) | Com 12 creeps (6 h) | Observação |
|---|---|---|---|
| Estado completo (hoje) | 26,5 KB | 7,1 KB | |
| **A.** Estado completo + deflate | ~0,5 KB | — | Medido como o deflate de uma mensagem com a anterior no dicionário |
| **B.** Delta por campo | 1,1 KB | 0,45 KB | Em média, 28 dos 60 creeps mudam por tick |
| **B'.** Delta por campo, sem `movePoints` | 0,45 KB | 0,24 KB | O cliente não usa `movePoints`; sem ele, só 7 creeps mudam por tick |
| **C.** Fluxo de comandos | ~45 B por tick sem comando | ~45 B | Um mundo bot × bot de 3 dias inteiro tem **74 comandos, 7,6 KB no total** |

Na entrada (uma vez por conexão), a opção C manda o estado serializado inteiro: 26 KB no começo e ~49 KB com 60
creeps. A verificação de hash custa ~0,7 ms (`serialize` + SHA-256, 26 KB).

## Alternativas

- **A. Manter o estado completo e ligar `permessage-deflate`.**
  - Prós: uma linha de configuração; o protocolo e o cliente não mudam.
  - Contras: CPU e memória de compressão **por socket** no servidor (o `ws` comprime cada envio separadamente),
    com o aviso de fragmentação de memória do próprio `ws`. Resolve a banda criando outro gargalo. Pede um teste de
    carga antes de produção.
- **B. Delta por campo, calculado no servidor.** O servidor guarda o último estado enviado, compara campo a campo e
  manda só as diferenças. O cliente aplica o patch.
  - Prós: 24× menos banda (59× sem `movePoints`), em JSON cru, sem compressão. O cliente continua sem simulação,
    só exibindo o estado. Funciona com fog of war (o servidor escolhe o que cada um vê).
  - Contras: código novo dos dois lados (diff, patch, remoção de entidades a partir do M2, que tem morte), e uma
    classe nova de bug: o patch aplicado sobre a base errada. Pede um número de sequência, um estado-base bem
    definido na entrada e um quadro completo periódico ou um hash para detectar a divergência. Com fog, o diff passa
    a ser por jogador, não mais um por mundo.
- **C. Fluxo de comandos, com o `sim` rodando no cliente** (recomendada). O servidor manda, para cada tick, só os
  comandos aplicados nele. O cliente restaura o estado da entrada e roda o mesmo `step`. É o modelo de lockstep dos
  RTS, mas com o servidor como autoridade: ele valida e ordena os comandos, e o cliente nunca decide nada.
  - Prós:
    - banda praticamente zero: ~45 B por tick, e os comandos são raros (o piloto automático e as regras não geram
      comandos, ADR-0002);
    - nenhum código de diff ou patch: o cliente já faz isso hoje no **replay**, que roda seed + log no navegador e
      termina com o mesmo hash do servidor no V8 e no JavaScriptCore;
    - a CPU do servidor por broadcast cai (não há mais `JSON.stringify` do estado a cada tick);
    - é o mesmo modelo de que a batalha do M2 precisa para a previsão do creep dominado (ADR-0003).
  - Contras:
    - **o cliente recebe o estado inteiro.** Hoje isso não importa, porque não existe fog (spec M1, D5). Se o
      mundo ganhar fog of war (pergunta aberta no GDD 01), o cliente terá informação que não deveria ver, o
      "maphack" clássico do lockstep. Aí a parte escondida precisa da alternativa B;
    - **desync vira um modo de falha ao vivo:** um bug de determinismo deixa de aparecer só no CI e passa a deixar
      um cliente com o estado errado. Isso pede verificação de hash periódica e um resync;
    - **cliente e servidor precisam rodar o mesmo `SIM_VERSION`.** Uma aba aberta antes de um deploy fica velha e
      precisa recarregar;
    - o cliente gasta CPU simulando: 13 µs por tick, ~0,5 ms por segundo real a ×36. Desprezível, mas existe.
- **D. Capturar as mudanças do banco (CDC) e mandar o delta.**
  - Contras: o estado vivo não está no banco. Ele fica em memória no `WorldHost`; o banco recebe só os comandos de
    cada tick e um snapshot a cada 300 ticks (ADR-0004, que descartou gravar eventos derivados). Para haver o que
    capturar, seria preciso gravar o estado a cada tick: uma escrita grande por tick por mundo, e o oposto do
    ADR-0004.
  - Observação: a única coisa que o banco vê mudar a cada tick **são os comandos**. Mandar ao cliente exatamente o
    que entra no banco é a alternativa C.

## Decisão

Proposta: **C para o mundo**, com estas regras.

1. **Entrada:** o `welcome` leva o `SIM_VERSION`, os parâmetros e o estado serializado completo, e o cliente faz
   `restore`. Com `SIM_VERSION` diferente do seu, o cliente recarrega a página.
2. **Ticks:** depois de cada tick, o servidor manda `{tick, commands}` com os comandos aplicados nele, na ordem de
   `seq`, exatamente como foram para o log. Em multiplicadores altos, os ticks vão em lote (`{fromTick, toTick,
   commands}`), mantendo o teto de 5 mensagens por segundo.
3. **Verificação:** a cada N ticks (parâmetro de servidor; ex.: 60, 1 min de mundo), o servidor manda o hash do
   estado. Hash diferente no cliente = desync: ele pede um estado novo, que chega como um `welcome`, e o incidente
   é registrado (é um bug de determinismo, e o hash e o tick ajudam a reproduzi-lo).
4. **Autoridade:** nada muda no servidor. Ele continua validando (zod + `validate`), ordenando e gravando os
   comandos. O cliente simula só para exibir.
5. **Um caminho só:** o cliente ao vivo e o replay passam a usar o mesmo código para aplicar comandos e conferir o
   hash.
6. **Escopo:** só o mundo. A sincronização da batalha do M2 (20–30 Hz, previsão do creep dominado) se decide no
   plan do M2. C se estende a ela com naturalidade, mas a latência pode pedir outra coisa.
7. **Se o dono decidir por fog of war no mundo**, este ADR é revisto: B passa a valer pelo menos para o que é
   escondido.
8. **Quando:** na etapa de deploy do M2, antes do primeiro playtest com o servidor exposto. Os detalhes (formato
   das mensagens, N, o que acontece com uma aba em segundo plano) ficam para o plan do M2.

## Consequências

- A banda sai da lista de gargalos ([OVERVIEW §7](../OVERVIEW.md#7-sync-via-websocket-quanto-custa-e-escala)).
  Restam o disco (snapshots não podados), o fsync por tick e o event loop único.
- O `DynamicState` do `protocol` deixa de ser a mensagem principal. Ele pode continuar existindo para um espectador
  "burro" (sem `sim`), se algum dia houver um.
- O store do cliente deixa de trocar o estado a cada mensagem e passa a rodar o `sim`. A interpolação (um estado
  atrás) continua igual: o cliente guarda os dois últimos estados.
- O determinismo deixa de ser só uma propriedade testada no CI e vira um **requisito em produção**. As regras do
  ADR-0003 e o `geo verify` ganham peso; o teste de integração do servidor deve conferir que um cliente que segue
  o fluxo termina com o hash do servidor.
- Um deploy que muda o `sim` derruba as abas abertas (recarregar), o que já era verdade para os mundos (ADR-0004:
  mundo de outra versão não é recuperado).
- A pergunta aberta sobre fog of war (GDD 01) passa a ter uma consequência técnica conhecida: com fog, a
  sincronização do mundo fica mais cara (B, por jogador).
- O plan M1 P3 fica como registro: foi a decisão certa para o M1 local, e a medição que ele pedia é a deste ADR.
