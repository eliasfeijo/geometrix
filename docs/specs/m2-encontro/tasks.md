# Tasks M2 — O encontro

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Regra: uma task só é marcada `[x]` com os testes verdes (`npm run check`), no mesmo commit que a conclui. Cada fase
na sua branch (plan §12, skill `commit`), com merge `--no-ff` em `main`.

## F0 — Design, spec e plan (`m2/encontro-spec`)

- [x] Fatias do M2 decididas pelo dono e registradas no ROADMAP (2026-11-15)
- [x] Spec aprovada, com D1–D21; as decisões de gameplay no GDD (2026-11-15)
- [x] ADR-0007 (eventos do `sim`) aceito (2026-11-15)
- [x] **Checkpoint:** plan aprovado (decisões P1–P11, 2026-11-15)

## F1 — Identidade, HP e eventos no `sim` (`m2/encontro-f1-identity`)

- [x] Params `hp` (máximo e peso de luta por DNA, regeneração no mapa e na zona do Núcleo, raio da zona), `fight`,
      `flee`, `encounter`, `safeConduct` no `schema`, no `default.json`, no `test/params.json` e no
      `checkConsistency` (spec §6, plan §3)
- [x] `names.ts` no `sim` (lista e `nameAt`, com os testes da lista), `state.births`, `name` e `hp` no nascimento
      (`createWorld` e produção); o cliente lê `creep.name` e o `names.ts` dele sai (spec D1, plan P5)
- [x] `hp.ts`: regeneração por minuto em milésimos, fora de encontro, mais rápida na zona do Núcleo (estágio 6);
      `kill`: tira o creep do estado e encerra o domínio, com testes (spec H-1..H-3, D3, D4, plan P1)
- [x] `events.ts`: tipos de evento, o coletor do tick, `born`, o público no fim do `step` e `eventsFor`; `step`
      devolve `SimEvent[]` (ADR-0007, plan §7, P9)
- [x] Visão: `name`, `hp` e `engagement` no creep inimigo, campos novos no próprio; "nada vaza" estendido (spec
      D18)
- [x] `SIM_VERSION` 6; hashes travados novos (mundo inicial, bot × bot de 6 h); o resto do repositório compila
      (estrategista, `protocol`, servidor, cliente, CLI)

## F2 — O encontro no `sim` (`m2/encontro-f2-encounter`)

- [x] `Encounter`, `Spoil`, `engagement`, `safeConduct`, `extortBlocks` no estado; `spoils` na memória do time
      (plan §3)
- [x] Ordem `approach` (perseguição, fim quando o alvo sai da visão) e o passo **abrir** do estágio de encontros,
      com o encontro mútuo (D12); testes em mapas de texto, nos dois lados do mapa espelhado (spec E-1..E-3, E-9)
- [x] Diálogo: exigência (`demandFor`, D8), reações da vítima livre e do dominado (janela, `reply`), pagar com
      salvo-conduto e bloqueio do par (spec E-4..E-8, D6, D9)
- [x] Luta: rodadas com o `rng` (peso pelo HP relativo × DNA), morte, saque e despojo (spec L-1..L-3, D7, D11)
- [x] Fuga: chance pela velocidade (`speedHere`), fração largada, ordem `flee` travada com o bônus; fuga na
      reação e no meio da luta; em fuga, não extorquível (spec F-1..F-4, D10, plan P4, P11)
- [x] Despojo: ordem `pickup`, ação `pickup`, despojos somados na célula (spec S-1, D11)
- [x] Vocabulário: condições `enemyInSight`, `hpBelow`, `demandAtMost`; ações `approach`, `pickup`, `pay`, `fight`,
      `flee`; regras de reação com os padrões; `rules.ts` copia e valida; preset `raider` (spec D13, D14, A-1..A-3,
      plan §6)
- [x] Comando `react` e as ordens novas no `orderRefusal`, com as recusas sem vazamento (spec D19); vocabulário
      com `BREAKING CHANGE`
- [x] Todos os eventos do encontro (spec K-1, plan §7), com testes de ordem e de público (K-2)

## F3 — Bots e harness (`m2/encontro-f3-harness`)

- [x] Papel de salteador no estrategista, `floor(creeps ÷ 6)` (spec D15, B-1, plan P8)
- [x] Métricas dos eventos no harness; `report.md` do `geo sim` e do `geo sweep` com as métricas da spec §7, lado a
      lado com a F6 do fog (plan §10, P6)
- [x] `geo verify` com o hash da lista de eventos
- [x] **Checkpoint (dono):** `geo sweep` seeds 1–20 × 6 h e `geo sim` de 3 dias do seed 42: frequência dos
      encontros, desfechos, mortes, economia, diferença entre os times, cristal, acampamento na saída do Núcleo
      (duas rodadas, decisões C1–C10 no plan §11.1, 2026-11-17)

## F4 — Rede e servidor (`m2/encontro-f4-network`)

- [x] `protocol`: zod dos comandos, ordens e regras novos; `Delta` e `Sent` com `encounters` e `spoils`;
      `DeltaMessage.events`; `WelcomeMessage.chronicle`; `PROTOCOL_VERSION` 4 (plan §8)
- [x] Propriedade do diff com encontros, mortes e despojos (6 h × 3 seeds), com piso de mortes (spec N-3)
- [x] Servidor: eventos por time no stream e no buffer de retomada; crônica no `welcome` (spec N-1)
- [x] Tabela `chronicle`, gravação na transação do tick, recuperação que apaga a partir do snapshot e refaz;
      teste de restart com a crônica igual (spec N-2, plan P7)
- [x] **Checkpoint `geo net`:** banda e CPU dentro dos alvos da spec da rede, com os eventos (196 B/s, 172,8 µs por
      envio, 0 divergências; 2026-11-17)

## F5 — Cliente (`m2/encontro-f5-client`)

- [x] Barra de HP (próprio e inimigo à vista); despojo no mapa, lembrado sob o véu (spec C-1, C-2)
- [x] Marcas de perseguição, diálogo, luta e fuga; cursor de abordar (spec C-3)
- [x] Menu do clique direito (atacar / extorquir com a exigência) e painel de reação com o tempo restante e o botão
      de fugir na luta (spec C-5, C-6)
- [x] Crônica: `templates.ts` com o banco inicial de frases (voz pelo DNA), `narrate.ts`, painel com nomes
      clicáveis; a mesma frase em todo cliente e no replay (spec C-4, K-3, D17)
- [x] Inspetor (HP, nome, salvo-conduto, encontro) e editor de regras (condições, ações, reações e o preset
      salteador) (spec C-7)
- [x] Replay com a crônica

## F6 — Soak e playtest (`m2/encontro-f6-soak`)

- [x] Preset salteador com a carga mínima do alvo maior (plan §11.1, C11): o número com o dono na abertura
      (decidido: 10); `SIM_VERSION` 9 e os hashes fixos; `geo sim` de 3 dias do seed 42 com os encontros por
      desfecho antes e depois, no "Registro das fases"
- [x] `npm run soak` com a crônica final de cada cliente igual à do servidor; tamanho da tabela `chronicle` no
      relatório
- [ ] Perguntas de encontro no [PLAYTEST.md](../../PLAYTEST.md) e a sessão a ×6 (spec §8)
- [ ] **Checkpoint (dono):** sessão contra o bot a ×6; tom da crônica; respostas às perguntas 1–3 da hipótese;
      fecha a fatia A
