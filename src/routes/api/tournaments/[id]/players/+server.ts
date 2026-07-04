import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { createPlayer } from '$lib/tournament/factory';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  if (t.status !== 'registration') throw error(400, 'Les inscriptions sont closes.');
  if (t.players.length >= t.participantCount) throw error(400, 'Le tournoi est complet.');
  const body = await request.json();
  const player = createPlayer(body);
  const next = { ...t, players: [...t.players, player], updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
