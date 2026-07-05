import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createTournament } from '../../../+server';
import { POST as addPlayer } from '../../players/+server';
import { POST as generate } from '../generate/+server';
import { POST as recordGames } from '../../matches/[mid]/games/+server';
import { POST as remake } from './+server';
import { __resetMemForTests } from '$lib/server/storage';

const H = { 'content-type': 'application/json', 'x-admin-secret': 'secret' };

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function jreq(body: unknown): Request {
  return new Request('http://x', { method: 'POST', headers: H, body: JSON.stringify(body) });
}

async function createFour() {
  const res = await createTournament({
    request: jreq({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4, firstRoundByElo: true })
  } as never);
  return res.json();
}

describe('POST /api/tournaments/:id/rounds/remake', () => {
  it('rebuilds round 0 over the same players when no result has been recorded yet', async () => {
    const t = await createFour();
    for (const elo of [2000, 1000, 1500, 1200]) {
      await addPlayer({ params: { id: t.id }, request: jreq({ name: `p${elo}`, elo, lichessUsername: `p${elo}` }) } as never);
    }
    const started = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();

    const remade = await (await remake({ params: { id: t.id }, request: jreq({}) } as never)).json();

    expect(remade.rounds).toHaveLength(1);
    expect(remade.rounds[0].matches).toHaveLength(2);
    expect(remade.rounds[0].matches.every((m: any) => m.winnerId === null)).toBe(true);
    const allPlayerIds = remade.rounds[0].matches.flatMap((m: any) => [m.playerAId, m.playerBId]).sort();
    expect(allPlayerIds).toEqual(started.players.map((p: any) => p.id).sort());
  });

  it('rejects remaking once a game result has been recorded', async () => {
    const t = await createFour();
    for (const elo of [2000, 1000, 1500, 1200]) {
      await addPlayer({ params: { id: t.id }, request: jreq({ name: `p${elo}`, elo, lichessUsername: `p${elo}` }) } as never);
    }
    const started = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();
    const m = started.rounds[0].matches[0];
    await recordGames({
      params: { id: t.id, mid: m.id },
      request: jreq({ games: [{ tier: 'rapid', index: 1, whitePlayerId: m.playerAId, result: 'white' }] })
    } as never);

    await expect(
      remake({ params: { id: t.id }, request: jreq({}) } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('404s for an unknown tournament', async () => {
    await expect(
      remake({ params: { id: 'nope' }, request: jreq({}) } as never)
    ).rejects.toMatchObject({ status: 404 });
  });
});
