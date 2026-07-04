import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { computeMatchWinner } from '$lib/tournament/match';
import type { Match, Tournament } from '$lib/types';

function applyToMatch(match: Match, games: Match['games']): Match {
  const updated: Match = { ...match, games };
  const result = computeMatchWinner(updated);
  if (result) {
    updated.winnerId = result.winnerId;
    updated.loserId = result.loserId;
    updated.status = 'complete';
  } else {
    updated.winnerId = null;
    updated.loserId = null;
    updated.status = 'in_progress';
  }
  return updated;
}

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const { games } = await request.json();
  if (!Array.isArray(games)) throw error(400, 'Résultats invalides.');

  let found = false;
  const rounds = t.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((m) => {
      if (m.id !== params.mid) return m;
      found = true;
      return applyToMatch(m, games);
    })
  }));

  let thirdPlaceMatch = t.thirdPlaceMatch;
  if (!found && t.thirdPlaceMatch && t.thirdPlaceMatch.id === params.mid) {
    found = true;
    thirdPlaceMatch = applyToMatch(t.thirdPlaceMatch, games);
  }
  if (!found) throw error(404, 'Match introuvable.');

  const next: Tournament = { ...t, rounds, thirdPlaceMatch, updatedAt: new Date().toISOString() };

  // If the final (last round, single match) is decided, crown the champion.
  const lastRound = next.rounds[next.rounds.length - 1];
  if (lastRound && lastRound.matches.length === 1 && lastRound.matches[0].winnerId) {
    next.championId = lastRound.matches[0].winnerId;
    next.status = 'complete';
  }

  await saveTournament(next);
  return json(next);
};
