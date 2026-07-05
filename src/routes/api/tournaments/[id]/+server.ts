import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament, deleteTournament, listTournaments } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { isPowerOfTwo } from '$lib/tournament/seeding';
import { isNameTaken } from '$lib/tournament/factory';

const EDITABLE = ['name', 'startDate', 'endDate', 'organiser', 'firstRoundByElo', 'participantCount'] as const;

export const GET: RequestHandler = async ({ params }) => {
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  return json(t);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key];
  }
  if ('participantCount' in updates && !isPowerOfTwo(Number(updates.participantCount))) {
    throw error(400, 'Le nombre de participants doit être une puissance de deux (2, 4, 8, 16…).');
  }
  if ('name' in updates) {
    const existing = await listTournaments();
    if (isNameTaken(String(updates.name), existing, t.id)) {
      throw error(400, 'Un tournoi avec ce nom existe déjà.');
    }
  }
  const next = { ...t, ...updates, updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  await deleteTournament(params.id!);
  return json({ ok: true });
};
