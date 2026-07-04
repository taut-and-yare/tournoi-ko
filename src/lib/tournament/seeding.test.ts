import { describe, it, expect } from 'vitest';
import { isPowerOfTwo, standardSeedOrder, shuffle, buildFirstRoundSlots } from './seeding';
import type { Player } from '../types';

function player(id: string, elo: number): Player {
  return { id, name: id, elo, lichessUsername: id, photoUrl: '' };
}

describe('isPowerOfTwo', () => {
  it('accepts powers of two and rejects others', () => {
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(16)).toBe(true);
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(6)).toBe(false);
    expect(isPowerOfTwo(-4)).toBe(false);
  });
});

describe('standardSeedOrder', () => {
  it('produces the classic bracket order', () => {
    expect(standardSeedOrder(2)).toEqual([1, 2]);
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it('pairs seed i against seed n+1-i in round 0', () => {
    const order = standardSeedOrder(16);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(17);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4];
    const seq = [0.9, 0.1, 0.5];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const out = shuffle(input, rng);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4]);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});

describe('buildFirstRoundSlots', () => {
  it('by ELO pairs strongest with weakest first', () => {
    const players = [player('a', 1000), player('b', 2000), player('c', 1500), player('d', 1200)];
    const slots = buildFirstRoundSlots(players, true);
    expect(slots[0].elo).toBe(2000); // top seed
    expect(slots[1].elo).toBe(1000); // weakest
    expect(slots[2].elo).toBe(1500);
    expect(slots[3].elo).toBe(1200);
  });
  it('random mode returns all players', () => {
    const players = [player('a', 1), player('b', 2), player('c', 3), player('d', 4)];
    const slots = buildFirstRoundSlots(players, false, () => 0);
    expect(slots.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
