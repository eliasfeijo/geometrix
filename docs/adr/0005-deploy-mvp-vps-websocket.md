# ADR-0005: Deploy do MVP: VPS única + Docker Compose + Caddy; transporte por WebSocket

**Status:** Accepted (2026-11-13) · **Data:** 2026-11-13
**Relaciona:** ADR-0003 (Node), ADR-0004 (SQLite + Litestream), ROADMAP M1/M2

## Contexto
Até o M3, o backend é um processo Node de longa duração que hospeda vários mundos e serve o cliente estático.
O consumo estimado no M1, por mundo ativo:

| Recurso | Estimativa |
|---|---|
| CPU | < 1% de um núcleo |
| RAM | poucos MB (fora a base do processo, ~100 MB) |
| Disco | poucos MB por dia |
| Banda | ~1–2 KB/s por cliente |

No M2, uma batalha consome ~5–20 KB/s por cliente, a 20–30 Hz. O tick do mundo roda continuamente por dias, o que
descarta modelos de execução por requisição.

## Alternativas
- **A. Uma VPS pequena** (2 vCPU / 4 GB) com Docker Compose: app + Caddy + Litestream (escolhida).
  - Prós: ~US$ 5–10/mês; disco persistente simples; controle total; ambiente igual ao local.
  - Contras: um ponto único de falha (mitigado pelo backup contínuo e pelo restart automático); a operação é nossa.
- **B. Fly.io** (Machines + volumes).
  - Prós: boa DX de deploy; regiões.
  - Contras: o volume fica preso a uma máquina; mais custo e conceitos sem ganho no MVP.
- **C. Cloudflare Durable Objects** (um mundo por objeto; WebSocket e SQLite embutidos).
  - Prós: elegante; escala por mundo.
  - Contras: lock-in; difícil rodar igual localmente; a simulação sem interface roda em outro lugar de qualquer jeito.
- **D. Serverless (Lambda e similares).**
  - Contras: incompatível com um loop de tick contínuo.
- **E. Kubernetes/Agones** (a infra do control plane do amigo).
  - Contras: excessivo agora. Fica como caminho de escala (abaixo).

**Transporte:**
- **WebSocket** (escolhido): suporte universal; suficiente para o mundo a 1 Hz e para a batalha do M2 em escala
  pequena.
- **WebTransport ou WebRTC DataChannel:** só se a medição no M2 mostrar que o head-of-line blocking do TCP
  prejudica a batalha.

## Decisão
| Fase | Onde roda |
|---|---|
| Playtests comprimidos do M1 | Máquina de dev + túnel (Cloudflare Tunnel ou Tailscale Funnel), custo zero |
| Teste de 24 h e marcos seguintes | **Opção A**: uma VPS com Docker Compose (app Node + Caddy com HTTPS automático + Litestream para object storage) |

O cliente estático é servido pelo próprio app, atrás do Caddy. CDN só se for necessário.

**Dependências de backend, a lista completa:** Node LTS, `ws`, driver SQLite, Litestream, Caddy, Docker Compose.
Ficam de fora, de propósito: banco gerenciado, Redis, filas, Kubernetes, serverless e contas (login é só nome de
convidado com um token no `localStorage`).

**CI/CD** (GitHub Actions):
1. typecheck, testes, teste de determinismo e um smoke test da simulação sem interface;
2. build da imagem e push para um registry;
3. deploy via SSH: `docker compose pull && docker compose up -d`.

## Consequências
- Um restart da VPS ou um deploy interrompe os mundos por segundos. Eles retomam a partir do snapshot e do log
  (ADR-0004). Os clientes precisam reconectar automaticamente.
- **Caminho de escala:**
  1. mais mundos por processo;
  2. vários processos ou VPSs com shard de mundos, mais um roteamento simples de "mundo → servidor";
  3. um mundo vira um game server numa fleet Agones do control plane do amigo.
- Observabilidade operacional (OTel/Grafana) é opt-in, quando houver necessidade. As métricas de jogo já vêm do
  harness (ADR-0004).
