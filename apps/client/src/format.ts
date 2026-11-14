// Texts shown to the player (PT-BR), kept apart from the components so they
// can be tested.

import type { RejectReason } from "@geometrix/protocol";
import type { Dna, Resource } from "@geometrix/sim";

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

export const TEAM_NAMES = ["Azul", "Laranja"];

export const teamName = (team: number) => TEAM_NAMES[team] ?? `Time ${team}`;

/** Why a command was refused, for the notice. */
export const REJECT_TEXTS: Record<RejectReason | "disconnected", string> = {
  alreadyJoined: "Você já está neste mundo.",
  unknownTeam: "Esse time não existe.",
  teamFull: "Esse time já tem o máximo de humanos.",
  unknownPlayer: "Sua entrada no mundo ainda não foi processada.",
  unknownCreep: "Esse creep não existe mais.",
  notYourTeam: "Esse creep é do outro time.",
  alreadyDominating: "Você já domina esse creep.",
  dominatedByOther: "Outro jogador já domina esse creep.",
  cooldown: "Espere o tempo de recarga para dominar de novo.",
  tooFar: "Esse creep está longe demais do Núcleo.",
  stock: "Estoque insuficiente.",
  notDominating: "Você não domina esse creep.",
  invalidOrder: "Ordem inválida.",
  tooManyRules: "Regras demais para um creep.",
  invalidRule: "Regra inválida.",
  invalidPreset: "Preset inválido.",
  invalidTarget: "Ponto inválido para esse preset.",
  busy: "O Núcleo já está produzindo.",
  populationCap: "O time chegou ao teto de população.",
  owned: "O time já tem esse upgrade.",
  unknownCommand: "Comando desconhecido.",
  invalidDna: "DNA inválido.",
  invalidUpgrade: "Upgrade inválido.",
  invalidMessage: "Mensagem inválida.",
  worldEnded: "O mundo terminou: só leitura.",
  disconnected: "Sem conexão com o servidor.",
};

export const FATAL_TEXTS = {
  unauthorized: "Sessão inválida para este mundo. Entre de novo.",
  worldNotHosted: "Este mundo não está hospedado no servidor.",
} as const;
