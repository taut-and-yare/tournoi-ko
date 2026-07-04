import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { savePlayerPhoto } from '$lib/server/photos';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const player = t.players.find((p) => p.id === params.pid);
  if (!player) throw error(404, 'Joueur introuvable.');
  const form = await request.formData();
  const file = form.get('photo');
  if (!(file instanceof File)) throw error(400, 'Photo manquante.');
  const url = await savePlayerPhoto(t.id, player.id, file);
  const players = t.players.map((p) => (p.id === player.id ? { ...p, photoUrl: url } : p));
  const updated = players.find((p) => p.id === player.id)!;
  await saveTournament({ ...t, players, updatedAt: new Date().toISOString() });
  return json(updated);
};
