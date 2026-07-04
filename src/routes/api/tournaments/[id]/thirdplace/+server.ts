import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { buildThirdPlaceMatch } from '$lib/tournament/rounds';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const match = buildThirdPlaceMatch(t.rounds);
  if (!match) throw error(400, 'Les demi-finales ne sont pas terminées.');
  const next = { ...t, thirdPlaceMatch: match, updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
