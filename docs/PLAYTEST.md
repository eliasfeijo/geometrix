# Playtest

Como rodar uma sessão de playtest do geometrix. Hoje cobre o **playtest de legibilidade e mecânica do M1** (F9,
[spec M1 §8 item 4](specs/m1-ciclo-da-riqueza/spec.md)), o **da névoa do M1.5** (seção "Névoa (M1.5)", [spec do
fog §8](specs/m1.5-fog/spec.md)), o **do encontro do M2** (seção "Encontro (M2)", [spec do encontro
§8](specs/m2-encontro/spec.md)) e o **do laboratório de batalha do M2** (seção "Laboratório de batalha (M2)",
[spec do laboratório §8](specs/m2-laboratorio/spec.md)). O playtest de diversão com pessoas novas, com deploy e
túnel, não bloqueia mais o M2 nem o M3 (dono, 2026-11-15, no [ROADMAP](ROADMAP.md)): entra aqui quando o dono achar
o jogo divertido o suficiente.

## Objetivo

Descobrir **o que o jogador vê e entende** sem ninguém explicar: estradas × obstáculos, custos, carga, entregas,
nomes, estado do piloto automático. Também levantar as próximas melhorias de mecânica e dar uma primeira
resposta humana à pergunta do M1 no [ROADMAP](ROADMAP.md): coletar, transportar e investir já é interessante
sozinho?

**Não** é um playtest de diversão: sem combate não há o que vencer, e os DNAs se equivalem de propósito.

- **Quem:** 1 a 3 pessoas. De preferência alguém que nunca viu o jogo. O dono observa e anota.
- **Duração:** ~45 min por pessoa (5 de preparação, 30 de jogo, 10 de questionário).

## Preparação (dono)

Node 26 e `npm install` já feitos. Na raiz do repositório:

```sh
npm run dev:multi -- --clients 2 --mult 36
```

Faz o build do cliente, sobe o servidor em `http://localhost:8080`, cria um mundo e abre uma aba por jogador
(Azul e Laranja alternados), já dentro do mundo. Opções úteis:

| Opção | Para quê |
|---|---|
| `--clients 1` | Uma pessoa só, contra o mundo vazio do outro lado |
| `--mult 12` | Mais devagar: dá tempo de ver a obra da estrada (2 min de mundo = 10 s reais) |
| `--seed 42` | O mesmo mapa para todas as sessões (compare as respostas) |
| `--no-open` | Só imprime as URLs (para abrir em outro navegador ou outra máquina) |

Sem bots: quem joga é a pessoa. Para ter o outro time ativo, `--bot` põe um bot no Laranja e todos os jogadores
no Azul (ou crie o mundo pelo lobby com "Bot no Laranja" e entre como Azul).

### Acesso

- **Mesma máquina:** as abas que o `dev:multi` abre. Cada aba é um jogador; a pessoa joga numa, o dono pode
  acompanhar na outra.
- **Outra máquina na rede local:** o servidor escuta em todas as interfaces, então `http://<ip-da-máquina>:8080`
  funciona fora do WSL. **No WSL2** a porta não aparece na rede sem `networkingMode=mirrored` no `.wslconfig` ou
  um `netsh interface portproxy` no Windows. Ainda não testado; na dúvida, use a mesma máquina.
- O token do jogador vai no fragmento da URL e sai da barra depois de entrar: para mandar o link a outra
  máquina, use `--no-open` e copie a URL impressa.

## Roteiro

Antes de começar, diga só isto: *"É um jogo de estratégia em que o seu time coleta recursos e investe. Pense em
voz alta. Não vou explicar nada; se travar, me diga o que está procurando."*

O observador anota, em cada passo: **tempo**, **hesitações**, **cliques errados** e **o que a pessoa disse**.
Só ajude depois de ~2 min travada, e anote que ajudou.

### A. Olhar sem mexer (3 min)

1. "O que você está vendo? O que é seu?"
2. "Do que é feito o mapa? Onde dá para andar?" (estrada × pedra × rio × travessia)
3. "O que esses bichos estão fazendo?" (coletando, carregando, entregando, esperando)

### B. Tarefas

