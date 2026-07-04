import { describe, it, expect, beforeEach } from 'vitest';
import { getTournament, saveTournament, deleteTournament, listTournaments, __resetMemForTests } from './storage';
import { createTournament } from '../tournament/factory';

beforeEach(() => __resetMemForTests());

describe('storage (in-memory fallback)', () => {
  it('saves and reads a tournament', async () => {
    const t = createTournament({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 });
    await saveTournament(t);
    expect(await getTournament(t.id)).toEqual(t);
  });

  it('lists summaries reflecting registered player count', async () => {
    const t = createTournament({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 });
    await saveTournament(t);
    const list = await listTournaments();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: t.id, name: 'T', status: 'registration', participantCount: 4, registered: 0 });
  });

  it('deletes a tournament and its index entry', async () => {
    const t = createTournament({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 });
    await saveTournament(t);
    await deleteTournament(t.id);
    expect(await getTournament(t.id)).toBeNull();
    expect(await listTournaments()).toHaveLength(0);
  });
});
