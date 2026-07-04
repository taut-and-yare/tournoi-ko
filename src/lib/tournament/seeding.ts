import type { Player } from '../types';

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
}

export function standardSeedOrder(n: number): number[] {
  if (!isPowerOfTwo(n)) throw new Error(`Bracket size must be a power of two, got ${n}`);
  let seeds = [1];
  while (seeds.length < n) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildFirstRoundSlots(
  players: Player[],
  byElo: boolean,
  rng: () => number = Math.random
): Player[] {
  if (!byElo) return shuffle(players, rng);
  const sorted = [...players].sort((a, b) => b.elo - a.elo); // seed 1 = highest ELO
  const order = standardSeedOrder(players.length);
  return order.map((seed) => sorted[seed - 1]);
}
