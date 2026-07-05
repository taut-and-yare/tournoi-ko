import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { buildFirstRoundSlots } from '$lib/tournament/seeding';
import { createMatch } from '$lib/tournament/match';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');

  const canRemake =
    t.status === 'active' &&
    t.rounds.length === 1 &&
    t.rounds[0].matches.every((m) => m.games.every((g) => g.result === null));
  if (!canRemake) {
    throw error(400, 'Les appariements ne peuvent être refaits qu\'avant tout résultat.');
  }

  const slots = buildFirstRoundSlots(t.players, t.firstRoundByElo);
  const matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    matches.push(createMatch(slots[i].id, slots[i + 1].id));
  }
  const next = { ...t, rounds: [{ index: 0, matches }], updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