| # | Tarefa dita à pessoa | O que observar |
|---|---|---|
| 1 | Ache o seu Núcleo e diga quanto você tem de cada recurso | Painel do Núcleo; nota o `+N` subindo do Núcleo? |
| 2 | Aponte um creep com a carga cheia | Anel completo e grosso; o brilho ao encher |
| 3 | Leia o nome de um creep e ache-o de novo depois de afastar e aproximar o zoom | Nome sob a forma; some ao afastar |
| 4 | Assuma o controle de um creep | Acha "Dominar" no inspetor? Entende o halo? |
| 5 | Mande esse creep coletar cristal e entregar no Núcleo | Botão direito; "Entregar"; o `+N` roxo |
| 6 | Construa uma estrada do Núcleo até um depósito | Acha o modo estrada (R)? Lê o custo sob o cursor antes de clicar? Vê o `−N` e o tempo da obra? |
| 7 | Tente construir uma estrada sem estoque suficiente | Entende o custo em vermelho? |
| 8 | Produza um creep novo | Custo, tempo, "repetir" |
| 9 | Compre o upgrade de capacidade | Entende o efeito no anel de carga? |
| 10 | Devolva o creep ao piloto automático e faça-o coletar matéria sozinho | "Liberar"; presets ou editor de regras |

### C. Jogo livre (10 min)

"Jogue como quiser para ter o máximo de recursos daqui a 10 minutos." Observe o que a pessoa olha, o que ignora
e o que tenta fazer e não consegue.

## Questionário de legibilidade

Notas de 1 (não entendi) a 5 (entendi de cara), mais uma frase livre em cada uma.

| # | Pergunta | Nota | Comentário |
|---|---|---|---|
| 1 | Dava para distinguir estrada de pedra e de rio? | | |
| 2 | Você sabia quanto a estrada ia custar antes de mandar construir? | | |
| 3 | Dava para ver quanto tempo faltava para uma obra terminar? | | |
| 4 | Dava para ver quando um creep estava com a carga cheia? | | |
| 5 | Dava para ver quando um creep entregava no Núcleo, e quanto? | | |
| 6 | Os nomes dos creeps eram legíveis? Ajudaram? | | |
| 7 | Dava para saber o que cada creep estava fazendo (coletando, indo, esperando)? | | |
| 8 | Ficou claro quais creeps eram seus e qual você controlava? | | |
| 9 | Ficou claro o que o piloto automático ia fazer com as regras? | | |

Perguntas abertas:

- O que mais confundiu?
- O que você queria ver na tela e não achou?
- Teve algo que você tentou fazer e o jogo não deixou (ou não explicou por quê)?
- Coletar, transportar e investir já é interessante sozinho? Por quê?

## Névoa (M1.5)

Desde o M1.5 cada time vê só o que o Núcleo e os próprios creeps enxergam, e lembra o que já viu. A sessão testa
a hipótese da [spec do fog](specs/m1.5-fog/spec.md): **esconder informação cria decisões interessantes (explorar,
proteger rotas) sem tornar o mapa ilegível.** Ela entra depois das seções A–C acima (que continuam valendo, agora
com a névoa) ou sozinha, para quem já jogou o M1.

### Preparação

O outro time precisa estar ativo, senão não há inimigo para achar. Duas formas:

- **Duas pessoas**, uma em cada time: `npm run dev:multi -- --clients 2 --mult 36 --seed 42`.
- **Uma pessoa contra um bot:** `npm run dev:multi -- --clients 1 --mult 36 --seed 42 --bot`.

Lembrete para o observador: todo creep nasce coletor de matéria, que só explora quando o time não conhece
depósito do recurso. Se há matéria à vista do Núcleo, **ninguém explora sem uma ordem do jogador** (o preset
**Batedor**, o coletor de cristal ou a ação "explorar" no editor). Não conte isso à pessoa: descobrir é parte do
teste (tarefa N3).

### D. Roteiro da névoa

