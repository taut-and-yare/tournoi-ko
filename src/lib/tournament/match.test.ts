import { describe, it, expect } from 'vitest';
import { scaffoldGames, createMatch, computeMatchWinner } from './match';
import type { Match } from '../types';

function baseMatch(): Match {
  return createMatch('A', 'B');
}

describe('scaffoldGames', () => {
  it('creates 5 games with alternating colors and armageddon white = A', () => {
    const games = scaffoldGames('A', 'B');
    expect(games).toHaveLength(5);
    expect(games.filter((g) => g.tier === 'rapid')).toHaveLength(2);
    expect(games.filter((g) => g.tier === 'blitz')).toHaveLength(2);
    expect(games.filter((g) => g.tier === 'armageddon')).toHaveLength(1);
    const rapid = games.filter((g) => g.tier === 'rapid');
    expect(rapid[0].whitePlayerId).toBe('A');
    expect(rapid[1].whitePlayerId).toBe('B');
    expect(games.find((g) => g.tier === 'armageddon')!.whitePlayerId).toBe('A');
    expect(games.every((g) => g.result === null)).toBe(true);
  });
});

describe('computeMatchWinner', () => {
  it('returns null while games are unplayed', () => {
    expect(computeMatchWinner(baseMatch())).toBeNull();
  });

  it('decides in rapid when a player wins both', () => {
    const m = baseMatch();
    for (const g of m.games.filter((g) => g.tier === 'rapid')) g.result = 'white';
    // rapid g1 white=A (A wins), g2 white=B (B... white wins => B). That is 1-1, so set g2 to black win.
    m.games.filter((g) => g.tier === 'rapid')[1].result = 'black'; // white=B, black wins => A
    expect(computeMatchWinner(m)).toEqual({ winnerId: 'A', loserId: 'B' });
  });

  it('goes to blitz when rapid is 1-1, then decides', () => {
    const m = baseMatch();
    const rapid = m.games.filter((g) => g.tier === 'rapid');
    rapid[0].result = 'white'; // A
    rapid[1].result = 'white'; // white=B => B ; 1-1
    expect(computeMatchWinner(m)).toBeNull();
    const blitz = m.games.filter((g) => g.tier === 'blitz');
    blitz[0].result = 'white'; // white=A => A
    blitz[1].result = 'black'; // white=B, black => A ; A wins 2-0
    expect(computeMatchWinner(m)).toEqual({ winnerId: 'A', loserId: 'B' });
  });

  it('armageddon draw counts as a Black win', () => {
    const m = baseMatch();
    const rapid = m.games.filter((g) => g.tier === 'rapid');
    rapid[0].result = 'white';
    rapid[1].result = 'white'; // 1-1
    const blitz = m.games.filter((g) => g.tier === 'blitz');
    blitz[0].result = 'white';
    blitz[1].result = 'white'; // 1-1
    const arma = m.games.find((g) => g.tier === 'armageddon')!;
    arma.whitePlayerId = 'A';
    arma.result = 'draw'; // black = B wins
    expect(computeMatchWinner(m)).toEqual({ winnerId: 'B', loserId: 'A' });
  });
});
