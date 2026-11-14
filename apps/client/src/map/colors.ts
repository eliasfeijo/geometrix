// Map palette (owner decision, F7: dark theme). Kept in sync with the CSS
// variables in styles.css where both use a color.

export const COLORS = {
  background: "#0d0f12",
  jungle: "#16241c",
  jungleGrid: "#21352a",
  river: "#1d4870",
  crossing: "#3b6a92",
  rock: "#4a4e57",
  road: "#7c766a",
  roadEdge: "#a39b8a",
  teams: ["#4ea8ff", "#ff8c42"],
  materia: "#7fdba0",
  cristal: "#c48cff",
  outline: "#f2f4f8",
  selection: "#ffd166",
  dominated: "#ffffff",
  depleted: "#555b66",
} as const;

export const teamColor = (team: number): string =>
  COLORS.teams[team] ?? COLORS.outline;