| # | Tarefa ou pergunta dita à pessoa | O que observar |
|---|---|---|
| N1 | "O que é a área preta? E a esmaecida?" (logo no começo, e de novo depois de ~10 min) | Distingue nunca visto, lembrado e visível? Entende que o esmaecido é antigo? |
| N2 | "Até onde o seu time enxerga agora?" | Relaciona a área clara com o Núcleo e os creeps? Percebe que formas diferentes enxergam diferente? |
| N3 | "Ache um depósito de cristal." | Acha o Batedor ou a ação explorar? Manda um creep andar no escuro? Quanto tempo leva? |
| N4 | "Quanto tem naquele depósito?" (um depósito sob o véu) | Lê "último valor visto" no inspetor? Entende que pode ter mudado? |
| N5 | "Onde está o inimigo agora?" | Procura creeps laranja; entende que, fora da visão, não sabe? |
| N6 | "Onde fica o Núcleo do inimigo?" | Explora para achar? Depois de visto, entende que ele fica lembrado? |
| N7 | Selecione um creep inimigo e diga o que dá para saber dele | DNA, carga e posição; sem regras nem ordem. Estranha? |
| N8 | Construa uma estrada até um ponto no escuro | Lê "nunca vista · custo desconhecido"? Entende por que a estrada parou ou desviou ao revelar pedra ou rio? |
| N9 | "Por que esse creep foi para lá?" (um creep explorando) | Lê a ordem "explorar (x, y)" no inspetor e a linha até o alvo? |

### Questionário da névoa

Mesma escala de 1 a 5, mais uma frase livre em cada uma.

| # | Pergunta | Nota | Comentário |
|---|---|---|---|
| N1 | Dava para distinguir o que você nunca viu, o que já viu e o que vê agora? | | |
| N2 | Você sabia até onde o seu time enxergava? | | |
| N3 | Ficou claro como descobrir o mapa (explorar)? | | |
| N4 | Ficou claro que os depósitos esmaecidos mostram o último valor visto, não o atual? | | |
| N5 | Você conseguia saber onde o inimigo estava, ou que não sabia? | | |
| N6 | Construir estrada no escuro fez sentido? | | |

Perguntas abertas:

- Não saber o mapa criou alguma decisão para você (para onde ir primeiro, o que proteger)? Qual?
- Em algum momento a névoa atrapalhou entender o que estava acontecendo? Quando?
- O que você queria saber do inimigo e não dava?

## Encontro (M2)

Desde a fatia A do M2, creeps de times diferentes se abordam: o agressor ataca ou extorque, a vítima paga, recusa
(e luta) ou foge, e quem morre larga despojo. A luta ainda é um sorteio descartável. A sessão responde às
perguntas 1 a 3 da hipótese da [spec do encontro](specs/m2-encontro/spec.md) §1: **o encontro cria conflito e
história, muda o que o jogador faz, sem dominar o jogo?** Quem joga é o dono (a diversão é julgada nos playtests
locais, ROADMAP 2026-11-15); a seção serve também para uma pessoa nova, quando chegar a hora.

### Preparação

```sh
npm run dev:multi -- --clients 1 --mult 6 --seed 42 --bot
```

Um mundo com o **bot no Laranja** e o jogador no Azul, **a ×6**: a janela de reação de 60 s de mundo dura 10 s
reais, tempo de ler o painel e decidir (spec §8). Uma hora de mundo leva 10 min reais.

Lembretes para o observador (não conte à pessoa):

- O bot mantém um **salteador** a cada 6 creeps. O salteador só aborda um inimigo à vista (raio 10) com **10 ou
  mais de carga**: um círculo cheio, um triângulo ou um quadrado a meio caminho. Ele extorque, cata despojo,
  entrega quando cheio e explora.
- No mundo bot × bot do seed 42, o 1º encontro sai em ~3,7 h de mundo (**~37 min reais a ×6**), e quase todos
  caem nas primeiras ~8 h: depois que o mapa está todo explorado, os salteadores do bot voltam a coletar (C7). Com
  um humano no Azul o ritmo muda; para ver um encontro antes, a pessoa pode abordar um coletor do bot (tarefa E4)
  ou mandar creeps carregados para perto do Laranja.
- Os coletores pagam a extorsão e tentam fugir do ataque **por padrão**, sem regra de reação. O creep dominado
  ganha o painel de reação; sem resposta até o fim da janela, valem as regras dele.

### E. Roteiro do encontro

