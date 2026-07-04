import type { Game, GameTier, Match } from '../types';

export function scaffoldGames(aId: string, bId: string): Game[] {
  return [
    { tier: 'rapid', index: 1, whitePlayerId: aId, result: null },
    { tier: 'rapid', index: 2, whitePlayerId: bId, result: null },
    { tier: 'blitz', index: 1, whitePlayerId: aId, result: null },
    { tier: 'blitz', index: 2, whitePlayerId: bId, result: null },
    { tier: 'armageddon', index: 1, whitePlayerId: aId, result: null }
  ];
}

export function createMatch(aId: string, bId: string): Match {
  return {
    id: crypto.randomUUID(),
    playerAId: aId,
    playerBId: bId,
    games: scaffoldGames(aId, bId),
    winnerId: null,
    loserId: null,
    status: 'pending'
  };
}

type TierOutcome = 'A' | 'B' | 'tie' | 'incomplete';

function resolveTier(match: Match, tier: GameTier): TierOutcome {
  const { playerAId: a } = match;
  const games = match.games.filter((g) => g.tier === tier);
  const expected = tier === 'armageddon' ? 1 : 2;
  if (games.length < expected || games.some((g) => g.result === null)) return 'incomplete';

  if (tier === 'armageddon') {
    const g = games[0];
    const whiteIsA = g.whitePlayerId === a;
    let winnerIsA: boolean;
    if (g.result === 'draw') winnerIsA = !whiteIsA; // draw => Black wins
    else if (g.result === 'white') winnerIsA = whiteIsA;
    else winnerIsA = !whiteIsA;
    return winnerIsA ? 'A' : 'B';
  }

  let scoreA = 0;
  let scoreB = 0;
  for (const g of games) {
    const whiteIsA = g.whitePlayerId === a;
    if (g.result === 'draw') {
      scoreA += 0.5;
      scoreB += 0.5;
    } else {
      const whiteWon = g.result === 'white';
      const winnerIsA = whiteWon === whiteIsA;
      if (winnerIsA) scoreA += 1;
      else scoreB += 1;
    }
  }
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'tie';
}

export function computeMatchWinner(match: Match): { winnerId: string; loserId: string } | null {
  const { playerAId: a, playerBId: b } = match;
  if (!a || !b) return null;
  const tiers: GameTier[] = ['rapid', 'blitz', 'armageddon'];
  for (const tier of tiers) {
    const outcome = resolveTier(match, tier);
    if (outcome === 'incomplete') return null;
    if (outcome === 'A') return { winnerId: a, loserId: b };
    if (outcome === 'B') return { winnerId: b, loserId: a };
    // 'tie' → fall through to the next tier
  }
  return null;
}
