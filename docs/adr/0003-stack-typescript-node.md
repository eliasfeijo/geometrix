# ADR-0003: TypeScript + Node LTS, com simulação pura e math inteira

**Status:** Accepted (2026-11-13) · **Data:** 2026-11-13
**Relaciona:** ADR-0001 (mundo × batalha), ADR-0002 (tudo é comando), spec M1

## Contexto
A simulação precisa rodar em três lugares:
- no **servidor**, como autoridade do mundo e das batalhas;
- numa **CLI sem interface**, para bots, varreduras de parâmetros e o teste de determinismo;
- no **navegador**, para replays (M1) e para a previsão do creep dominado na batalha (M2).

Rodar no navegador limita as opções reais a JS/TS ou WASM.

Ordens de grandeza esperadas:
- **Mundo do M1:** cerca de 60 creeps, grid 64×64, 1 tick/s. Na simulação sem interface, cerca de 430 ticks/s
  (3 dias em menos de 10 min).
- **Batalha do M2:** dezenas a centenas de entidades a 20–30 ticks/s.

## Alternativas
- **A. TypeScript em todo lugar; servidor em Node LTS** (escolhida).
  - Prós: a mesma simulação no servidor, no navegador e na CLI, sem ponte; uma linguagem só; a melhor velocidade
    de iteração e de DX com IA; debug nativo no navegador; performance suficiente para as ordens de grandeza acima.
  - Contras: pausas de GC e menos performance bruta; o determinismo depende de disciplina.
- **B. Núcleo em Rust → WASM, UI em TS.**
  - Prós: performance e determinismo mais fáceis; o mesmo binário no cliente e no servidor.
  - Contras: duas linguagens e toolchain extra; atrito na fronteira JS↔WASM; iteração mais lenta. Otimização
    prematura para a escala do jogo.
- **C. Servidor em Go, cliente em TS.**
  - Prós: afinidade com o control plane do amigo; performance no servidor.
  - Contras: simulação duplicada, ou Go→WASM (bundle de ~2 MB+, com GC); inviabiliza a previsão compartilhada do M2.
- **Runtime Bun em vez de Node.**
  - Prós: TS, SQLite, WebSocket com pub/sub, testes e bundler embutidos.
  - Contras: menos histórico em processos que rodam por dias; observabilidade (OTel) menos madura. Fica como troca
    barata no futuro.

## Decisão
**Opção A**, com Node LTS no servidor e as regras abaixo.

### Regras da simulação
1. **Módulo puro:** sem I/O, sem DOM e sem APIs do runtime. É uma função `estado + comandos → novo estado`,
   agnóstica de runtime.
2. **Math inteira ou de ponto fixo:** posições em células, quantidades inteiras, tempo em ticks.
3. **Proibido na simulação:** `Math.random` (usar RNG com seed, que faz parte do estado); funções transcendentais
   (`Math.sin`, `Math.exp`…), cujo resultado pode variar entre V8 e JavaScriptCore; `Date.now` e outros relógios;
   iteração sobre estruturas sem ordem garantida.
4. **TS só com sintaxe apagável** (`erasableSyntaxOnly`: sem `enum` nem `namespace`), para o Node rodar `.ts` sem
   build. O cliente usa Vite/esbuild, a única etapa de build.

## Consequências
- O teste de determinismo (mesma seed + comandos ⇒ mesmo hash de estado) roda no CI. Idealmente roda também num
  segundo engine JS para pegar diferenças entre V8 e JSC.
- **Saída de performance:** um trecho quente (pathfinding, colisão nas batalhas) pode ser portado para WASM
  isoladamente, sem mudar a arquitetura.
- Só o adaptador de servidor (rede, persistência) conhece o Node. Trocar para o Bun afeta só ele.
- A integração com o control plane em Go, quando vier, acontece pelo contrato (REST/HTTP), não por linguagem
  compartilhada.
