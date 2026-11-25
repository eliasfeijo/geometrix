// Formatting for the CLI's reports (pt-BR numbers, Markdown tables, world
// and real time), shared by report.md, the sweep, net and the pace targets.

export const HOUR = 3600;

export const number = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
export const percent = (part: number, whole: number) =>
  whole === 0 ? "—" : `${number((100 * part) / whole)}%`;
export const hours = (seconds: number) => `${number(seconds / HOUR, 1)} h`;
export const minutes = (seconds: number) => `${number(seconds / 60)} min`;

/** World seconds as real minutes at the time multiplier ×N (M2 R plan P1). */
export const realMinutes = (seconds: number, multiplier: number) =>
  seconds / multiplier / 60;

/**
 * World seconds as real time at ×N: minutes (one decimal under 10) up to two
 * hours, hours beyond.
 */
export function realTime(seconds: number, multiplier: number): string {
  const m = realMinutes(seconds, multiplier);
  if (m >= 120) return `${number(m / 60, 1)} h reais`;
  return `${number(m, m < 10 ? 1 : 0)} min reais`;
}

/** World time with its real time beside it: "3,0 h (30 min reais)". */
export const worldAndReal = (
  seconds: number,
  multiplier: number,
  format: (seconds: number) => string = hours,
) => `${format(seconds)} (${realTime(seconds, multiplier)})`;

export function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join(
    "\n",
  );
}
