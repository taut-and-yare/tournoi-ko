import { describe, it, expect } from 'vitest';
import { isRoundComplete, generateNextRound, currentRoundIndex, buildThirdPlaceMatch } from './rounds';
import { createMatch } from './match';
import type { Round } from '../types';

function decidedMatch(a: string, b: string, winner: string): ReturnType<typeof createMatch> {
  const m = createMatch(a, b);
  m.winnerId = winner;
  m.loserId = winner === a ? b : a;
  m.status = 'complete';
  return m;
}

function semifinalRounds(): Round[] {
  return [
    { index: 0, matches: [decidedMatch('A', 'B', 'A'), decidedMatch('C', 'D', 'C')] }
  ];
}

describe('isRoundComplete', () => {
  it('is true only when every match has a winner', () => {
    const r: Round = { index: 0, matches: [decidedMatch('A', 'B', 'A'), createMatch('C', 'D')] };
    expect(isRoundComplete(r)).toBe(false);
    r.matches[1].winnerId = 'C';
    expect(isRoundComplete(r)).toBe(true);
  });
});

describe('generateNextRound', () => {
  it('pairs consecutive winners of the last complete round', () => {
    const next = generateNextRound(semifinalRounds());
    expect(next).not.toBeNull();
    expect(next!.index).toBe(1);
    expect(next!.matches).toHaveLength(1);
    expect(next!.matches[0].playerAId).toBe('A');
    expect(next!.matches[0].playerBId).toBe('C');
  });
  it('returns null when the last round is the final', () => {
    const finalRound: Round[] = [{ index: 0, matches: [decidedMatch('A', 'C', 'A')] }];
    expect(generateNextRound(finalRound)).toBeNull();
  });
  it('returns null when the last round is incomplete', () => {
    const rounds: Round[] = [{ index: 0, matches: [decidedMatch('A', 'B', 'A'), createMatch('C', 'D')] }];
    expect(generateNextRound(rounds)).toBeNull();
  });
});

describe('currentRoundIndex', () => {
  it('is the last round with an undecided match', () => {
    const rounds: Round[] = [
      { index: 0, matches: [decidedMatch('A', 'B', 'A')] },
      { index: 1, matches: [createMatch('A', 'C')] }
    ];
    expect(currentRoundIndex(rounds)).toBe(1);
  });
  it('is the last round when all are decided', () => {
    const rounds: Round[] = [{ index: 0, matches: [decidedMatch('A', 'B', 'A')] }];
    expect(currentRoundIndex(rounds)).toBe(0);
  });
});

describe('buildThirdPlaceMatch', () => {
  it('pairs the two semifinal losers', () => {
    const rounds = semifinalRounds();
    const m = buildThirdPlaceMatch(rounds);
    expect(m).not.toBeNull();
    expect([m!.playerAId, m!.playerBId].sort()).toEqual(['B', 'D']);
  });
  it('returns null when there is no 2-match round', () => {
    const rounds: Round[] = [{ index: 0, matches: [decidedMatch('A', 'B', 'A')] }];
    expect(buildThirdPlaceMatch(rounds)).toBeNull();
  });
});
