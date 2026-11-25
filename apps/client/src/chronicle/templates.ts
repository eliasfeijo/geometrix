// The chronicle's phrase bank (M2 encontro spec D17, GDD 08): data, not
// code. Per event type, per outcome and, where a creep speaks, per DNA (its
// voice, until temperaments in M2.5). narrate.ts picks the variant from the
// event itself, so every client and the replay read the same sentence (K-3).
//
// The voices (initial bank by the agent; the owner reviews the tone at the
// F6 checkpoint):
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
   * The battle (junction K-3). Plain sentences for now: the voiced bank comes
   * with the battle screen (junction F5).
   */
  battleOpened: ["Começa uma batalha: {first} contra {second}."],
  /** A wanderer, {first}, fell on {second} (junction D14: no dialogue). */
  battleOpenedByWanderer: [
    "{first}, um andarilho, cai sobre {second} sem aviso.",
    "Da mata sai {first}, um andarilho, direto em {second}.",
  ],
  /** A wanderer, {creep}, appeared in the band along the river. */
  wandererBorn: [
    "Um andarilho, {creep}, surge na mata do rio.",
    "{creep}, um andarilho, ronda a beira do rio.",
  ],
  /** {creep} entered a battle already open. */
  battleJoined: ["{creep} entra na batalha."],
  /** {creep} back in the world alive: by the border, or with no winner. */
  battleLeft: {
    edge: ["{creep} escapa da batalha pela borda."],
    idle: ["{creep} volta da batalha sem vencedor."],
  },
  /** The end; {team} is the winner's team. */
  battleEnded: {
    won: ["A batalha termina com a vitória do time {team}."],
    wanderers: ["A batalha termina com a vitória dos andarilhos."],
    idle: ["A batalha termina sem vencedor."],
    empty: ["A batalha termina sem ninguém de pé."],
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
  battleOpened: readonly string[];
  battleOpenedByWanderer: readonly string[];
  wandererBorn: readonly string[];
  battleJoined: readonly string[];
  battleLeft: Record<"edge" | "idle", readonly string[]>;
  battleEnded: Record<
    "won" | "wanderers" | "idle" | "empty",
    readonly string[]
  >;
  died: Record<"killed" | "alone", readonly string[]>;
  pickedUp: readonly string[];
  born: Voiced;
};
