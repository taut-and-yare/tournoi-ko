import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Tournament } from '$lib/types';
import { t } from '$lib/i18n/fr';

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/tournaments/${params.id}`);
  if (!res.ok) throw error(res.status, t.notFound);
  const tournament: Tournament = await res.json();
  const player = tournament.players.find((p) => p.id === params.pid);
  if (!player) throw error(404, t.notFound);
  return { tournament, player };
};