| # | Tarefa ou pergunta dita à pessoa | O que observar |
|---|---|---|
| E1 | "O que aconteceu com aquele creep?" (logo depois do 1º encontro, apontando o creep) | Responde pela crônica, pelo mapa ou pelo inspetor? Entende quem abordou, o que pediu e como acabou? |
| E2 | "Por que ele pagou?" (ou fugiu, ou lutou) | Sabe que pagar é o padrão do coletor? Acha a regra de reação no editor? |
| E3 | "Quanto de HP aquele creep tem?" (um creep ferido, seu ou inimigo) | Lê a barra de HP? Sabe que o HP volta com o tempo? |
| E4 | Domine um creep e extorqua um creep inimigo carregado | Clique direito no inimigo; lê a exigência antes de confirmar? Entende quando a extorsão é impossível (vítima vazia, agressor cheio)? |
| E5 | Domine um creep e ataque um creep inimigo | Acompanha as rodadas? Usa o botão de fugir? |
| E6 | Com um creep dominado, espere ser abordado e decida (pagar, recusar, fugir) | Acha o painel de reação a tempo? Lê o tempo restante e a exigência? |
| E7 | "O que é essa pilha no mapa?" (um despojo) e "pegue-a" | Entende de onde veio? Acha "catar despojo" (ou leva um creep até lá)? Vê o despojo lembrado sob o véu? |
| E8 | Faça um creep virar salteador, e depois proteja os seus coletores | Acha o preset "Salteador"? Muda rotas, escolta, que DNA carrega o cristal, as regras de reação? |
| E9 | "O que você mudou depois da primeira emboscada?" (no fim da sessão) | A resposta à pergunta 2 da hipótese: rotas, escolta, DNA do cristal, posturas do piloto |

### Questionário do encontro

Mesma escala de 1 a 5, mais uma frase livre em cada uma.

| # | Pergunta | Nota | Comentário |
|---|---|---|---|
| E1 | Dava para entender um encontro (quem abordou, o que pediu, como acabou) só pela crônica? | | |
| E2 | Dava para ver no mapa quem perseguia quem, o diálogo, a luta e a fuga? | | |
| E3 | Deu tempo de decidir no painel de reação a ×6? | | |
| E4 | Ficou claro o que o piloto faria num encontro sem você (pagar, fugir, lutar)? | | |
| E5 | O tom da crônica combinou com o jogo? (frases que soaram erradas: anote o texto) | | |

Perguntas abertas, que respondem à hipótese:

1. **O encontro criou conflito e história?** Teve um momento que você contaria a alguém? Qual?
2. **O encontro mudou o que você fez?** Rotas, escolta, que DNA carrega o cristal, as posturas do piloto.
3. **Sem dominar o jogo:** os encontros vieram com uma frequência que importa, sem atropelar a economia? Algum
   time desmoronou?

## Laboratório de batalha (M2)

Desde a fatia B do M2, a batalha tem uma página própria, sem mundo e sem servidor de jogo: monta-se um confronto
à mão, joga-se dominando um creep (ou só se assiste), com uma rede simulada entre a página e a batalha. A sessão
responde às perguntas 1 a 4 da hipótese da [spec do laboratório](specs/m2-laboratorio/spec.md) §1: **a regra de
grade é divertida, a micro importa, quanta latência ela aguenta sem predição, e a IA de gambits serve de
adversário?** Quem joga é o dono.

O roteiro está em **grupos**, um de cada vez, na ordem: cada grupo é uma sequência só no laboratório, e a ordem
resolve as dependências (dono, 2026-11-18, no checkpoint da F5: o roteiro anterior, em duas listas, era difícil de
seguir). Com o Claude na sessão, ele entrega um grupo por vez e junta as respostas; sozinho, siga daqui.

| # | Grupo | Tempo | Rede |
|---|---|---|---|
| 0 | Preparação | 2 min | — |
| 1 | Duelos dominando (você × IA, 9 batalhas) | ~12 min | 0 ms |
| 2 | A IA no seu lugar (os mesmos 9, só assistindo, no instantâneo) | ~5 min | — |
| 3 | Assistir: um 3 × 3 e um 1 × 1 × 1 | ~5 min | — |
| 4 | Mexer na luta: editar gambits e soltar reforço | ~8 min | — |
| 5 | Às cegas, parte 1 (15 batalhas) | ~15 min | sorteada |
| 6 | Às cegas, parte 2 (15 batalhas) e encerrar | ~15 min | sorteada |
| 7 | 300 ms com e sem interpolar | ~5 min | 300 ms |
| 8 | Fechamento: as tabelas, as perguntas da hipótese e a próxima regra | ~10 min | — |

**Por que nessa ordem:**

- **O grupo 1 vem antes das às cegas:** os controles se aprendem a 0 ms. Senão as primeiras notas às cegas medem o
  aprendizado, não a latência.
- **O grupo 2 vem logo depois do 1:** o painel "Você × IA" compara as batalhas que você jogou com as da IA no
  mesmo confronto (arena, DNAs e HP de cada lado).
