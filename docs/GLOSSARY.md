# Glossário

| Termo | Significado |
|---|---|
| **Mundo** (world state) | A simulação persistente e de longa duração: mapa, bases, recursos, creeps, tribos, governança. |
| **Batalha** (battle state) | Instância dedicada e temporária de combate em tempo real. Não sincroniza em tempo real com o mundo; devolve só os eventos que importam para ele. |
| **Creep** | Qualquer unidade de um time. Tem identidade, progressão, inventário e configuração de piloto automático próprios. |
| **Dominar / liberar** | Assumir o controle direto de um creep aliado livre / encerrar esse controle. Máximo de 1 domínio ativo por jogador. |
| **Piloto automático** | Comportamento configurado (e possivelmente scriptado) que um creep segue quando ninguém o domina. |
| **Comando** | A única forma de agir na simulação ([ADR-0002](adr/0002-tudo-e-comando.md)). Humanos, macros, piloto automático e bots emitem os mesmos comandos. |
| **Mula** | Creep de transporte que leva recursos e impostos até a base. |
| **Tesouro público** | A economia coletiva do time, abastecida por impostos. |
| **Imposto** | Fração cobrada pelo "estado" da base sobre o que chega até ela. A taxa é votada. |
| **Representante** | Jogador com mandato formal para votar pelo time, quando o time for grande demais para votação direta. |
| **Nível de autoridade** | Quem pode tomar uma decisão coletiva: bots podem decidir / só humanos / unanimidade. |
| **Tribo neutra** | Facção da jungle que pode virar aliada ou rival de qualquer time. |
| **DNA** | A forma/arquétipo inato do creep (quadrado, círculo, triângulo), em oposição à evolução individual ao longo da partida. |
| **Névoa** (fog of war) | O que o time não enxerga agora. Só o Núcleo e os creeps do time dão visão; fora dela, o time conhece só a própria memória (névoa negra no início da partida). |
| **Memória do time** | O que o time já viu e continua conhecendo fora da visão: depósitos (com o último valor), estradas e obras. Creeps inimigos não ficam na memória. |
| **Núcleo** | O coração da base de um time: recebe as entregas, produz creeps e guarda o estoque; com os itens, é a forja e o cofre. Destruí-lo vence a partida. |
| **Preset** | Uma lista de regras de piloto automático pronta (coletor, batedor, construtor de estrada, salteador), que o jogador aplica a um creep. |
| **Encontro** | A abordagem entre creeps de lados adversários, com um diálogo antes de qualquer golpe: o agressor ataca ou extorque; a vítima paga, recusa (luta) ou foge. |
| **Extorsão** | O pedágio do encontro: o agressor exige a carga da vítima, até o que cabe na própria bolsa. |
| **Salvo-conduto** | A imunidade de quem pagou a extorsão: o time que extorquiu não o aborda de novo por um tempo, ou até ele chegar à zona do próprio Núcleo. |
| **Despojo** | Uma pilha no chão (a bolsa largada na fuga, o saque que não coube, o que cai de quem morre), que qualquer creep pode catar. |
| **Lado** | Quem luta numa batalha: um time, uma tribo, os monstros. Uma batalha tem dois ou mais lados, e dá para entrar no meio. |
| **Arena** | O espaço de uma batalha. Hoje, três (aberta, pedras e corredor); na junção, escolhida pelo terreno do encontro. |
| **Gambits** | A lista ordenada `condição → ação` de cada creep **na batalha**, com presets por papel (linha de frente, atirador, escaramuçador, portador). É a IA do adversário e do auto-resolve. |
| **Auto-resolve** | A batalha inteira decidida pelos gambits, sem humano e sem tela, pela mesma simulação. |
| **Laboratório de batalha** | A página local (`npm run lab`) para jogar e experimentar as regras de combate, sem o mundo. |
| **Errante** | Monstro hostil que vaga rápido e reaparece cada vez mais, e entra nas lutas por perto. A primeira facção neutra (fatia D). |
| **Chefão** | Monstro lento, num ponto do mapa, que dá um buff ou um item raro a quem dá o último golpe (tema "A jungle hostil"). |
| **Crônica** | O narrador do mundo: o `sim` emite os eventos, e o cliente os conta em frases, com a voz de cada creep. |
| **Liga** | Um grupo de creeps liderado por um **creep** (não por um jogador), com símbolo próprio; na batalha, o líder pelo humano e os seguidores na formação, pelos gambits (tema "As ligas"). |
| **Mestre da mesa** | O papel neutro que mantém a partida viva e conduz o arco do mundo, sem mexer no placar. Um bot sempre, com a cadeira aberta a um humano. |
| **Deus** | *(Nome provisório)* O papel do jogador na crônica, com a **influência** (o peso que abre portas), a **conduta** (o karma, de −1 cruel a +1 benevolente, nascido das ações) e um recurso próprio. A moldura da saga pode renomeá-lo. |
| **Arco do mundo** | A história principal secreta da partida, em atos com gatilhos, que termina no fim do mundo. O mestre escolhe os ramos; tudo é revelado no fim. |
| **Corrupção** | O apocalipse do arco: cada depósito de cristal esgotado apodrece e cresce até cobrir o mapa. Ninguém a limpa. |
| **Ponto sem volta** | O momento em que tantos depósitos se esgotaram que o fim do mundo já é inevitável. |
| **Lenda** | Um creep vivo no fim do mundo, de qualquer time. Mais adiante, pode invadir outro mundo. |
| **Kit divino** | A especialização do deus, escolhida pelo estilo de jogo (ex.: quem joga ativamente, quem está aprendendo, quem tem 15 minutos por dia); a conduta dá o sabor de cada poder. |
| **Neutralidade kármica** | A faixa do karma perto de zero, com benefícios e trade-offs próprios, entre o cruel e o benevolente. |
| **Fiel** | Um creep (do time ou neutro) que reconhece o deus; o primeiro nasce da primeira quest do deus cumprida. |
| **Portal** | A passagem que se abre no centro do mapa no ato III, por onde chega uma lenda: de início, gerada pela seed, como um bot neutro que se pode converter. |
| **Fidelidade** | O quanto um creep reconhece um deus; uma por par (creep, deus). Abre as camadas da ficha e as quests aceitas; não muda o time. |
| **Ficha** | A página de um creep ou de um deus: o operacional sempre aberto ao time, o pessoal pela fidelidade. A ficha de um único pode mentir. |
| **Único** | Um personagem dos ramos da história principal (ex.: o retornado), que pode se disfarçar entre os creeps comuns. |
| **Ambição** | O objetivo próprio de um deus, pelo kit, pela conduta e pela crônica; conta na história do fim, sem decidir a guerra. |
| **Demônio** | *(Pele)* O deus enquanto o karma está do lado cruel. |
