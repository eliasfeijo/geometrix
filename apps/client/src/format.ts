// Texts shown to the player (PT-BR), kept apart from the components so they
// can be tested.

import type { RejectReason } from "@geometrix/protocol";
import type {
  Action,
  Condition,
  Deposit,
  Dna,
  Order,
  Reply,
  Resource,
  Rule,
  Stock,
} from "@geometrix/sim";

/** "dia 2 · 03:15": world time from tick 0 (day 1 starts at 00:00). */
export function worldClock(tick: number, tickSeconds: number): string {
  const seconds = tick * tickSeconds;
  const day = Math.floor(seconds / 86_400) + 1;
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `dia ${day} · ${pad(hours)}:${pad(minutes)}`;
}

/** "9:05" or "1:02:03": a duration in world seconds. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(rest)}` : `${m}:${pad(rest)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const DNA_NAMES: Record<Dna, string> = {
  square: "Quadrado",
  triangle: "Triângulo",
  circle: "Círculo",
};

export const RESOURCE_NAMES: Record<Resource, string> = {
  materia: "matéria",
  cristal: "cristal",
};

/** "12 matéria e 4 cristal", "4 cristal", "nada": an amount of each resource. */
export function stockText(stock: Stock): string {
  const parts: string[] = [];
  if (stock.materia > 0) parts.push(`${stock.materia} matéria`);
  if (stock.cristal > 0) parts.push(`${stock.cristal} cristal`);
  return parts.length === 0 ? "nada" : parts.join(" e ");
}

/** The answers to an encounter (M2 encontro C-5), as buttons. */
export const REPLY_TEXTS: Record<Reply, string> = {
  pay: "Pagar",
  refuse: "Recusar e lutar",
};

export const TEAM_NAMES = ["Azul", "Laranja"];

/** A team's name; null is the wanderers' side. */
export const teamName = (team: number | null) =>
  team === null ? "Andarilhos" : (TEAM_NAMES[team] ?? `Time ${team}`);

/** Why a command was refused, for the notice. */
export const REJECT_TEXTS: Record<RejectReason | "disconnected", string> = {
  alreadyJoined: "Você já está neste mundo.",
  unknownTeam: "Esse time não existe.",
  teamFull: "Esse time já tem o máximo de humanos.",
  humanDifficulty: "Só um bot tem dificuldade.",
  unknownPlayer: "Sua entrada no mundo ainda não foi processada.",
  unknownCreep: "Seu time não tem esse creep.",
  alreadyDominating: "Você já domina esse creep.",
  dominatedByOther: "Outro jogador já domina esse creep.",
  cooldown: "Espere o tempo de recarga para dominar de novo.",
  tooFar: "Esse creep está longe demais do Núcleo.",
  stock: "Estoque insuficiente.",
  notDominating: "Você não domina esse creep.",
  invalidOrder: "Ordem inválida.",
  engaged: "Esse creep está num encontro.",
  inBattle: "Esse creep está numa batalha.",
  fleeing: "Esse creep está fugindo.",
  notEngaged: "Esse creep não está num encontro.",
  invalidReaction: "Essa resposta não cabe agora.",
  tooManyRules: "Regras demais para um creep.",
  invalidRule: "Regra inválida.",
  invalidPreset: "Preset inválido.",
  invalidTarget: "Alvo inválido.",
  busy: "O Núcleo já está produzindo.",
  populationCap: "O time chegou ao teto de população.",
  owned: "O time já tem esse upgrade.",
  unknownCommand: "Comando desconhecido.",
  invalidDna: "DNA inválido.",
  invalidUpgrade: "Upgrade inválido.",
  // The junction host's results: no client sends them (junction plan P2).
  notSystem: "Comando reservado ao servidor.",
  unknownBattle: "Essa batalha não existe.",
  notInBattle: "Esse creep não está nessa batalha.",
  invalidResult: "Resultado de batalha inválido.",
  invalidMessage: "Mensagem inválida.",
  worldEnded: "O mundo terminou: só leitura.",
  notYourBattle: "Seu time não está nessa batalha.",
  notYourParticipant: "Você não comanda esse participante.",
  notControlling: "Você não controla ninguém nessa batalha.",
  countingDown: "Aguarde a contagem terminar.",
  emptyCargo: "Esse creep não carrega nada.",
  disconnected: "Sem conexão com o servidor.",
};

export const FATAL_TEXTS = {
  unauthorized: "Sessão inválida para este mundo. Entre de novo.",
  worldNotHosted: "Este mundo não está hospedado no servidor.",
  outdated: "O jogo foi atualizado. Recarregando a página…",
} as const;