- **O grupo 4 usa um confronto que não aparece nos grupos 1 e 2:** um reforço ou um gambit editado estragaria
  aquela comparação.
- **O grupo 7 vem depois das às cegas:** quem sabe como 300 ms "parece" reconhece o RTT às cegas e dá nota ao
  número. Além disso, a sessão às cegas precisa do "interpolar" ligado, e o grupo 7 o desliga.

**O que anotar:** só o que você sentiu. Vitória, derrota, RTT, atraso medido e nota ficam no registro da sessão,
que vai no export do fim.

### Grupo 0: Preparação (2 min)

```sh
npm run lab
```

Abre o laboratório no Vite (`/lab.html`). Sem o Vite: `npm run build` e `npm run server`, e
`http://localhost:8080/lab`. A página não fala com o servidor do jogo: tudo roda no navegador.

1. **Use uma aba só, no mesmo endereço, do começo ao fim.** O registro da sessão fica guardado neste navegador,
   para este endereço: o 5173 e o 8080 têm registros separados.
2. No painel **"Sessão"** (coluna da direita): se houver batalhas no registro (de testes antigos), clique em
   **"Exportar sessão"** (guarda uma cópia) e depois em **"Limpar"**. O registro tem de começar em 0.
3. No painel **"Rede simulada"**: RTT em **0 ms** e **"interpolar" marcado**. Na barra acima da arena, velocidade
   **×1**.
4. Nos grupos 1 e 2, **não mexa** na dificuldade ("IA normal"), no HP nem na carga. O "Você × IA" separa os
   confrontos por arena, DNA e HP, não pela dificuldade: misturar dificuldades bagunça a comparação sem aparecer.

Teclas (valem na página inteira, salvo com o foco num campo do formulário): **setas ou WASD** andam, **Shift +
seta** vira, **espaço** ataca, **Q** larga a bolsa, **E** cata, **Tab** domina o próximo, **0** solta, **R**
reinicia, **P** ou **Esc** pausa e continua.

As regras que o jogador precisa saber:

- Toda batalha começa com a **contagem de 3 s** (spec D21): todos parados, só dá para virar. O "você joga com" do
  formulário diz quem você domina desde o começo; o **Começar**, o **Reiniciar** e o **R** já dominam.
- **Parado, o creep dá o primeiro passo na hora** (spec D22), e cada toque na tecla anda uma célula.
- Quem fica **2 s** no anel da borda sem levar golpe foge pela borda. Se a batalha inteira passa **15 s** sem
  nenhum dano em ninguém, **todos fogem** (spec D9). A batalha acaba quando sobra no máximo um lado.
- Toda batalha que acaba entra no registro. **Trocar ou soltar o domínio no meio** (Tab, 0, "dominar", "soltar")
  tira a batalha das contas do "Você × IA".

### Grupo 1: Duelos dominando (~12 min, 9 batalhas)

Jogar cada DNA contra a IA normal nas três arenas. Em cada batalha:

1. No formulário **"Montar a batalha"**, escolha a **arena** e o **DNA** do Lado A e do Lado B (o preset muda
   sozinho com o DNA). A seed fica como está.
2. **"você joga com"** em **"A · …"** (o padrão).
3. **Começar**. Durante o "3, 2, 1", vire com Shift + seta.
4. Jogue até o fim; a tabela de resultado aparece sob a arena. Começo errado? **R** reinicia do zero, já
   dominando (só a batalha que vai até o fim entra no registro).

| # | Arena | Você (Lado A) | IA (Lado B) |
|---|---|---|---|
| 1 | pedras | ■ quadrado | ● círculo |
| 2 | pedras | ▲ triângulo | ● círculo |
| 3 | pedras | ● círculo | ■ quadrado |
| 4 | aberta | ■ | ● |
| 5 | aberta | ▲ | ● |
| 6 | aberta | ● | ■ |
| 7 | corredor | ■ | ● |
| 8 | corredor | ▲ | ● |
| 9 | corredor | ● | ■ |

```
GRUPO 1
Comentários por batalha (opcional): 1 … 9
Notas (1 = discordo totalmente, 5 = concordo totalmente) + uma frase:
F1 Eu sabia por que perdi:
F2 Dava para ver o tiro chegando (e desviar):
F5 Chegar à luta foi rápido (contagem, domínio desde o começo, teclado sem clicar):
Livre: qual DNA você quis jogar de novo? Em qual arena a posição pesou? Algum duelo pareceu decidido de antemão?
Algo travou, confundiu ou irritou?
```

