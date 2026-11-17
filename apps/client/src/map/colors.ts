// Map palette (owner decision, F7: dark theme). Kept in sync with the CSS
// variables in styles.css where both use a color.

export const COLORS = {
  background: "#0d0f12",
  jungle: "#16241c",
  jungleGrid: "#21352a",
  river: "#1d4870",
  crossing: "#3b6a92",
  // Rocks read as raised blocks, roads as light warm dirt (owner, F9).
  rock: "#2f3238",
  rockLit: "#5c616c",
  rockShade: "#1c1e22",
  border: "#4a4e57",
  road: "#b8a07a",
  roadEdge: "#8a7552",
  teams: ["#4ea8ff", "#ff8c42"],
  /** Light team tones for text on the map (creep names). */
  teamText: ["#b5dbff", "#ffcaa3"],
  materia: "#7fdba0",
  cristal: "#c48cff",
  outline: "#f2f4f8",
  selection: "#ffd166",
  dominated: "#ffffff",
  depleted: "#555b66",
  /** Fog (M1.5): never seen, and the veil over what is out of sight. */
  unseen: "#050608",
  veil: "#0d0f12",
  /** What a team pays, rising from its core (F9). */
  paid: "#ff9b9b",
  /** HP bar by band (M2 encontro C-1). */
  hp: { high: "#7fdba0", mid: "#ffd166", low: "#ff5d5d" },
  /** A fight between two creeps (C-3). */
  fight: "#ff5d5d",
} as const;

export const teamColor = (team: number): string =>
  COLORS.teams[team] ?? COLORS.outline;

export const teamTextColor = (team: number): string =>
  COLORS.teamText[team] ?? COLORS.outline;
