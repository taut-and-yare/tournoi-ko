import type { Match, Round } from '../types';
import { createMatch } from './match';

export function isRoundComplete(round: Round): boolean {
  return round.matches.every((m) => m.winnerId !== null);
}

export function generateNextRound(rounds: Round[]): Round | null {
  const last = rounds[rounds.length - 1];
  if (!last || last.matches.length < 2 || !isRoundComplete(last)) return null;
  const matches: Match[] = [];
  for (let i = 0; i < last.matches.length; i += 2) {
    const w1 = last.matches[i].winnerId!;
    const w2 = last.matches[i + 1].winnerId!;
    matches.push(createMatch(w1, w2));
  }
  return { index: last.index + 1, matches };
}

export function currentRoundIndex(rounds: Round[]): number {
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].matches.some((m) => m.winnerId === null)) return i;
  }
  return Math.max(0, rounds.length - 1);
}

export function buildThirdPlaceMatch(rounds: Round[]): Match | null {
  const semi = rounds.find((r) => r.matches.length === 2);
  if (!semi || !isRoundComplete(semi)) return null;
  const losers = semi.matches.map((m) => m.loserId!);
  return createMatch(losers[0], losers[1]);
}