### Grupo 2: A IA no seu lugar (~5 min, 27 batalhas instantâneas)

Os mesmos 9 confrontos, com a IA dos dois lados, para o "Você × IA" comparar.

1. Uma vez: **"você joga com"** em **"ninguém (só assistir)"**, e **"instantâneo"** na barra sobre a arena.
2. Para **cada um dos 9 confrontos** da tabela do grupo 1 (todos, nas três arenas): acerte a arena e os DNAs, e
   repita **3 vezes**: **"sortear"** (ao lado da seed) e **Começar**.

Só com a IA, **a mesma seed dá a mesma batalha**: sorteie antes de cada uma, e não use o R (ele repete a seed). No
fim, o painel "Sessão" mostra **"Você × IA, no mesmo confronto"**.

```
GRUPO 2
Algum número do "Você × IA" te surpreendeu? Algo estranho?
```

### Grupo 3: Assistir (~5 min, 2 batalhas)

"você joga com" em "ninguém", velocidade **×1**.

1. **Um 3 × 3 nas pedras:** no Lado A, **"+ participante"** duas vezes, e os três como **■, ▲, ●**; o mesmo no
   Lado B. **Começar** e assista até o fim (P pausa para olhar com calma, Esc continua).
2. **Um 1 × 1 × 1 na aberta:** tire os extras com o **✕** (A = ■, B = ●) e clique em **"+ lado"** (o Lado C vem com
   um ▲). **Começar** e assista.

Repare em quem atira em quem, para onde cada um olha, as barras de HP, a contagem da fuga, o relógio de
inatividade, a lista "Eventos" e a tabela de resultado.

```
GRUPO 3
F3 Dava para ler quem olha para onde, o HP, a contagem da fuga e o relógio de inatividade:
F4 A IA parecia um adversário de verdade (nem boba, nem perfeita):
Livre: dava para acompanhar quem atirava em quem no 3 × 3? O 1 × 1 × 1 teve algo diferente do 1 × 1? Assistir
prendeu a sua atenção? O que faltou na tela?
```

### Grupo 4: Mexer na luta (~8 min, 4 batalhas)

Um confronto que não está nos grupos 1 e 2: **corredor, ▲ × ▲**, "você joga com" em "ninguém", velocidade ×1.

1. **Editar gambits:** **Começar** e, durante a contagem, **P**. Em **"Na arena"**, clique no nome do ▲ do Lado A:
   abre o painel **"Gambits de …"**. Tire a regra **"esquivar"** com o **✕** ("Tirar a regra") e clique em
   **"Aplicar"**. **Esc** continua. Assista: o ▲ sem esquiva leva mais tiro?
2. **A mesma luta com a esquiva:** **R** reinicia com o mesmo setup e a mesma seed, com os gambits originais.
   Compare as duas.
3. **Reforço num lado existente:** **Começar** de novo. Com a luta andando, no painel **"Reforço"**: lado **B**, um
   **●**, **"Soltar na arena"**.
4. **Reforço num lado novo:** **Começar** de novo, e solte um **■** no lado **"novo (C)"**.

```
GRUPO 4
Achou o editor? Entendeu que a lista vale em ordem (a 1ª regra possível)?
A esquiva fez diferença?
A entrada no meio mudou a luta? E o lado novo?
```

### Grupos 5 e 6: A sessão às cegas (~30 batalhas, em duas partes)

Responde à pergunta 3 da hipótese (latência). **Um setup só na sessão inteira** (dono, 2026-11-17): o 1 × 1
dominando, para a nota medir o atraso e não o confronto. Sugestão: **▲ (você) × ● (IA normal) nas pedras**, o duelo
à distância em que mirar e desviar mais sentem o atraso (spec D4).

1. Confira o **"interpolar" marcado** (a sessão inteira usa o mesmo).
2. Monte o setup no formulário, com "você joga com" no seu ▲, e clique em **"Começar sessão às cegas"** no painel
   "Sessão". A página sorteia a ordem de **5 batalhas de cada RTT** (0, 50, 100, 150, 200 e 300 ms), 30 no total, e
   esconde o RTT e o atraso medido.
