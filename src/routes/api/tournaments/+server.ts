import { json, error, type RequestHandler } from '@sveltejs/kit';
import { listTournaments, saveTournament } from '$lib/server/storage';
import { isAdmin, requireAdmin } from '$lib/server/auth';
import { createTournament, isNameTaken } from '$lib/tournament/factory';

export const GET: RequestHandler = async ({ request }) => {
  const all = await listTournaments();
  const visible = isAdmin(request) ? all : all.filter((s) => s.status !== 'registration');
  return json(visible);
};

export const POST: RequestHandler = async ({ request }) => {
  requireAdmin(request);
  const body = await request.json();
  const existing = await listTournaments();
  if (isNameTaken(body?.name ?? '', existing)) {
    throw error(400, 'Un tournoi avec ce nom existe déjà.');
  }
  let t;
  try {
    t = createTournament(body);
  } catch (e) {
    throw error(400, (e as Error).message);
  }
  await saveTournament(t);
  return json(t, { status: 201 });
};
