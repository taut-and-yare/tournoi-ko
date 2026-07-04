import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';

const EDITABLE = ['name', 'elo', 'lichessUsername', 'photoUrl'] as const;

export const PATCH: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const body = await request.json();
  const players = t.players.map((p) => {
    if (p.id !== params.pid) return p;
    const updated = { ...p };
    for (const key of EDITABLE) if (key in body) (updated as Record<string, unknown>)[key] = body[key];
    updated.elo = Number(updated.elo) || 0;
    return updated;
  });
  const next = { ...t, players, updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
