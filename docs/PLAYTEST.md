# Playtest

Como rodar uma sessão de playtest do geometrix. Hoje cobre só o **playtest de legibilidade e mecânica do M1**
(F9, [spec M1 §8 item 4](specs/m1-ciclo-da-riqueza/spec.md)). O playtest de diversão, com deploy e túnel, entra
aqui antes do M2 ([tasks M1](specs/m1-ciclo-da-riqueza/tasks.md), "Fora do M1").

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

Sem bots: quem joga é a pessoa. Para ter o outro time ativo, crie o mundo pelo lobby (`npm run build` e
`npm run server`, depois "Criar" com "Bot no Laranja") e entre como Azul.

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
