import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { startTournament } from '$lib/tournament/factory';
import { generateNextRound } from '$lib/tournament/rounds';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');

  let next;
  if (t.status === 'registration') {
    try {
      next = startTournament(t);
    } catch (e) {
      throw error(400, (e as Error).message);
    }
  } else {
    const round = generateNextRound(t.rounds);
    if (!round) throw error(400, 'Impossible de générer le tour suivant.');
    next = { ...t, rounds: [...t.rounds, round], updatedAt: new Date().toISOString() };
  }
  await saveTournament(next);
  return json(next);
};
