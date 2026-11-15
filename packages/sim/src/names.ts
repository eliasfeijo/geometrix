// Creep names (M2 encontro spec D1, plan P5): short invented words, easier to
// tell apart than "Quadrado #46" (owner decision, M1 F7). A creep gets its
// name at birth from the world's birth counter (state.births), so a name
// never changes when other creeps die, and the chronicle can name the dead.

/**
 * Pairwise at least 2 edits apart, so no two read alike at a glance (checked
 * by the tests). Words that read as slang in Portuguese or English were left
 * out, and so were game words like "mundo" and names starting with I, which
 * reads as l in sans-serif fonts ("Iara" / "lara").
 */
// prettier-ignore
export const NAMES = [
  "Abo", "Adri", "Aiko", "Alum", "Arvo", "Azim", "Bako", "Belu", "Biro",
  "Boza", "Brun", "Buvi", "Cael", "Coda", "Cuni", "Dabi", "Deno", "Dita",
  "Dorn", "Duko", "Ebon", "Elko", "Emru", "Enzo", "Evo", "Fabe", "Fizo",
  "Floe", "Fumi", "Gaia", "Gido", "Golo", "Grit", "Guma", "Heru", "Hilo",
  "Hosu", "Jabu", "Joka", "Juri", "Kai", "Keto", "Kibo", "Koru", "Kyra",
  "Lazo", "Lemi", "Lovi", "Lyss", "Mika", "Moxi", "Mugo", "Myla", "Nemo",
  "Nori", "Nuva", "Obi", "Odin", "Olmo", "Onix", "Puka", "Quim", "Rado",
  "Rila", "Roko", "Ruvo", "Saku", "Soma", "Suki", "Svea", "Taro", "Tevi",
  "Tomo", "Ubin", "Udo", "Ulma", "Umbo", "Veda", "Voss", "Wren", "Xavi",
  "Yago", "Yeti", "Yuna", "Zeca", "Zino", "Zola", "Agni", "Bolt", "Cira",
  "Fena", "Gale", "Jade", "Kesi", "Lumo", "Teco", "Ulfo", "Alva", "Bexo",
  "Enki", "Halu", "Joli", "Lanu", "Opal", "Peri", "Quel", "Sami", "Tuli",
  "Vesu", "Ximo", "Astra", "Bento", "Dresi", "Eloy", "Farol", "Gwen", "Janko",
  "Kelpi", "Lorca", "Marlo", "Nandi", "Orvel", "Pimbo", "Quiri", "Rasko",
  "Selva", "Tambo", "Ulric", "Vanda", "Wendo", "Yasmo", "Zorba", "Brisa",
  "Cleo", "Drako", "Ember", "Flint", "Gusto", "Hanna", "Klee", "Lirio",
  "Nesta", "Olaf", "Pluma", "Quark", "Sorel", "Tusk", "Urko", "Velta", "Zenit",
  "Cosmo", "Dalia", "Fiona", "Glimo", "Jasper", "Mossa", "Nyx", "Orla", "Rhea",
  "Sylvo", "Tisha", "Yrsa", "Zinnia", "Brio", "Cedro", "Dunas", "Estro",
  "Gripo", "Holm", "Juca", "Krill", "Lenko", "Mirto", "Osku", "Pavo", "Trevo",
  "Unda", "Wisp", "Yole",
] as const;

/** Coprime with NAMES.length: births in a row get names far apart in the list. */
export const NAME_STRIDE = 37;

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * The name of the creep born `rank`-th in the world (0 = first); after the
 * list, "Taro II".
 */
export function nameAt(rank: number): string {
  const n = NAMES.length;
  const base = NAMES[(rank * NAME_STRIDE) % n]!;
  const round = Math.floor(rank / n) + 1;
  if (round === 1) return base;
  return `${base} ${ROMAN[round] ?? String(round)}`;
}
