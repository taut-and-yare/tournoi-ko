import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Tournament } from '$lib/types';

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/tournaments/${params.id}`);
  if (!res.ok) throw error(res.status, 'Tournoi introuvable.');
  const tournament: Tournament = await res.json();
  return { tournament };
};
