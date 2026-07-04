import { admin } from './admin.svelte';
import type { CreateTournamentInput, CreatePlayerInput } from '$lib/tournament/factory';
import type { Game, Player, Tournament, TournamentSummary } from '$lib/types';

async function req<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  for (const [k, v] of Object.entries(admin.headers())) headers.set(k, v);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let message = 'Erreur serveur.';
    try {
      const body = await res.json();
      message = body?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  list: () => req<TournamentSummary[]>('/api/tournaments'),
  get: (id: string) => req<Tournament>(`/api/tournaments/${id}`),
  create: (input: CreateTournamentInput) =>
    req<Tournament>('/api/tournaments', { method: 'POST', body: JSON.stringify(input) }),
  patch: (id: string, patch: Partial<Tournament>) =>
    req<Tournament>(`/api/tournaments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => req<{ ok: boolean }>(`/api/tournaments/${id}`, { method: 'DELETE' }),
  addPlayer: (id: string, input: CreatePlayerInput) =>
    req<Tournament>(`/api/tournaments/${id}/players`, { method: 'POST', body: JSON.stringify(input) }),
  patchPlayer: (id: string, pid: string, patch: Partial<Player>) =>
    req<Tournament>(`/api/tournaments/${id}/players/${pid}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  uploadPhoto: (id: string, pid: string, file: File) => {
    const form = new FormData();
    form.set('photo', file);
    return req<Player>(`/api/tournaments/${id}/players/${pid}/photo`, { method: 'POST', body: form });
  },
  generate: (id: string) => req<Tournament>(`/api/tournaments/${id}/rounds/generate`, { method: 'POST', body: '{}' }),
  recordGames: (id: string, mid: string, games: Game[]) =>
    req<Tournament>(`/api/tournaments/${id}/matches/${mid}/games`, { method: 'POST', body: JSON.stringify({ games }) }),
  createThirdPlace: (id: string) =>
    req<Tournament>(`/api/tournaments/${id}/thirdplace`, { method: 'POST', body: '{}' })
};
