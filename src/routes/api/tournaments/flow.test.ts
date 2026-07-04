import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createPOST } from './+server';
import { POST as addPlayer } from './[id]/players/+server';
import { POST as generate } from './[id]/rounds/generate/+server';
import { POST as recordGames } from './[id]/matches/[mid]/games/+server';
import { __resetMemForTests } from '$lib/server/storage';
import type { Tournament } from '$lib/types';

const H = { 'content-type': 'application/json', 'x-admin-secret': 'secret' };

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function jreq(body: unknown): Request {
  return new Request('http://x', { method: 'POST', headers: H, body: JSON.stringify(body) });
}

async function createFour(): Promise<Tournament> {
  const res = await createPOST({ request: jreq({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4, firstRoundByElo: true }) } as never);
  return res.json();
}

// Fill a match: give the round-0 game a decisive 2-0 rapid so playerA wins.
function decisiveGames(playerAId: string) {
  return [
    { tier: 'rapid', index: 1, whitePlayerId: playerAId, result: 'white' }, // A white wins
    { tier: 'rapid', index: 2, whitePlayerId: playerAId, result: 'white' } // A white wins again => A 2-0
  ];
}

describe('tournament flow', () => {
  it('registers, starts, and progresses to a champion', async () => {
    const t = await createFour();
    let current = t;
    for (const elo of [2000, 1000, 1500, 1200]) {
      const res = await addPlayer({ params: { id: t.id }, request: jreq({ name: `p${elo}`, elo, lichessUsername: `p${elo}` }) } as never);
      current = await res.json();
    }
    expect(current.players).toHaveLength(4);

    // Start (registration -> active, builds round 0)
    let started = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();
    expect(started.status).toBe('active');
    expect(started.rounds[0].matches).toHaveLength(2);

    // Decide both semifinals: playerA of each wins 2-0
    for (const m of started.rounds[0].matches) {
      started = await (await recordGames({ params: { id: t.id, mid: m.id }, request: jreq({ games: decisiveGames(m.playerAId) }) } as never)).json();
    }
    expect(started.rounds[0].matches.every((m: any) => m.winnerId)).toBe(true);

    // Generate the final
    let withFinal = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();
    expect(withFinal.rounds).toHaveLength(2);
    const final = withFinal.rounds[1].matches[0];

    // Decide the final
    const done = await (await recordGames({ params: { id: t.id, mid: final.id }, request: jreq({ games: decisiveGames(final.playerAId) }) } as never)).json();
    expect(done.status).toBe('complete');
    expect(done.championId).toBe(final.playerAId);
  });
});
