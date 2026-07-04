import type { PageLoad } from './$types';
import type { TournamentSummary } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/tournaments');
  const tournaments: TournamentSummary[] = res.ok ? await res.json() : [];
  return { tournaments };
};
