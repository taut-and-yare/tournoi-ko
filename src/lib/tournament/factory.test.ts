import { describe, it, expect } from 'vitest';
import { createTournament, createPlayer, startTournament } from './factory';

function baseInput() {
  return {
    name: 'Open',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    organiser: 'Alice',
    firstRoundByElo: true,
    participantCount: 4
  };
}

describe('createTournament', () => {
  it('creates a registration-status tournament', () => {
    const t = createTournament(baseInput());
    expect(t.status).toBe('registration');
    expect(t.participantCount).toBe(4);
    expect(t.players).toEqual([]);
    expect(t.id).toBeTruthy();
  });
  it('rejects a non-power-of-two participant count', () => {
    expect(() => createTournament({ ...baseInput(), participantCount: 6 })).toThrow();
  });
});

describe('startTournament', () => {
  it('builds round 0 with participantCount/2 matches', () => {
    let t = createTournament(baseInput());
    t = {
      ...t,
      players: [
        createPlayer({ name: 'p1', elo: 1000, lichessUsername: 'p1' }),
        createPlayer({ name: 'p2', elo: 2000, lichessUsername: 'p2' }),
        createPlayer({ name: 'p3', elo: 1500, lichessUsername: 'p3' }),
        createPlayer({ name: 'p4', elo: 1200, lichessUsername: 'p4' })
      ]
    };
    const started = startTournament(t, () => 0);
    expect(started.status).toBe('active');
    expect(started.rounds).toHaveLength(1);
    expect(started.rounds[0].matches).toHaveLength(2);
  });
  it('throws when player count does not match participantCount', () => {
    const t = createTournament(baseInput());
    expect(() => startTournament(t)).toThrow();
  });
});
