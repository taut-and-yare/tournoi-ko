import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createTournament } from '../../../+server';
import { POST as addPlayer } from '../+server';
import { PATCH as patchPlayer } from './+server';
import { __resetMemForTests } from '$lib/server/storage';

const H = { 'content-type': 'application/json', 'x-admin-secret': 'secret' };

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function jreq(body: unknown): Request {
  return new Request('http://x', { method: 'POST', headers: H, body: JSON.stringify(body) });
}

describe('PATCH /api/tournaments/:id/players/:pid', () => {
  it('returns 404 when the player id does not exist', async () => {
    const created = await (
      await createTournament({
        request: jreq({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 })
      } as never)
    ).json();
    await addPlayer({ params: { id: created.id }, request: jreq({ name: 'p1', elo: 1000, lichessUsername: 'p1' }) } as never);

    const patchReq = new Request('http://x', {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ name: 'Renamed' })
    });
    await expect(
      patchPlayer({ params: { id: created.id, pid: 'nonexistent-id' }, request: patchReq } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updates the matching player when pid exists', async () => {
    const created = await (
      await createTournament({
        request: jreq({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 })
      } as never)
    ).json();
    const withPlayer = await (
      await addPlayer({ params: { id: created.id }, request: jreq({ name: 'p1', elo: 1000, lichessUsername: 'p1' }) } as never)
    ).json();
    const pid = withPlayer.players[0].id;

    const patchReq = new Request('http://x', {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ name: 'Renamed' })
    });
    const result = await (await patchPlayer({ params: { id: created.id, pid }, request: patchReq } as never)).json();
    expect(result.players[0].name).toBe('Renamed');
  });
});
