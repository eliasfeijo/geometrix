# M1 — Passada de balanceamento 1

**Data:** 2026-11-14 · **Status:** decidida (candidato B adotado) · **Protocolo:** spec §8, item 1 (varreduras bot × bot)

Parte do checkpoint do F5 ("precisamos balancear, como era previsto"). O dono adotou o candidato B como
`params/default.json` provisório em 2026-11-14 (§7); o A ficou em `params/balance-a.json` como referência. Todos os
números abaixo são do estrategista `balanced` (provisório), 72 h de mundo, seeds 1–5, salvo indicação.
Reproduzir o B: `npm run geo -- sim --seed 42 --days 3`.

## 1. Correção antes de balancear: o mapa simétrico não era justo

O relatório do checkpoint mostrava o time 1 viajando quase o dobro do time 0 (37,7 × 19,6 min no seed 42). A
hipótese do dashboard (desempates por menor id) **não se confirmou**: entre seeds, nenhum time levava vantagem
sistemática. A causa era o A*: ele desempatava pelo menor índice de célula para os dois times, e esse critério não
é simétrico à rotação de 180°. Os times construíam estradas com formatos diferentes e terminavam até ~19% distantes
na matéria entregue (seed 1).

Corrigido em `fix(sim): mirror path ties on the rotated side`: o time 1 desempata na ordem rotacionada, e a rota
dele passa a ser o espelho exato da rota do time 0 (teste de propriedade em 5 seeds). Depois da correção, os dois
times terminam com a mesma entrega e o mesmo tempo de viagem; sobram diferenças de até ~1% onde os times
interagem (cristal disputado, ordem de id dos creeps).

## 2. Diagnóstico dos parâmetros atuais

Seeds 1–5, já com a correção:

| Sinal | Valor | Por quê |
|---|---|---|
| Teto de população | 4–5 h | 24 creeps × 10 min de produção = 4 h. O limite é o **tempo de produção**, não o recurso |
| Matéria | Os 6 depósitos zeram em 0,6–1,7 h e ficam em ~1 até o fim | Regeneração de 1/min por depósito = 180/h por time. 30 creeps retiram muito mais |
| Creeps andando vazios | 55–72% | Com tudo zerado, a regra "coletar no mais próximo não vazio" persegue cada unidade que regenera |
| Estoque parado no fim | 90% da matéria entregue | Depois do teto não há onde gastar (só estrada, e o bot só liga depósitos) |
| Cristal | Esgota em ~3 h | O bot põe ⅓ dos creeps no cristal para sempre; cada time usa 390 dos 1 200 que coleta |
| Disputa nos 2 depósitos "disputados" | 0–50 min em 72 h | Cada um fica num lado do rio; o time daquele lado chega antes |

Ou seja, a economia **explode e trava ao mesmo tempo**: cresce tudo o que pode em 4 h e depois não tem mais
decisão a tomar. No playtest comprimido (×36), 4 h de mundo são **7 minutos reais** de um teste de 2 h.

### O que cada alavanca faz (varreduras de uma alavanca só)

| Mudança | Efeito |
|---|---|
| Produção 30 / 60 min | Teto em 12 / 24 h, mas a matéria continua zerada e sobrando no estoque |
| Depósitos maiores, regeneração maior | Mais renda, teto ainda em 4 h (o limite é o tempo de produção) |
| Cristal 10× | Dura ~11 h; o bot coleta tudo e 11 mil ficam parados no estoque |
| Creep caro em cristal (60) | **Trava de verdade:** o cristal acaba em ~4 h e a população para em 22–24 para sempre (cristal não regenera) |
| Creep caro em matéria | O crescimento passa a depender da renda; é a alavanca que espalha a expansão pelo mundo |

## 3. Metas propostas para "não trava nem explode"

A spec §8 não define o critério. **Proposta** (a aprovar):

1. **Expansão espalhada:** o teto de população chega entre **36 e 60 h** (metade a 5/6 do mundo), com produção
   regular desde o começo.
2. **Cada creep a mais rende:** a vazão do time cresce com a população até perto do teto.
3. **Logística saudável:** creeps andando vazios abaixo de 40%, sem vagar entre depósitos zerados.
4. **Simetria:** os dois times com a mesma entrega (±2%) no mesmo seed.

O estoque que sobra depois do teto **não tem solução por parâmetro** (ver §5).

## 4. Candidatos

Os dois mudam o mesmo grupo de parâmetros:

| Parâmetro | Atual | A (`balance-a.json`) | B (`balance-b.json`) |
|---|---|---|---|
| `deposits.materia.perSide` | 3 | 6 | 6 |
| `deposits.materia.maxCoreDistance` | 8 | 20 | 20 |
| `deposits.materia.regen.amount` (por minuto) | 1 | 3 | 8 |
| `creep.cost.materia` | 40 | 1 800 | 3 000 |
| `road.cost.materia` | 5 | 100 | 150 |

Mais depósitos, até 20 células do Núcleo, criam um gradiente: os perto saturam primeiro, os longe pedem estrada.
A estrada encarece junto com o creep para continuar uma troca real (1 creep = 18–20 segmentos).

| Métrica (seeds 1–5) | Atual | A | B |
|---|---|---|---|
| Teto de população | 4–5 h | 47–58 h | 38–50 h |
| 12 creeps em | 1–2 h | 18–24 h | 17–28 h |
| Matéria entregue por time | 14 mil | 63–75 mil | 142–175 mil |
| Estoque parado no fim | 90% | 22–36% | 44–55% |
| Creeps andando vazios | 55–72% | 27–36% | 31–39% |
| Tempo médio por viagem | 17–27 min | 23–27 min | 12–15 min |
| Matéria média por depósito no fim | 1 | 3–89 | 16–172 |
| Cristal esgotado | ~3 h | 6–8 h | 6–9 h |

