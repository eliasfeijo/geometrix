// Seeded xoshiro128** (Blackman & Vigna), 32-bit integer math only, so the
// sequence is identical on every JS engine. A copy of the sim's rng.ts (plan
// P1): the battle does not import the sim (ADR-0008). test/shared.test.ts
// checks both give the same sequence. The state is part of BattleState.

export type RngState = [number, number, number, number];

const UINT32_RANGE = 0x1_0000_0000;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

// murmur3 fmix32 over a Weyl sequence: spreads a small integer seed over the
// 128-bit state.
function mixSeed(seed: number, index: number): number {
  let z = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

export function createRng(seed: number): RngState {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError(`seed must be an integer in [0, 2^32): ${seed}`);
  }
  const state: RngState = [
    mixSeed(seed, 0),
    mixSeed(seed, 1),
    mixSeed(seed, 2),
    mixSeed(seed, 3),
  ];
  // xoshiro must never start from the all-zero state.
  if (state.every((word) => word === 0)) state[0] = 1;
  return state;
}

/** Next uint32. Advances `rng` in place. */
export function nextUint32(rng: RngState): number {
  const [s0, s1, s2, s3] = rng;
  const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  const n2 = (s2 ^ s0) >>> 0;
  const n3 = (s3 ^ s1) >>> 0;
  rng[1] = (s1 ^ n2) >>> 0;
  rng[0] = (s0 ^ n3) >>> 0;
  rng[2] = (n2 ^ t) >>> 0;
  rng[3] = rotl(n3, 11);
  return result;
}

/** Uniform integer in [0, bound), without modulo bias. Advances `rng`. */
export function nextInt(rng: RngState, bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0 || bound > UINT32_RANGE) {
    throw new RangeError(`bound must be an integer in [1, 2^32]: ${bound}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % bound);
  let value = nextUint32(rng);
  while (value >= limit) value = nextUint32(rng);
  return value % bound;
}

/** Uniform integer in [min, max], both inclusive. Advances `rng`. */
export function nextRange(rng: RngState, min: number, max: number): number {
  if (max < min) throw new RangeError(`empty range [${min}, ${max}]`);
  return min + nextInt(rng, max - min + 1);
}