3. Jogue cada batalha até o fim. Errou o começo? **R** reinicia com o mesmo RTT escondido.
4. No fim, a nota (botões ou teclas **1 a 5**) para **"dá para jogar?"**: 1 = não dá, 5 = nem senti atraso. Só então
   o RTT e o atraso medido aparecem.
5. **Enter** (ou N, ou o botão) abre a próxima. O painel mostra quantas faltam.

**Grupo 5:** as primeiras 15. Dá para parar aí e voltar depois: o sorteio fica guardado, e o painel oferece a
próxima batalha. **Grupo 6:** as outras 15; depois da última, **"Encerrar"** mostra a tabela nota × RTT e o
veredito (até onde a nota mediana fica em 4 ou mais; de onde cai abaixo de 3). **Exporte a sessão.**

Não olhe o seletor de RTT nem o export no meio da sessão: a nota tem de julgar o jogo, não o número.

```
GRUPOS 5 E 6
Alguma batalha que chamou atenção (o número dela no painel, e por quê)?
Quando o atraso incomodou, o que ficou ruim: andar, mirar, desviar?
```

### Grupo 7: 300 ms com e sem interpolar (~5 min, 4 batalhas)

Fora da sessão às cegas: RTT em **300 ms** no painel "Rede simulada", o mesmo ▲ × ● nas pedras, dominando.

1. Duas batalhas com **"interpolar" marcado**.
2. Duas com **"interpolar" desmarcado**.
3. No fim, marque o "interpolar" de novo e volte o RTT para 0 ms.

```
GRUPO 7
F6 Qual dos dois sente melhor a 300 ms, com ou sem interpolar? Por quê?
```

### Grupo 8: Fechamento (~10 min)

1. **"Exportar sessão"** (se ainda não exportou depois do grupo 7). Com o Claude: diga onde o arquivo está, e ele
   monta as tabelas (você × IA, nota × RTT) e as compara com o `geo battle sweep`.
2. As **perguntas da hipótese**:
   1. **A regra de grade é divertida?** Jogar e assistir, de 1 × 1 a 3 × 3 e com três lados, prendeu a sua
      atenção? O que faltou?
   2. **A micro importa e o DNA não decide sozinho?** Dominando, você venceu confrontos que a IA perde no mesmo
      setup (o "Você × IA")? Algum 1 × 1 pareceu decidido de antemão?
   3. **Quanta latência a grade aguenta?** Até que RTT a nota ficou em 4 ou mais, e a partir de qual caiu abaixo
      de 3? Isso basta para o deploy sem predição?
   4. **A IA de gambits serve?** Como adversário (crível, nem boba nem perfeita) e como auto-resolve (o que ela
      faria no seu lugar)?
3. A decisão que fecha a fatia: **a próxima regra a experimentar é a livre (MOBA-lite), a forja, ou nenhuma antes
   da junção?**
4. As **interpretações a validar** das fases (o `tasks.md` do laboratório, F4 a F6): o Claude as resume para um sim
   ou não por item.

## Validar o replay (dono)

Pendente desde o F8. Depois da sessão:

1. No lobby, num mundo **encerrado**, clique em **"Assistir replay"** (ou abra `/?replay=<id>`). Desde o fog, mundo
   rodando não tem replay (o log mostraria o mundo inteiro, através da névoa); um mundo curto: `--mult` alto no
   `dev:multi`, ou o do `npm run soak`.
2. **Reproduzir**, troque a **velocidade** (1, 60, 600, 3600, máx) e arraste a **linha do tempo** para trás e
   para frente.
3. Troque o time em "Ver como" e confira o painel do Núcleo de cada lado.
4. Deixe chegar ao fim (ou use "máx"): o selo tem de dizer **"✓ hash confere"**.
5. Opcional: o replay de um `geo sim` pelo campo de arquivo no lobby, e o mundo do `npm run soak` (o
   `summary.md` do soak diz como abrir).

## Registro

Ao fim de cada sessão, o dono (ou o Claude, com as anotações) registra:

- **Achados** em `docs/dashboard/current-status.md`, na seção "Achados do playtest": um item por problema, com a
  tarefa ou pergunta que o mostrou e quantas pessoas tropeçaram nele.
- **Mudanças de gameplay** sugeridas: no GDD do sistema como **Proposta**, nunca como Decidido sem o OK do dono.
- O que for só legibilidade e couber no M1 vira task numa rodada seguinte da F9; o resto, ideia para o marco
  certo do [ROADMAP](ROADMAP.md).
