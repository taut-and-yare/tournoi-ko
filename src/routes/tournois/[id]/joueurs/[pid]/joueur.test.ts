import { describe, it, expect } from 'vitest';
import { load } from './+page';

function fetchReturning(status: number, body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('player page loader', () => {
  it('propagates the tournament fetch status when the tournament is not found', async () => {
    const fetchStub = fetchReturning(404, { message: 'Tournoi introuvable.' });
    await expect(
      load({ params: { id: 'missing', pid: 'p1' }, fetch: fetchStub } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the player id is not in the tournament', async () => {
    const tournament = { id: 't1', players: [{ id: 'p1', name: 'A', elo: 1000, lichessUsername: '', photoUrl: '' }] };
    const fetchStub = fetchReturning(200, tournament);
    await expect(
      load({ params: { id: 't1', pid: 'nope' }, fetch: fetchStub } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns the tournament and matching player', async () => {
    const tournament = { id: 't1', players: [{ id: 'p1', name: 'A', elo: 1000, lichessUsername: '', photoUrl: '' }] };
    const fetchStub = fetchReturning(200, tournament);
    const result = (await load({ params: { id: 't1', pid: 'p1' }, fetch: fetchStub } as never)) as { tournament: any; player: any };
    expect(result.tournament.id).toBe('t1');
    expect(result.player.id).toBe('p1');
  });
});
