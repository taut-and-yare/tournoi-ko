import { describe, it, expect } from 'vitest';
import { roundName } from './fr';

describe('roundName', () => {
  it('names rounds by number of players remaining', () => {
    expect(roundName(2)).toBe('Finale');
    expect(roundName(4)).toBe('Demi-finales');
    expect(roundName(8)).toBe('Quarts de finale');
    expect(roundName(16)).toBe('8es de finale');
    expect(roundName(32)).toBe('16es de finale');
  });
});
