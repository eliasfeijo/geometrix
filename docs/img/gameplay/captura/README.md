# As capturas do guia de gameplay

Scripts que produzem as imagens do [guia de gameplay](../../../GAMEPLAY.md). Dirigem um Chromium headless pelo
DevTools Protocol, sem dependências: o binário é o do cache do Playwright
(`~/.cache/ms-playwright/chromium_headless_shell-*`), ou o de `GEO_CHROME`. Os quadros vão para uma pasta
temporária. Os GIFs e a escolha dos quadros ficam a cargo do `ffmpeg`.

| Script | O que faz | Imagens |
|---|---|---|
| `mundo.mjs` | Cria um mundo com um bot em cada time, entra no Azul e captura a tela a cada 20 s, com a crônica e uma rajada de quadros | `mundo-*.png`, `mundo-*.gif` |
| `lab.mjs` | Monta os lados no formulário do laboratório, marca "ninguém (só assistir)" e grava a batalha | `lab-*.gif` |
| `maquetes.mjs` | Renderiza as maquetes de [`../maquetes/`](../maquetes/) em PNG, no tamanho do conteúdo | `maquete-*.png` |

## Como refazer

```bash
npm run build
GEO_PORT=8791 GEO_DB=/tmp/capturas.db node apps/server/src/main.ts &

# o mundo (~9 min de relógio a ×360, cobre os três dias)
node docs/img/gameplay/captura/mundo.mjs http://localhost:8791 /tmp/capturas 9 42 360

# as batalhas
node docs/img/gameplay/captura/lab.mjs http://localhost:8791 /tmp/capturas/lab-pedras pedras \
  '[["square","triangle","circle"],["square","triangle","circle"]]' 30 7
node docs/img/gameplay/captura/lab.mjs http://localhost:8791 /tmp/capturas/lab-corredor corredor \
  '[["square","circle"],["triangle","triangle"],["circle","square"]]' 30 11

# as maquetes (não precisam do servidor)
node docs/img/gameplay/captura/maquetes.mjs docs/img/gameplay
```

Os GIFs saíram assim (7 quadros por segundo nas batalhas, recortando o campo do laboratório):

```bash
ffmpeg -framerate 7 -i /tmp/capturas/lab-pedras/%03d.jpg -frames:v 130 \
  -vf "crop=1096:706:16:105,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  -loop 0 docs/img/gameplay/lab-pedras-3x3.gif
```

O time-lapse usa um quadro a cada 20 s a 3 fps (`crop=1140:900:0:0`, sem o primeiro, que tem a crônica sobre o
mapa); o vaivém do Núcleo usa 72 quadros da rajada a 8 fps (`crop=640:420:420:56`, escala 480, 48 cores).

## As maquetes

As maquetes são HTML e CSS no tema do cliente (as cores de `apps/client/src/styles.css` e a fonte Chakra Petch),
com o carimbo "maquete · ainda não existe no jogo" na imagem. Ilustram o guia; não são design aprovado nem código
do jogo. Ao mudar uma, renderize de novo e confira com `npm run format:check`, que também formata o HTML.
