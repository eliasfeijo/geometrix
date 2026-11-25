// The chronicle's phrase bank (M2 encontro spec D17, GDD 08): data, not
// code. Per event type, per outcome and, where a creep speaks, per DNA (its
// voice, until temperaments in M2.5). narrate.ts picks the variant from the
// event itself, so every client and the replay read the same sentence (K-3).
//
// The voices (initial bank by the agent; the owner reviews the tone at the
// F6 checkpoint, and the battle's lines at junction checkpoint C2):
// - square (tank, melee, slow, heavy): few words, grave, physical;
// - triangle (balanced, mid range): practical, a trader doing the math;
// - circle (glass cannon, fast, fragile): cheeky, quick, nervous.
//
// Placeholders, filled by narrate.ts: creeps as {aggressor}, {victim},
// {creep}, {from}, {to}, {first}, {second}, {by} (clickable names); amounts
// as {demand}, {amount}, {taken}; {team} as the team's name.

import type { Dna } from "@geometrix/sim";

/** Variants per DNA: the voice of the creep that speaks. */
export type Voiced = Readonly<Record<Dna, readonly string[]>>;

export const TEMPLATES = {
  /** The aggressor declares itself (spec E-3); {victim}, {aggressor}. */
  encounter: {
    attack: {
      square: [
        '{aggressor} bloqueia o caminho de {victim}: "Daqui você não passa inteiro."',
        '{aggressor} avança sobre {victim}: "Sem conversa."',
        '{aggressor} encara {victim}: "Hoje é você."',
      ],
      triangle: [
        '{aggressor} cerca {victim}: "Nada pessoal. Você só está entre mim e a sua carga."',
        '{aggressor} se posiciona diante de {victim}: "Fiz as contas. Você perde."',
        '{aggressor} aponta para {victim}: "Vamos resolver isso do jeito rápido."',
      ],
      circle: [
        '{aggressor} gira em volta de {victim}: "Achei! Agora fica parado."',
        '{aggressor} salta na frente de {victim}: "Surpresa!"',
        '{aggressor} ri de {victim}: "Você é lento demais pra isso."',
      ],
    },
    /** With {demand}. */
    extort: {
      square: [
        '{aggressor} para diante de {victim}: "{demand}. Agora."',
        '{aggressor} estende a mão para {victim}: "Larga {demand}. Não peço duas vezes."',
        '{aggressor} barra {victim}: "Pedágio: {demand}."',
      ],
      triangle: [
        '{aggressor} aborda {victim}: "Proposta simples: {demand} e cada um segue o seu caminho."',
        '{aggressor} faz as contas diante de {victim}: "{demand} me parece um preço justo pela sua saúde."',
        '{aggressor} intercepta {victim}: "Taxa de passagem: {demand}. Recibo não tem."',
      ],
      circle: [
        '{aggressor} cutuca {victim}: "Essa bolsa tá pesada, né? Me passa {demand} que eu ajudo."',
        '{aggressor} aparece do nada ao lado de {victim}: "{demand}, por favor e obrigado!"',
        '{aggressor} rodeia {victim}: "Ou {demand}, ou a gente brinca de pega-pega."',
      ],
    },
  },
  /** Before the declaration, when both approached in the same tick (D12). */
  mutual: ["Os dois se viram ao mesmo tempo. ", "Ninguém esperou o outro. "],
  /** The answer of {creep} (E-4, E-5, L-1). */
  reaction: {
    pay: {
      square: [
        "{creep} larga a carga sem dizer nada.",
        '{creep}: "Leva. Mas eu lembro de você."',
        "{creep} paga devagar, sem tirar os olhos do outro.",
      ],
      triangle: [
        '{creep}: "Prejuízo calculado. Pode levar."',
        '{creep} paga: "Fica anotado na sua conta."',
        '{creep}: "Negócio fechado. Por enquanto."',
      ],
      circle: [
        '{creep}: "Tá bom, tá bom, toma!"',
        "{creep} joga a carga e já sai de lado.",
        '{creep}: "Fica com isso, eu nem gostava mesmo."',
      ],
    },
    refuse: {
      square: [
        '{creep}: "Vem buscar."',
        '{creep} finca os pés no chão: "Não."',
        '{creep}: "Tenta."',
      ],
      triangle: [
        '{creep}: "Contraproposta: não."',
        '{creep}: "As contas não fecham pra você."',
        '{creep} recusa: "Você calculou mal."',
      ],
      circle: [
        '{creep}: "Hahaha, não!"',
        "{creep} mostra a língua. Não tem língua, mas mostra.",
        '{creep}: "Nem pensar, a bolsa é minha!"',
      ],
    },
  },
  /** {from} paid {amount} to {to} (E-6). */
  paid: [
    "{from} entrega {amount} a {to}.",
    "{to} recolhe {amount} de {from}.",
    "{to} fica com {amount} de {from}, sem briga.",
  ],
  /**
   * A battle opens (junction K-3, D15): after the aggressor's declaration
   * (attack) or the victim's refusal (refused); {first} the aggressor,
   * {second} the victim. The narrator speaks: the creeps just did.
   */
  battleOpened: {
    attack: [
      "Começa uma batalha: {first} contra {second}.",
      "{first} e {second} se atracam. Ninguém mais passa por ali.",
      "A batalha começa: {second} tem três segundos para escolher entre lutar e correr.",
    ],
    refused: [
      "Recusa dada, a batalha começa: {first} contra {second}.",
      "{first} não aceita o não. Começa a batalha com {second}.",
      "Sem acordo: {first} parte para cima de {second}.",
    ],
  },
  /** A wanderer, {first}, fell on {second} (junction D14: no dialogue). */
  battleOpenedByWanderer: [
    "{first}, um andarilho, cai sobre {second} sem aviso.",
    "Da mata sai {first}, um andarilho, direto em {second}.",
    "{second} ouve um galho estalar. É {first}, um andarilho.",
  ],
  /** A wanderer, {creep}, appeared in the band along the river. */
  wandererBorn: [
    "Um andarilho, {creep}, surge na mata do rio.",
    "{creep}, um andarilho, ronda a beira do rio.",
    "Na beira do rio, alguém novo: {creep}, um andarilho.",
  ],
  /** {creep} entered a battle already open, in its voice (D6). */
  battleJoined: {
    square: [
      '{creep} entra na batalha: "Cheguei."',
      "{creep} abre caminho até a briga.",
      "{creep} entra na batalha sem dizer nada.",
    ],
    triangle: [
      '{creep} entra na batalha: "A conta mudou."',
      "{creep} chega para equilibrar a balança.",
      '{creep} entra na batalha: "Reforço, como combinado."',
    ],
    circle: [
      '{creep} entra na batalha correndo: "Esperaram por mim?"',
      "{creep} pula no meio da briga.",
      '{creep}: "Ninguém começa sem mim!"',
    ],
  },
  /** A wanderer, {creep}, joined a battle (W-2): no voice, the narrator's. */
  battleJoinedByWanderer: [
    "{creep}, um andarilho, entra na batalha.",
    "Atraído pelo barulho, {creep}, um andarilho, se junta à briga.",
  ],
  /**
   * {creep} back in the world alive: by the border in its voice (a wanderer
   * in the narrator's), or with no winner (D7, X-4).
   */
  battleLeft: {
    edge: {
      square: [
        "{creep} recua pela borda, pesado.",
        '{creep} sai da batalha: "Outro dia."',
        "{creep} dá as costas e deixa a briga pela borda.",
      ],
      triangle: [
        '{creep} escapa pela borda: "Recuar também é estratégia."',
        '{creep} sai da batalha: "Prejuízo menor assim."',
        "{creep} calcula a saída e escapa pela borda.",
      ],
      circle: [
        '{creep} escapa pela borda: "Tchau!"',
        "{creep} some pela borda antes que alguém perceba.",
        '{creep}: "Fui!" E foi, pela borda.',
      ],
    },
    edgeWanderer: [
      "{creep}, o andarilho, foge de volta para a mata.",
      "{creep}, o andarilho, escapa da batalha.",
    ],
    idle: [
      "{creep} volta da batalha sem vencedor.",
      "{creep} sai da briga: ninguém acertou ninguém.",
      "Cansado de esperar, {creep} deixa a batalha.",
    ],
  },
  /** The end; {team} is the winner's team. */
  battleEnded: {
    won: [
      "A batalha termina com a vitória do time {team}.",
      "O time {team} fica com o campo.",
      "Fim da batalha: o time {team} vence.",
    ],
    wanderers: [
      "A batalha termina com a vitória dos andarilhos.",
      "Os andarilhos ficam com o campo, e com o que sobrou nele.",
      "Fim da batalha: os andarilhos vencem.",
    ],
    idle: [
      "A batalha termina sem vencedor.",
      "A batalha se desfaz: ninguém venceu.",
      "Sem golpes, a batalha acaba sem vencedor.",
    ],
    empty: [
      "A batalha termina sem ninguém de pé.",
      "Não sobrou ninguém para contar a batalha.",
    ],
  },
  died: {
    /** By {by}, in the battle. */
    killed: [
      "{creep} não se levanta mais.",
      "{creep} se desfaz no chão.",
      "Fim da linha para {creep}.",
    ],
    alone: ["{creep} morreu.", "{creep} não resistiu."],
  },
  /** {creep} picked up {taken} from a spoil (S-1). */
  pickedUp: [
    "{creep} cata {taken} de um despojo.",
    "{creep} encontra {taken} no chão e leva.",
    "{creep} recolhe do chão {taken} que alguém largou.",
  ],
  /** {creep} was born; its first words. */
  born: {
    square: [
      '{creep} sai do Núcleo: "Onde é a pilha?"',
      "{creep} nasce e já parece cansado.",
      '{creep} sai do Núcleo: "Carga. Entendido."',
    ],
    triangle: [
      '{creep} sai do Núcleo: "Primeiro o mapa, depois o resto."',
      "{creep} nasce e já está fazendo contas.",
      '{creep} sai do Núcleo: "Bom dia. Qual é o plano?"',
    ],
    circle: [
      '{creep} sai do Núcleo correndo: "Cheguei!"',
      "{creep} nasce e some de vista.",
      '{creep} sai do Núcleo: "O que tem pra lá? E pra lá?"',
    ],
  },
} as const satisfies {
  encounter: Record<"attack" | "extort", Voiced>;
  mutual: readonly string[];
  reaction: Record<"pay" | "refuse", Voiced>;
  paid: readonly string[];
  battleOpened: Record<"attack" | "refused", readonly string[]>;
  battleOpenedByWanderer: readonly string[];
  wandererBorn: readonly string[];
  battleJoined: Voiced;
  battleJoinedByWanderer: readonly string[];
  battleLeft: {
    edge: Voiced;
    edgeWanderer: readonly string[];
    idle: readonly string[];
  };
  battleEnded: Record<
    "won" | "wanderers" | "idle" | "empty",
    readonly string[]
  >;
  died: Record<"killed" | "alone", readonly string[]>;
  pickedUp: readonly string[];
  born: Voiced;
};
