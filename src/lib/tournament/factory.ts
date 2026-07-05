import type { Player, Tournament, TournamentSummary } from '../types';
import { isPowerOfTwo, buildFirstRoundSlots } from './seeding';
import { createMatch } from './match';

export interface CreateTournamentInput {
  name: string;
  startDate: string;
  endDate: string;
  organiser: string;
  firstRoundByElo?: boolean;
  participantCount: number;
}

export function createTournament(input: CreateTournamentInput): Tournament {
  if (!input.name?.trim()) throw new Error('Le nom du tournoi est requis.');
  if (!isPowerOfTwo(input.participantCount)) {
    throw new Error('Le nombre de participants doit être une puissance de deux (2, 4, 8, 16…).');
  }
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    organiser: input.organiser,
    firstRoundByElo: !!input.firstRoundByElo,
    status: 'registration',
    participantCount: input.participantCount,
    players: [],
    rounds: [],
    createdAt: now,
    updatedAt: now
  };
}

export function isNameTaken(name: string, existing: TournamentSummary[], excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase();
  return existing.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === normalized);
}

export interface CreatePlayerInput {
  name: string;
  elo: number;
  lichessUsername: string;
  photoUrl?: string;
}

export function createPlayer(input: CreatePlayerInput): Player {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    elo: Number(input.elo) || 0,
    lichessUsername: input.lichessUsername ?? '',
    photoUrl: input.photoUrl ?? ''
  };
}

export function startTournament(t: Tournament, rng: () => number = Math.random): Tournament {
  if (t.players.length !== t.participantCount) {
    throw new Error('Ajoutez exactement le nombre de participants avant de démarrer.');
  }
  const slots = buildFirstRoundSlots(t.players, t.firstRoundByElo, rng);
  const matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    matches.push(createMatch(slots[i].id, slots[i + 1].id));
  }
  return { ...t, rounds: [{ index: 0, matches }], status: 'active', updatedAt: new Date().toISOString() };
}
