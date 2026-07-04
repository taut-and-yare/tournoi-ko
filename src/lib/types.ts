export type TournamentStatus = 'registration' | 'active' | 'complete';
export type MatchStatus = 'pending' | 'in_progress' | 'complete';
export type GameTier = 'rapid' | 'blitz' | 'armageddon';
export type GameResult = 'white' | 'black' | 'draw' | null;

export interface Game {
  tier: GameTier;
  index: number; // 1 or 2 within a tier; armageddon uses 1
  whitePlayerId: string;
  result: GameResult;
}

export interface Match {
  id: string;
  playerAId: string | null;
  playerBId: string | null;
  games: Game[];
  winnerId: string | null;
  loserId: string | null;
  status: MatchStatus;
}

export interface Round {
  index: number;
  matches: Match[];
}

export interface Player {
  id: string;
  name: string;
  elo: number;
  lichessUsername: string;
  photoUrl: string;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  organiser: string;
  firstRoundByElo: boolean;
  status: TournamentStatus;
  participantCount: number;
  players: Player[];
  rounds: Round[];
  thirdPlaceMatch?: Match;
  championId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
  participantCount: number;
  registered: number;
}