export function conditionText(c: Condition): string {
  switch (c.type) {
    case "always":
      return "sempre";
    case "cargoFull":
      return "carga cheia";
    case "cargoEmpty":
      return "carga vazia";
    case "resourceInRange":
      return `${RESOURCE_NAMES[c.resource]} a até ${c.radius} células`;
    case "stockBelow":
      return `estoque de ${RESOURCE_NAMES[c.resource]} < ${c.amount}`;
    case "resourceUnknown":
      return `não conhece depósito de ${RESOURCE_NAMES[c.resource]}`;
    case "enemyInSight":
      return `inimigo à vista a até ${c.radius} células${dnaFilter(c.dna)}${cargoFilter(c.minCargo)}`;
    case "hpBelow":
      return `HP abaixo de ${c.permille / 10}%`;
    case "demandAtMost":
      return `exigência até ${c.permille / 10}% da carga`;
    case "allyInBattle":
      return `aliado em batalha a até ${c.radius} células`;
  }
}

const dnaFilter = (dna: readonly Dna[] | undefined) =>
  dna === undefined
    ? ""
    : ` (${dna.map((d) => DNA_NAMES[d].toLowerCase()).join(", ")})`;

const cargoFilter = (minCargo: number) =>
  minCargo > 0 ? `, com carga ≥ ${minCargo}` : "";

/** A creep's name by id, for the texts that point at one. */
export type NameOf = (id: number) => string;

const byId: NameOf = (id) => `o creep #${id}`;

/** Names from the view's creeps; one it lost keeps its number. */
export const namesOf =
  (creeps: readonly { id: number; name: string }[]): NameOf =>
  (id) =>
    creeps.find((c) => c.id === id)?.name ?? byId(id);

export function actionText(a: Action, nameOf: NameOf = byId): string {
  switch (a.type) {
    case "gather":
      return `coletar ${RESOURCE_NAMES[a.resource]}`;
    case "deliver":
      return "entregar no Núcleo";
    case "buildRoad":
      return a.x === undefined || a.y === undefined
        ? "construir estrada até a jazida mais perto sem estrada"
        : `construir estrada até (${a.x}, ${a.y})`;
    case "moveTo":
      return `ir até (${a.x}, ${a.y})`;
    case "stop":
      return "ficar parado";
    case "explore":
      return "explorar";
    case "pickup":
      return "catar despojo";
    case "approach":
      return `${a.intent === "attack" ? "atacar" : "extorquir"} o inimigo mais perto a até ${a.radius} células${dnaFilter(a.dna)}${cargoFilter(a.minCargo)}`;
    case "pay":
      return "pagar a extorsão";
    case "fight":
      return "lutar";
    case "flee":
      return "fugir";
    case "follow":
      return `seguir ${nameOf(a.creepId)}`;
    case "drop":
      return "largar a carga";
    case "joinBattle":
      return `entrar na batalha do aliado (HP ≥ ${a.minHpPermille / 10}%)`;
  }
}

export const ruleText = (rule: Rule, nameOf: NameOf = byId) =>
  `${conditionText(rule.when)} → ${actionText(rule.then, nameOf)}`;

/** The creep's current order, as a sentence. */
export function orderText(
  order: Order,
  deposits: readonly Deposit[],
  nameOf: NameOf = byId,
): string {
  switch (order.type) {
    case "stop":
      return "nenhuma";
    case "moveTo":
      return `ir até (${order.x}, ${order.y})`;
    case "explore":
      return `explorar (${order.x}, ${order.y})`;
    case "gather": {
      const deposit = deposits.find((d) => d.id === order.depositId);
      return deposit === undefined
        ? `coletar no depósito #${order.depositId}`
        : `coletar ${RESOURCE_NAMES[deposit.kind]} em (${deposit.x}, ${deposit.y})`;
    }
    case "deliver":
      return "entregar no Núcleo";
    case "buildRoad":
      return `construir estrada até (${order.x}, ${order.y})`;
    case "approach":
      return order.intent === "attack"
        ? `atacar o creep #${order.targetId}`
        : `extorquir o creep #${order.targetId}`;
    case "pickup":
      return `catar o despojo #${order.spoilId}`;
    case "flee":
      return "fugir para o Núcleo";
    case "follow":
      return `seguir ${nameOf(order.targetId)}`;
    case "drop":
      return "largar a carga";
  }
}

/** "30 s", "1 min", "10 min", "1 h 30 min": a world duration in words. */
export function durationWords(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  if (s % 60 !== 0) return duration(s);
  const minutes = s / 60;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