Linha do tempo do seed 42 (relatórios em `runs/m1-b1-{a,b}-s42/`), fim de cada janela de 6 h:

| Horas | Atual: creeps · vazão/h | A: creeps · vazão/h | B: creeps · vazão/h |
|---|---|---|---|
| 0–6 | 30 · 406 | 6 · 690 | 6 · 1 035 |
| 12–18 | 30 · 172 | 9 · 855 | 10 · 1 613 |
| 24–30 | 30 · 181 | 16 · 918 | 18 · 2 078 |
| 36–42 | 30 · 184 | 22 · 998 | 27 · 2 430 |
| 48–54 | 30 · 183 | 30 · 1 100 | 30 · 2 468 |
| 66–72 | 30 · 179 | 30 · 1 100 | 30 · 2 445 |

- **A** cresce de forma linear e regular, mas a vazão encosta no teto da regeneração (6 × 3/min ≈ 1 080/h) com
  ~13 creeps. Daí em diante creep novo não rende nada, os depósitos ficam zerados e os creeps voltam a vagar entre
  eles (112 células por viagem no seed 42, contra 61 no B). Falha nas metas 2 e 3.
- **B** tem a vazão crescendo com a população (1 035 → 2 430/h, com retorno decrescente pelos depósitos mais
  longe). Um creep a mais rende ~65–90 de matéria por hora, ou seja, se paga em 1,5–2 dias de mundo: produzir na
  reta final não compensa, e isso cria uma decisão real de **quando parar de investir**.
  Custos: começo lento (o 1º creep novo sai entre 6 e 18 h, conforme o seed) e mais estoque parado depois do teto.

**Recomendação: B.** É o único que cumpre as quatro metas. O começo lento pode ser compensado com estoque inicial
de matéria (hoje 0, decidido pelo dono em 2026-11-13), se o dono quiser reabrir esse ponto.

## 5. O que parâmetro nenhum resolve (perguntas para o dono)

Registradas também como perguntas abertas no GDD ([03](../../gdd/03-economia-e-logistica.md),
[07](../../gdd/07-piloto-automatico.md)).

1. **Depois do teto, nada para fazer.** Em qualquer candidato o estoque cresce sem uso nas últimas ~20–30 h. O GDD
   já lista sumidouros (manutenção, desgaste) e limitador de população como propostas sem marco. Trazer um para o
   M1 **aumenta o escopo do marco**. Alternativa: deixar como está e medir no playtest se o fim fica chato.
2. **Coletar num mundo com depósitos zerados.** A regra "coletar no depósito não vazio mais próximo" (F4) faz o
   creep sair atrás de qualquer unidade que regenera em qualquer depósito. O candidato B evita o problema mantendo
   os depósitos com folga; o A não. Uma regra diferente (ex.: esperar a regeneração no depósito em que está) é
   mudança de gameplay do piloto automático.
3. **Cristal sem papel depois de ~8 h.** Cada time precisa de 390 cristais (24 creeps + upgrade) e coleta 1 200.
   Os depósitos "disputados" quase não são disputados (até ~70 min de disputa em 72 h), então o sinal do M2 ("os
   depósitos disputados concentram tráfego") não aparece. Encarecer o creep em cristal trava a população para
   sempre (§2). Opções: depósitos disputados mais ricos (parâmetro novo), disputados mais perto do centro das
   travessias, ou aceitar e revisitar no M2, quando o cristal ganha usos.
4. **O bot é parte da medida.** O `balanced` mantém ⅓ dos creeps no cristal até acabar e só constrói estrada até
   depósitos. Um bot melhor muda os números; vale ajustá-lo antes da passada 2, sem mudar o jogo.

## 6. Medição: os DNAs se equivalem na economia

Times de 6 creeps de um DNA só, 12 h, sem estradas (estrategista `none`), com os depósitos do candidato B, que não
zeram com 6 creeps. Matéria entregue, seeds 1–3:

| DNA | Entregue |
|---|---|
| ■ quadrado (30 de carga, 2 células/min) | 9 090 – 10 050 |
| ▲ triângulo (20, 3) | 9 260 – 11 160 |
| ● círculo (10, 5) | 8 740 – 10 140 |

A diferença entre DNAs é menor que a diferença entre seeds. Capacidade × velocidade dá 60 / 60 / 50, e a coleta
(1 por segundo) é igual para todos; o upgrade de +50% multiplica os três da mesma forma. **O dono decidiu manter
assim** (GDD 02): a diferença entre os DNAs vem de outros sistemas, a partir do M2.

## 7. Decisões do dono (2026-11-14)

- **Candidato B** vira o `params/default.json` provisório.
- **Sem playtest humano no M1** (spec §8 revista): o M1 fecha com a sessão do dono no F7, os bots e um mundo de
  24 h. Deploy e playtest comprimido abrem o M2.
- **Perguntas da §5:**
  1. sumidouro depois do teto: adiado, não entra no M1;
  2. coleta com depósitos zerados: a única a fechar antes do F7 (o vaivém parece bug no cliente);
  3. papel do cristal: fica para o M2.
- As metas da §3 ficam como referência do critério "sem estado degenerado" (spec §8).
