# Tournoi-KO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, French-language website that creates and visualizes single-elimination chess tournaments, deployable to Vercel with KV + Blob persistence.

**Architecture:** SvelteKit app. Pure domain logic (seeding, match resolution, round generation) lives in `src/lib/tournament/` and is unit-tested. A server storage layer (`src/lib/server/`) persists each tournament as one JSON document in Vercel KV (with an in-memory fallback for local dev/tests) and photos in Vercel Blob (with a local-file fallback). Tournament-scoped API routes wrap the logic and storage; integration tests exercise them through the fallback. Svelte pages render a home → list → bracket flow, gated by an admin passphrase.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind CSS v4, `@vercel/kv`, `@vercel/blob`, Vitest, `@sveltejs/adapter-vercel`.

## Global Constraints

- **TDD scope:** pure logic (`src/lib/tournament/**`) and API routes (`src/routes/api/**`) are developed test-first with Vitest. Svelte UI is verified via manual dev-server steps.
- **Language:** all user-facing text is French, sourced from `src/lib/i18n/fr.ts`. Code identifiers and comments are English.
- **Bracket size:** `participantCount` must be a power of two (2/4/8/16…); validated at tournament creation.
- **No re-pairing:** the bracket is a fixed tree; only round-0 placement varies (ELO-seeded or random).
- **Armageddon rule:** a draw counts as a **Black win**.
- **Auth:** all write API routes require header `x-admin-secret` equal to env `ADMIN_SECRET`. Reads are public; the tournaments list hides `registration`-status tournaments from non-admins.
- **Responsive, mobile-first:** no horizontal page overflow; the bracket shows one round column on narrow screens and the full tree on wide screens, opened on the current round.
- **Node:** target Node 20+ (uses global `crypto.randomUUID`).

---

## File Structure

**Domain logic (unit-tested):**
- `src/lib/types.ts` — shared TypeScript interfaces.
- `src/lib/tournament/seeding.ts` — `isPowerOfTwo`, `standardSeedOrder`, `shuffle`, `buildFirstRoundSlots`.
- `src/lib/tournament/match.ts` — `createMatch`, `scaffoldGames`, `computeMatchWinner`.
- `src/lib/tournament/rounds.ts` — `isRoundComplete`, `generateNextRound`, `currentRoundIndex`, `buildThirdPlaceMatch`.
- `src/lib/tournament/factory.ts` — `createTournament`, `createPlayer`, `startTournament`.

**Server layer (integration-tested via handlers):**
- `src/lib/server/storage.ts` — KV/in-memory persistence + summary index.
- `src/lib/server/photos.ts` — Blob/local photo storage.
- `src/lib/server/auth.ts` — admin secret checks.
- `src/routes/api/tournaments/+server.ts` — list + create.
- `src/routes/api/tournaments/[id]/+server.ts` — read/update/delete.
- `src/routes/api/tournaments/[id]/players/+server.ts` — add player.
- `src/routes/api/tournaments/[id]/players/[pid]/+server.ts` — update player.
- `src/routes/api/tournaments/[id]/players/[pid]/photo/+server.ts` — upload photo.
- `src/routes/api/tournaments/[id]/rounds/generate/+server.ts` — start / advance round.
- `src/routes/api/tournaments/[id]/matches/[mid]/games/+server.ts` — record results.
- `src/routes/api/tournaments/[id]/thirdplace/+server.ts` — create 3rd-place match.

**Client + UI (manual verification):**
- `src/lib/i18n/fr.ts` — French strings + `roundName`.
- `src/lib/client/admin.svelte.ts` — admin unlock store (localStorage).
- `src/lib/client/api.ts` — typed fetch wrappers.
- `src/lib/components/*` — `UnlockButton`, `TournamentCard`, `CreateTournamentForm`, `PlayerBadge`, `MatchCard`, `RoundColumn`, `BracketView`, `PlayerRegistration`, `ResultEntry`.
- `src/routes/+layout.svelte`, `src/routes/+page.svelte` — home.
- `src/routes/tournois/+page.ts`, `+page.svelte` — list.
- `src/routes/tournois/[id]/+page.ts`, `+page.svelte` — bracket view + admin panels.

**Config:** `package.json`, `svelte.config.js`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `src/app.css`, `src/app.html`, `.env.example`, `.gitignore`, `README.md`.

---

## Task 1: Project scaffold, Tailwind, home page

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example`, `src/app.html`, `src/app.css`, `src/app.d.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`.

**Interfaces:**
- Produces: a runnable SvelteKit dev server; Tailwind available globally; `npm test` wired to Vitest.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tournoi-ko",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "sync": "svelte-kit sync",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@sveltejs/adapter-vercel": "^5.4.0",
    "@sveltejs/kit": "^2.8.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "svelte": "^5.1.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "@vercel/blob": "^0.27.0",
    "@vercel/kv": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create config files**

`svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};
```

`vite.config.ts`:
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
```

`vitest.config.ts` (separate from Vite so tests don't load the SvelteKit plugin):
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { $lib: path.resolve('./src/lib') } }
});
```

`tsconfig.json`:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

`.gitignore`:
```
node_modules
/.svelte-kit
/build
/.vercel
.env
.env.*
!.env.example
/static/uploads
```

`.env.example`:
```
ADMIN_SECRET=change-me
# Set by Vercel KV (Upstash) integration in production:
KV_REST_API_URL=
KV_REST_API_TOKEN=
# Set by Vercel Blob integration in production:
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 3: Create app shell files**

`src/app.html`:
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

`src/app.css`:
```css
@import 'tailwindcss';
```

`src/app.d.ts`:
```ts
declare global {
  namespace App {}
}
export {};
```

`src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
  {@render children()}
</div>
```

`src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import { t } from '$lib/i18n/fr';
</script>

<main class="mx-auto max-w-xl px-4 py-16 text-center">
  <h1 class="text-3xl font-bold sm:text-4xl">{t.appTitle}</h1>
  <p class="mt-4 text-slate-600">{t.homeIntro}</p>
  <a
    href="/tournois"
    class="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
  >
    {t.seeTournaments}
  </a>
</main>
```

Note: `src/lib/i18n/fr.ts` is created in Task 2; the dev server will error on this import until then. That is expected and resolved by Task 2.

- [ ] **Step 4: Install dependencies and sync**

Run: `npm install && npm run sync`
Expected: installs without error; `.svelte-kit/` generated.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit + Tailwind + Vitest, add home page"
```

---

## Task 2: Domain types and French i18n

**Files:**
- Create: `src/lib/types.ts`, `src/lib/i18n/fr.ts`, `src/lib/i18n/fr.test.ts`

**Interfaces:**
- Produces: all shared types; `t` (string table) and `roundName(playersInRound: number): string`, `PETITE_FINALE: string`.

- [ ] **Step 1: Write the failing test**

`src/lib/i18n/fr.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { roundName } from './fr';

describe('roundName', () => {
  it('names rounds by number of players remaining', () => {
    expect(roundName(2)).toBe('Finale');
    expect(roundName(4)).toBe('Demi-finales');
    expect(roundName(8)).toBe('Quarts de finale');
    expect(roundName(16)).toBe('8es de finale');
    expect(roundName(32)).toBe('16es de finale');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fr`
Expected: FAIL — cannot resolve `./fr` / `roundName` not defined.

- [ ] **Step 3: Create the types**

`src/lib/types.ts`:
```ts
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
```

- [ ] **Step 4: Create the i18n module**

`src/lib/i18n/fr.ts`:
```ts
export const PETITE_FINALE = 'Petite finale';

export function roundName(playersInRound: number): string {
  switch (playersInRound) {
    case 2: return 'Finale';
    case 4: return 'Demi-finales';
    case 8: return 'Quarts de finale';
    case 16: return '8es de finale';
    case 32: return '16es de finale';
    default: return `Tour à ${playersInRound} joueurs`;
  }
}

export const t = {
  appTitle: 'Tournoi KO',
  homeIntro: 'Créez et suivez vos tournois d’échecs à élimination directe.',
  seeTournaments: 'Voir les tournois',
  tournamentsTitle: 'Tournois',
  addTournament: 'Ajouter un tournoi',
  noTournaments: 'Aucun tournoi pour le moment.',
  unlock: 'Déverrouiller',
  lock: 'Verrouiller',
  adminPrompt: 'Mot de passe organisateur',
  create: 'Créer',
  cancel: 'Annuler',
  save: 'Enregistrer',
  delete: 'Supprimer',
  edit: 'Modifier',
  name: 'Nom',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  organiser: 'Organisateur',
  firstRoundByElo: 'Premier tour par ELO (fort contre faible)',
  participantCount: 'Nombre de participants',
  mustBePowerOfTwo: 'Le nombre de participants doit être une puissance de deux (2, 4, 8, 16…).',
  players: 'Joueurs',
  addPlayer: 'Ajouter un joueur',
  elo: 'ELO',
  lichess: 'Pseudo Lichess',
  photo: 'Photo',
  startTournament: 'Démarrer le tournoi',
  needExactPlayers: 'Ajoutez exactement le nombre de participants avant de démarrer.',
  registration: 'Inscriptions',
  active: 'En cours',
  complete: 'Terminé',
  currentRound: 'Tour actuel',
  previousRound: 'Tour précédent',
  nextRound: 'Tour suivant',
  advanceRound: 'Générer le tour suivant',
  recordResults: 'Saisir les résultats',
  white: 'Blancs',
  rapid: 'Cadence 10 min',
  blitz: 'Cadence 3 min + 2 s',
  armageddon: 'Armageddon',
  winner: 'Vainqueur',
  champion: 'Champion',
  thirdPlace: 'Créer la petite finale',
  petiteFinale: PETITE_FINALE,
  loading: 'Chargement…',
  notFound: 'Tournoi introuvable.',
  unauthorized: 'Non autorisé.',
  resultWhiteWin: 'Victoire des Blancs',
  resultBlackWin: 'Victoire des Noirs',
  resultDraw: 'Nulle'
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- fr`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/i18n
git commit -m "feat: add domain types and French i18n strings"
```

---

## Task 3: Seeding logic

**Files:**
- Create: `src/lib/tournament/seeding.ts`, `src/lib/tournament/seeding.test.ts`

**Interfaces:**
- Consumes: `Player` from `src/lib/types.ts`.
- Produces:
  - `isPowerOfTwo(n: number): boolean`
  - `standardSeedOrder(n: number): number[]` — bracket slot order of seed numbers (1 = top seed).
  - `shuffle<T>(arr: T[], rng?: () => number): T[]` — returns a new shuffled array.
  - `buildFirstRoundSlots(players: Player[], byElo: boolean, rng?: () => number): Player[]` — players ordered into bracket slots; consecutive pairs `(0,1),(2,3),…` are round-0 matchups.

- [ ] **Step 1: Write the failing test**

`src/lib/tournament/seeding.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isPowerOfTwo, standardSeedOrder, shuffle, buildFirstRoundSlots } from './seeding';
import type { Player } from '../types';

function player(id: string, elo: number): Player {
  return { id, name: id, elo, lichessUsername: id, photoUrl: '' };
}

describe('isPowerOfTwo', () => {
  it('accepts powers of two and rejects others', () => {
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(16)).toBe(true);
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(6)).toBe(false);
    expect(isPowerOfTwo(-4)).toBe(false);
  });
});

describe('standardSeedOrder', () => {
  it('produces the classic bracket order', () => {
    expect(standardSeedOrder(2)).toEqual([1, 2]);
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it('pairs seed i against seed n+1-i in round 0', () => {
    const order = standardSeedOrder(16);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(17);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4];
    const seq = [0.9, 0.1, 0.5];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const out = shuffle(input, rng);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4]);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});

describe('buildFirstRoundSlots', () => {
  it('by ELO pairs strongest with weakest first', () => {
    const players = [player('a', 1000), player('b', 2000), player('c', 1500), player('d', 1200)];
    const slots = buildFirstRoundSlots(players, true);
    expect(slots[0].elo).toBe(2000); // top seed
    expect(slots[1].elo).toBe(1000); // weakest
    expect(slots[2].elo).toBe(1500);
    expect(slots[3].elo).toBe(1200);
  });
  it('random mode returns all players', () => {
    const players = [player('a', 1), player('b', 2), player('c', 3), player('d', 4)];
    const slots = buildFirstRoundSlots(players, false, () => 0);
    expect(slots.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- seeding`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/tournament/seeding.ts`:
```ts
import type { Player } from '../types';

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
}

export function standardSeedOrder(n: number): number[] {
  if (!isPowerOfTwo(n)) throw new Error(`Bracket size must be a power of two, got ${n}`);
  let seeds = [1];
  while (seeds.length < n) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildFirstRoundSlots(
  players: Player[],
  byElo: boolean,
  rng: () => number = Math.random
): Player[] {
  if (!byElo) return shuffle(players, rng);
  const sorted = [...players].sort((a, b) => b.elo - a.elo); // seed 1 = highest ELO
  const order = standardSeedOrder(players.length);
  return order.map((seed) => sorted[seed - 1]);
}
```

Note: `standardSeedOrder` starts from `[1]` and doubles each pass. Pass 1: sum=3 → `[1,2]`. Pass 2: sum=5 → `[1,4,2,3]`. Pass 3: sum=9 → `[1,8,4,5,2,7,3,6]`. Matches the spec's n=8 example.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- seeding`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tournament/seeding.ts src/lib/tournament/seeding.test.ts
git commit -m "feat: add bracket seeding and shuffle logic"
```

---

## Task 4: Match creation and winner resolution

**Files:**
- Create: `src/lib/tournament/match.ts`, `src/lib/tournament/match.test.ts`

**Interfaces:**
- Consumes: `Game`, `Match` from `src/lib/types.ts`.
- Produces:
  - `scaffoldGames(aId: string, bId: string): Game[]` — 5 games: rapid×2, blitz×2, armageddon×1 with default White assignments (rapid/blitz alternate A then B; armageddon White = A), all `result: null`.
  - `createMatch(aId: string, bId: string): Match` — new pending match with scaffolded games and a `crypto.randomUUID()` id.
  - `computeMatchWinner(match: Match): { winnerId: string; loserId: string } | null` — resolves the tiered format; `null` until decided.

- [ ] **Step 1: Write the failing test**

`src/lib/tournament/match.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scaffoldGames, createMatch, computeMatchWinner } from './match';
import type { Match } from '../types';

function baseMatch(): Match {
  return createMatch('A', 'B');
}

describe('scaffoldGames', () => {
  it('creates 5 games with alternating colors and armageddon white = A', () => {
    const games = scaffoldGames('A', 'B');
    expect(games).toHaveLength(5);
    expect(games.filter((g) => g.tier === 'rapid')).toHaveLength(2);
    expect(games.filter((g) => g.tier === 'blitz')).toHaveLength(2);
    expect(games.filter((g) => g.tier === 'armageddon')).toHaveLength(1);
    const rapid = games.filter((g) => g.tier === 'rapid');
    expect(rapid[0].whitePlayerId).toBe('A');
    expect(rapid[1].whitePlayerId).toBe('B');
    expect(games.find((g) => g.tier === 'armageddon')!.whitePlayerId).toBe('A');
    expect(games.every((g) => g.result === null)).toBe(true);
  });
});

describe('computeMatchWinner', () => {
  it('returns null while games are unplayed', () => {
    expect(computeMatchWinner(baseMatch())).toBeNull();
  });

  it('decides in rapid when a player wins both', () => {
    const m = baseMatch();
    for (const g of m.games.filter((g) => g.tier === 'rapid')) g.result = 'white';
    // rapid g1 white=A (A wins), g2 white=B (B... white wins => B). That is 1-1, so set g2 to black win.
    m.games.filter((g) => g.tier === 'rapid')[1].result = 'black'; // white=B, black wins => A
    expect(computeMatchWinner(m)).toEqual({ winnerId: 'A', loserId: 'B' });
  });

  it('goes to blitz when rapid is 1-1, then decides', () => {
    const m = baseMatch();
    const rapid = m.games.filter((g) => g.tier === 'rapid');
    rapid[0].result = 'white'; // A
    rapid[1].result = 'white'; // white=B => B ; 1-1
    expect(computeMatchWinner(m)).toBeNull();
    const blitz = m.games.filter((g) => g.tier === 'blitz');
    blitz[0].result = 'white'; // white=A => A
    blitz[1].result = 'black'; // white=B, black => A ; A wins 2-0
    expect(computeMatchWinner(m)).toEqual({ winnerId: 'A', loserId: 'B' });
  });

  it('armageddon draw counts as a Black win', () => {
    const m = baseMatch();
    const rapid = m.games.filter((g) => g.tier === 'rapid');
    rapid[0].result = 'white';
    rapid[1].result = 'white'; // 1-1
    const blitz = m.games.filter((g) => g.tier === 'blitz');
    blitz[0].result = 'white';
    blitz[1].result = 'white'; // 1-1
    const arma = m.games.find((g) => g.tier === 'armageddon')!;
    arma.whitePlayerId = 'A';
    arma.result = 'draw'; // black = B wins
    expect(computeMatchWinner(m)).toEqual({ winnerId: 'B', loserId: 'A' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- match`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/tournament/match.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- match`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tournament/match.ts src/lib/tournament/match.test.ts
git commit -m "feat: add match scaffolding and tiered winner resolution"
```

---

## Task 5: Round progression and tournament factory

**Files:**
- Create: `src/lib/tournament/rounds.ts`, `src/lib/tournament/rounds.test.ts`, `src/lib/tournament/factory.ts`, `src/lib/tournament/factory.test.ts`

**Interfaces:**
- Consumes: `createMatch` (Task 4), `buildFirstRoundSlots` (Task 3), types.
- Produces (rounds.ts):
  - `isRoundComplete(round: Round): boolean`
  - `generateNextRound(rounds: Round[]): Round | null`
  - `currentRoundIndex(rounds: Round[]): number`
  - `buildThirdPlaceMatch(rounds: Round[]): Match | null`
- Produces (factory.ts):
  - `createTournament(input): Tournament` — validates power-of-two `participantCount`; throws `Error` otherwise.
  - `createPlayer(input): Player`
  - `startTournament(t: Tournament, rng?: () => number): Tournament` — builds round 0; throws if `players.length !== participantCount`.

- [ ] **Step 1: Write the failing tests**

`src/lib/tournament/rounds.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isRoundComplete, generateNextRound, currentRoundIndex, buildThirdPlaceMatch } from './rounds';
import { createMatch } from './match';
import type { Round } from '../types';

function decidedMatch(a: string, b: string, winner: string): ReturnType<typeof createMatch> {
  const m = createMatch(a, b);
  m.winnerId = winner;
  m.loserId = winner === a ? b : a;
  m.status = 'complete';
  return m;
}

function semifinalRounds(): Round[] {
  return [
    { index: 0, matches: [decidedMatch('A', 'B', 'A'), decidedMatch('C', 'D', 'C')] }
  ];
}

describe('isRoundComplete', () => {
  it('is true only when every match has a winner', () => {
    const r: Round = { index: 0, matches: [decidedMatch('A', 'B', 'A'), createMatch('C', 'D')] };
    expect(isRoundComplete(r)).toBe(false);
    r.matches[1].winnerId = 'C';
    expect(isRoundComplete(r)).toBe(true);
  });
});

describe('generateNextRound', () => {
  it('pairs consecutive winners of the last complete round', () => {
    const next = generateNextRound(semifinalRounds());
    expect(next).not.toBeNull();
    expect(next!.index).toBe(1);
    expect(next!.matches).toHaveLength(1);
    expect(next!.matches[0].playerAId).toBe('A');
    expect(next!.matches[0].playerBId).toBe('C');
  });
  it('returns null when the last round is the final', () => {
    const finalRound: Round[] = [{ index: 0, matches: [decidedMatch('A', 'C', 'A')] }];
    expect(generateNextRound(finalRound)).toBeNull();
  });
  it('returns null when the last round is incomplete', () => {
    const rounds: Round[] = [{ index: 0, matches: [decidedMatch('A', 'B', 'A'), createMatch('C', 'D')] }];
    expect(generateNextRound(rounds)).toBeNull();
  });
});

describe('currentRoundIndex', () => {
  it('is the last round with an undecided match', () => {
    const rounds: Round[] = [
      { index: 0, matches: [decidedMatch('A', 'B', 'A')] },
      { index: 1, matches: [createMatch('A', 'C')] }
    ];
    expect(currentRoundIndex(rounds)).toBe(1);
  });
  it('is the last round when all are decided', () => {
    const rounds: Round[] = [{ index: 0, matches: [decidedMatch('A', 'B', 'A')] }];
    expect(currentRoundIndex(rounds)).toBe(0);
  });
});

describe('buildThirdPlaceMatch', () => {
  it('pairs the two semifinal losers', () => {
    const rounds = semifinalRounds();
    const m = buildThirdPlaceMatch(rounds);
    expect(m).not.toBeNull();
    expect([m!.playerAId, m!.playerBId].sort()).toEqual(['B', 'D']);
  });
  it('returns null when there is no 2-match round', () => {
    const rounds: Round[] = [{ index: 0, matches: [decidedMatch('A', 'B', 'A')] }];
    expect(buildThirdPlaceMatch(rounds)).toBeNull();
  });
});
```

`src/lib/tournament/factory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createTournament, createPlayer, startTournament } from './factory';

function baseInput() {
  return {
    name: 'Open',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    organiser: 'Alice',
    firstRoundByElo: true,
    participantCount: 4
  };
}

describe('createTournament', () => {
  it('creates a registration-status tournament', () => {
    const t = createTournament(baseInput());
    expect(t.status).toBe('registration');
    expect(t.participantCount).toBe(4);
    expect(t.players).toEqual([]);
    expect(t.id).toBeTruthy();
  });
  it('rejects a non-power-of-two participant count', () => {
    expect(() => createTournament({ ...baseInput(), participantCount: 6 })).toThrow();
  });
});

describe('startTournament', () => {
  it('builds round 0 with participantCount/2 matches', () => {
    let t = createTournament(baseInput());
    t = {
      ...t,
      players: [
        createPlayer({ name: 'p1', elo: 1000, lichessUsername: 'p1' }),
        createPlayer({ name: 'p2', elo: 2000, lichessUsername: 'p2' }),
        createPlayer({ name: 'p3', elo: 1500, lichessUsername: 'p3' }),
        createPlayer({ name: 'p4', elo: 1200, lichessUsername: 'p4' })
      ]
    };
    const started = startTournament(t, () => 0);
    expect(started.status).toBe('active');
    expect(started.rounds).toHaveLength(1);
    expect(started.rounds[0].matches).toHaveLength(2);
  });
  it('throws when player count does not match participantCount', () => {
    const t = createTournament(baseInput());
    expect(() => startTournament(t)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- rounds factory`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `rounds.ts`**

`src/lib/tournament/rounds.ts`:
```ts
import type { Match, Round } from '../types';
import { createMatch } from './match';

export function isRoundComplete(round: Round): boolean {
  return round.matches.every((m) => m.winnerId !== null);
}

export function generateNextRound(rounds: Round[]): Round | null {
  const last = rounds[rounds.length - 1];
  if (!last || last.matches.length < 2 || !isRoundComplete(last)) return null;
  const matches: Match[] = [];
  for (let i = 0; i < last.matches.length; i += 2) {
    const w1 = last.matches[i].winnerId!;
    const w2 = last.matches[i + 1].winnerId!;
    matches.push(createMatch(w1, w2));
  }
  return { index: last.index + 1, matches };
}

export function currentRoundIndex(rounds: Round[]): number {
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].matches.some((m) => m.winnerId === null)) return i;
  }
  return Math.max(0, rounds.length - 1);
}

export function buildThirdPlaceMatch(rounds: Round[]): Match | null {
  const semi = rounds.find((r) => r.matches.length === 2);
  if (!semi || !isRoundComplete(semi)) return null;
  const losers = semi.matches.map((m) => m.loserId!);
  return createMatch(losers[0], losers[1]);
}
```

- [ ] **Step 4: Write `factory.ts`**

`src/lib/tournament/factory.ts`:
```ts
import type { Player, Tournament } from '../types';
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- rounds factory`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tournament/rounds.ts src/lib/tournament/rounds.test.ts src/lib/tournament/factory.ts src/lib/tournament/factory.test.ts
git commit -m "feat: add round progression and tournament factory"
```

---

## Task 6: Server storage, photos, and auth

**Files:**
- Create: `src/lib/server/storage.ts`, `src/lib/server/storage.test.ts`, `src/lib/server/photos.ts`, `src/lib/server/auth.ts`, `src/lib/server/auth.test.ts`

**Interfaces:**
- Produces (storage.ts):
  - `getTournament(id: string): Promise<Tournament | null>`
  - `saveTournament(t: Tournament): Promise<void>` — persists doc and refreshes the summary index.
  - `deleteTournament(id: string): Promise<void>`
  - `listTournaments(): Promise<TournamentSummary[]>`
  - `__resetMemForTests(): void`
- Produces (photos.ts): `savePlayerPhoto(tournamentId: string, playerId: string, file: File): Promise<string>` — returns a public URL.
- Produces (auth.ts): `isAdmin(request: Request): boolean`; `requireAdmin(request: Request): void` — throws SvelteKit 401 error when the secret is missing/wrong.

- [ ] **Step 1: Write the failing tests**

`src/lib/server/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getTournament, saveTournament, deleteTournament, listTournaments, __resetMemForTests } from './storage';
import { createTournament } from '../tournament/factory';

beforeEach(() => __resetMemForTests());

describe('storage (in-memory fallback)', () => {
  it('saves and reads a tournament', async () => {
    const t = createTournament({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 });
    await saveTournament(t);
    expect(await getTournament(t.id)).toEqual(t);
  });

  it('lists summaries reflecting registered player count', async () => {
    const t = createTournament({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 });
    await saveTournament(t);
    const list = await listTournaments();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: t.id, name: 'T', status: 'registration', participantCount: 4, registered: 0 });
  });

  it('deletes a tournament and its index entry', async () => {
    const t = createTournament({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4 });
    await saveTournament(t);
    await deleteTournament(t.id);
    expect(await getTournament(t.id)).toBeNull();
    expect(await listTournaments()).toHaveLength(0);
  });
});
```

`src/lib/server/auth.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isAdmin, requireAdmin } from './auth';

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
});

function req(secret?: string): Request {
  const headers = new Headers();
  if (secret) headers.set('x-admin-secret', secret);
  return new Request('http://x', { headers });
}

describe('auth', () => {
  it('accepts the correct secret', () => {
    expect(isAdmin(req('secret'))).toBe(true);
    expect(() => requireAdmin(req('secret'))).not.toThrow();
  });
  it('rejects a missing or wrong secret', () => {
    expect(isAdmin(req())).toBe(false);
    expect(isAdmin(req('nope'))).toBe(false);
    expect(() => requireAdmin(req('nope'))).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- storage auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `storage.ts`**

`src/lib/server/storage.ts`:
```ts
import { kv } from '@vercel/kv';
import type { Tournament, TournamentSummary } from '../types';

const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const INDEX_KEY = 'tournaments:index';
const mem = new Map<string, unknown>();

async function rawGet<T>(key: string): Promise<T | null> {
  if (useKV) return (await kv.get<T>(key)) ?? null;
  return mem.has(key) ? (mem.get(key) as T) : null;
}
async function rawSet(key: string, value: unknown): Promise<void> {
  if (useKV) await kv.set(key, value);
  else mem.set(key, value);
}
async function rawDel(key: string): Promise<void> {
  if (useKV) await kv.del(key);
  else mem.delete(key);
}

const docKey = (id: string) => `tournament:${id}`;

function summarize(t: Tournament): TournamentSummary {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    participantCount: t.participantCount,
    registered: t.players.length
  };
}

export async function getTournament(id: string): Promise<Tournament | null> {
  return rawGet<Tournament>(docKey(id));
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  return (await rawGet<TournamentSummary[]>(INDEX_KEY)) ?? [];
}

export async function saveTournament(t: Tournament): Promise<void> {
  await rawSet(docKey(t.id), t);
  const index = await listTournaments();
  const next = index.filter((s) => s.id !== t.id);
  next.push(summarize(t));
  await rawSet(INDEX_KEY, next);
}

export async function deleteTournament(id: string): Promise<void> {
  await rawDel(docKey(id));
  const index = await listTournaments();
  await rawSet(INDEX_KEY, index.filter((s) => s.id !== id));
}

export function __resetMemForTests(): void {
  mem.clear();
}
```

- [ ] **Step 4: Write `auth.ts`**

`src/lib/server/auth.ts`:
```ts
import { error } from '@sveltejs/kit';

export function isAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get('x-admin-secret') === secret;
}

export function requireAdmin(request: Request): void {
  if (!isAdmin(request)) throw error(401, 'Non autorisé.');
}
```

- [ ] **Step 5: Write `photos.ts`**

`src/lib/server/photos.ts`:
```ts
import { put } from '@vercel/blob';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

function extFor(file: File): string {
  const fromName = file.name?.includes('.') ? file.name.split('.').pop() : '';
  if (fromName) return fromName.toLowerCase();
  const type = file.type || 'image/jpeg';
  return type.split('/')[1] ?? 'jpg';
}

export async function savePlayerPhoto(tournamentId: string, playerId: string, file: File): Promise<string> {
  const ext = extFor(file);
  if (useBlob) {
    const blob = await put(`tournaments/${tournamentId}/players/${playerId}.${ext}`, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true
    });
    return blob.url;
  }
  // Local dev fallback: write into static/uploads so the file is served at /uploads/...
  const dir = path.resolve('static/uploads');
  await mkdir(dir, { recursive: true });
  const filename = `${tournamentId}-${playerId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- storage auth`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server
git commit -m "feat: add server storage, photo storage, and admin auth"
```

---

## Task 7: Tournaments collection + item API

**Files:**
- Create: `src/routes/api/tournaments/+server.ts`, `src/routes/api/tournaments/[id]/+server.ts`, `src/routes/api/tournaments/api.test.ts`

**Interfaces:**
- Consumes: storage (Task 6), factory (Task 5), auth (Task 6).
- Produces:
  - `GET /api/tournaments` → `TournamentSummary[]` (admins see all; others exclude `registration`).
  - `POST /api/tournaments` → 201 `Tournament` (admin; validates power-of-two).
  - `GET /api/tournaments/:id` → `Tournament` or 404.
  - `PATCH /api/tournaments/:id` → updated `Tournament` (admin; editable fields only).
  - `DELETE /api/tournaments/:id` → `{ ok: true }` (admin).

- [ ] **Step 1: Write the failing test**

`src/routes/api/tournaments/api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listGET, POST as createPOST } from './+server';
import { GET as itemGET, PATCH as itemPATCH, DELETE as itemDELETE } from './[id]/+server';
import { __resetMemForTests } from '$lib/server/storage';

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function post(body: unknown, admin = true): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (admin) headers.set('x-admin-secret', 'secret');
  return new Request('http://x/api/tournaments', { method: 'POST', headers, body: JSON.stringify(body) });
}

const valid = { name: 'T', startDate: '2026-07-10', endDate: '2026-07-12', organiser: 'A', participantCount: 4 };

async function create() {
  const res = await createPOST({ request: post(valid) } as never);
  return res.json();
}

describe('tournaments API', () => {
  it('rejects unauthenticated create', async () => {
    await expect(createPOST({ request: post(valid, false) } as never)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a non-power-of-two participant count', async () => {
    await expect(
      createPOST({ request: post({ ...valid, participantCount: 6 }) } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates, then hides registration tournaments from non-admins', async () => {
    await create();
    const asAdmin = await (await listGET({ request: new Request('http://x', { headers: { 'x-admin-secret': 'secret' } }) } as never)).json();
    const asPublic = await (await listGET({ request: new Request('http://x') } as never)).json();
    expect(asAdmin).toHaveLength(1);
    expect(asPublic).toHaveLength(0);
  });

  it('reads, patches, and deletes an item', async () => {
    const t = await create();
    const got = await (await itemGET({ params: { id: t.id }, request: new Request('http://x') } as never)).json();
    expect(got.id).toBe(t.id);

    const patchReq = new Request('http://x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-secret': 'secret' },
      body: JSON.stringify({ name: 'Renamed' })
    });
    const patched = await (await itemPATCH({ params: { id: t.id }, request: patchReq } as never)).json();
    expect(patched.name).toBe('Renamed');

    const delReq = new Request('http://x', { method: 'DELETE', headers: { 'x-admin-secret': 'secret' } });
    const del = await (await itemDELETE({ params: { id: t.id }, request: delReq } as never)).json();
    expect(del.ok).toBe(true);
    await expect(itemGET({ params: { id: t.id }, request: new Request('http://x') } as never)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write the collection route**

`src/routes/api/tournaments/+server.ts`:
```ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { listTournaments, saveTournament } from '$lib/server/storage';
import { isAdmin, requireAdmin } from '$lib/server/auth';
import { createTournament } from '$lib/tournament/factory';

export const GET: RequestHandler = async ({ request }) => {
  const all = await listTournaments();
  const visible = isAdmin(request) ? all : all.filter((s) => s.status !== 'registration');
  return json(visible);
};

export const POST: RequestHandler = async ({ request }) => {
  requireAdmin(request);
  const body = await request.json();
  let t;
  try {
    t = createTournament(body);
  } catch (e) {
    throw error(400, (e as Error).message);
  }
  await saveTournament(t);
  return json(t, { status: 201 });
};
```

- [ ] **Step 4: Write the item route**

`src/routes/api/tournaments/[id]/+server.ts`:
```ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament, deleteTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { isPowerOfTwo } from '$lib/tournament/seeding';

const EDITABLE = ['name', 'startDate', 'endDate', 'organiser', 'firstRoundByElo', 'participantCount'] as const;

export const GET: RequestHandler = async ({ params }) => {
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  return json(t);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key];
  }
  if ('participantCount' in updates && !isPowerOfTwo(Number(updates.participantCount))) {
    throw error(400, 'Le nombre de participants doit être une puissance de deux (2, 4, 8, 16…).');
  }
  const next = { ...t, ...updates, updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  await deleteTournament(params.id!);
  return json({ ok: true });
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/tournaments
git commit -m "feat: add tournaments collection and item API routes"
```

---

## Task 8: Players, photo, rounds, matches, and 3rd-place API

**Files:**
- Create:
  - `src/routes/api/tournaments/[id]/players/+server.ts`
  - `src/routes/api/tournaments/[id]/players/[pid]/+server.ts`
  - `src/routes/api/tournaments/[id]/players/[pid]/photo/+server.ts`
  - `src/routes/api/tournaments/[id]/rounds/generate/+server.ts`
  - `src/routes/api/tournaments/[id]/matches/[mid]/games/+server.ts`
  - `src/routes/api/tournaments/[id]/thirdplace/+server.ts`
  - `src/routes/api/tournaments/flow.test.ts`

**Interfaces:**
- Consumes: storage, auth, factory (`createPlayer`, `startTournament`), rounds (`generateNextRound`, `buildThirdPlaceMatch`), match (`computeMatchWinner`).
- Produces:
  - `POST /api/tournaments/:id/players` → updated `Tournament` (adds a player; rejects if count already full).
  - `PATCH /api/tournaments/:id/players/:pid` → updated `Tournament`.
  - `POST /api/tournaments/:id/players/:pid/photo` (multipart `photo`) → updated `Player`.
  - `POST /api/tournaments/:id/rounds/generate` → updated `Tournament` (starts if in registration, else appends next round).
  - `POST /api/tournaments/:id/matches/:mid/games` (body `{ games: Game[] }`) → updated `Tournament` (recomputes winner; sets champion when the final resolves).
  - `POST /api/tournaments/:id/thirdplace` → updated `Tournament` (creates `thirdPlaceMatch`).

- [ ] **Step 1: Write the failing integration test**

`src/routes/api/tournaments/flow.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createPOST } from './+server';
import { POST as addPlayer } from './[id]/players/+server';
import { POST as generate } from './[id]/rounds/generate/+server';
import { POST as recordGames } from './[id]/matches/[mid]/games/+server';
import { __resetMemForTests } from '$lib/server/storage';
import type { Tournament } from '$lib/types';

const H = { 'content-type': 'application/json', 'x-admin-secret': 'secret' };

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function jreq(body: unknown): Request {
  return new Request('http://x', { method: 'POST', headers: H, body: JSON.stringify(body) });
}

async function createFour(): Promise<Tournament> {
  const res = await createPOST({ request: jreq({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4, firstRoundByElo: true }) } as never);
  return res.json();
}

// Fill a match: give the round-0 game a decisive 2-0 rapid so playerA wins.
function decisiveGames(playerAId: string) {
  return [
    { tier: 'rapid', index: 1, whitePlayerId: playerAId, result: 'white' }, // A white wins
    { tier: 'rapid', index: 2, whitePlayerId: playerAId, result: 'white' } // A white wins again => A 2-0
  ];
}

describe('tournament flow', () => {
  it('registers, starts, and progresses to a champion', async () => {
    const t = await createFour();
    let current = t;
    for (const elo of [2000, 1000, 1500, 1200]) {
      const res = await addPlayer({ params: { id: t.id }, request: jreq({ name: `p${elo}`, elo, lichessUsername: `p${elo}` }) } as never);
      current = await res.json();
    }
    expect(current.players).toHaveLength(4);

    // Start (registration -> active, builds round 0)
    let started = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();
    expect(started.status).toBe('active');
    expect(started.rounds[0].matches).toHaveLength(2);

    // Decide both semifinals: playerA of each wins 2-0
    for (const m of started.rounds[0].matches) {
      started = await (await recordGames({ params: { id: t.id, mid: m.id }, request: jreq({ games: decisiveGames(m.playerAId) }) } as never)).json();
    }
    expect(started.rounds[0].matches.every((m: any) => m.winnerId)).toBe(true);

    // Generate the final
    let withFinal = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();
    expect(withFinal.rounds).toHaveLength(2);
    const final = withFinal.rounds[1].matches[0];

    // Decide the final
    const done = await (await recordGames({ params: { id: t.id, mid: final.id }, request: jreq({ games: decisiveGames(final.playerAId) }) } as never)).json();
    expect(done.status).toBe('complete');
    expect(done.championId).toBe(final.playerAId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- flow`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write the players routes**

`src/routes/api/tournaments/[id]/players/+server.ts`:
```ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { createPlayer } from '$lib/tournament/factory';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  if (t.status !== 'registration') throw error(400, 'Les inscriptions sont closes.');
  if (t.players.length >= t.participantCount) throw error(400, 'Le tournoi est complet.');
  const body = await request.json();
  const player = createPlayer(body);
  const next = { ...t, players: [...t.players, player], updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
```

`src/routes/api/tournaments/[id]/players/[pid]/+server.ts`:
```ts
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
```

- [ ] **Step 4: Write the photo route**

`src/routes/api/tournaments/[id]/players/[pid]/photo/+server.ts`:
```ts
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
```

- [ ] **Step 5: Write the rounds/generate route**

`src/routes/api/tournaments/[id]/rounds/generate/+server.ts`:
```ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { startTournament } from '$lib/tournament/factory';
import { generateNextRound } from '$lib/tournament/rounds';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');

  let next;
  if (t.status === 'registration') {
    try {
      next = startTournament(t);
    } catch (e) {
      throw error(400, (e as Error).message);
    }
  } else {
    const round = generateNextRound(t.rounds);
    if (!round) throw error(400, 'Impossible de générer le tour suivant.');
    next = { ...t, rounds: [...t.rounds, round], updatedAt: new Date().toISOString() };
  }
  await saveTournament(next);
  return json(next);
};
```

- [ ] **Step 6: Write the matches/games route**

`src/routes/api/tournaments/[id]/matches/[mid]/games/+server.ts`:
```ts
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
```

- [ ] **Step 7: Write the thirdplace route**

`src/routes/api/tournaments/[id]/thirdplace/+server.ts`:
```ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { buildThirdPlaceMatch } from '$lib/tournament/rounds';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');
  const match = buildThirdPlaceMatch(t.rounds);
  if (!match) throw error(400, 'Les demi-finales ne sont pas terminées.');
  const next = { ...t, thirdPlaceMatch: match, updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- flow`
Expected: PASS.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/routes/api/tournaments
git commit -m "feat: add player, photo, round, match, and third-place API routes"
```

---

## Task 9: Client admin store and API wrappers

**Files:**
- Create: `src/lib/client/admin.svelte.ts`, `src/lib/client/api.ts`

**Interfaces:**
- Produces (admin.svelte.ts): `admin` object with `isUnlocked` (getter), `secret` (getter), `unlock(value)`, `lock()`, `headers()`.
- Produces (api.ts): `api` object with `list()`, `get(id)`, `create(input)`, `patch(id, patch)`, `remove(id)`, `addPlayer(id, input)`, `patchPlayer(id, pid, patch)`, `uploadPhoto(id, pid, file)`, `generate(id)`, `recordGames(id, mid, games)`, `createThirdPlace(id)`. Each throws `Error` with the server's French message on failure.

- [ ] **Step 1: Create the admin store**

`src/lib/client/admin.svelte.ts`:
```ts
import { browser } from '$app/environment';

const KEY = 'tournoi-ko-admin-secret';
let secret = $state(browser ? localStorage.getItem(KEY) ?? '' : '');

export const admin = {
  get isUnlocked() {
    return secret.length > 0;
  },
  get secret() {
    return secret;
  },
  unlock(value: string) {
    secret = value;
    if (browser) localStorage.setItem(KEY, value);
  },
  lock() {
    secret = '';
    if (browser) localStorage.removeItem(KEY);
  },
  headers(): Record<string, string> {
    return secret ? { 'x-admin-secret': secret } : {};
  }
};
```

- [ ] **Step 2: Create the API wrappers**

`src/lib/client/api.ts`:
```ts
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
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: no type errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/client
git commit -m "feat: add client admin store and API wrappers"
```

---

## Task 10: Tournaments list page

**Files:**
- Create: `src/lib/components/UnlockButton.svelte`, `src/lib/components/TournamentCard.svelte`, `src/lib/components/CreateTournamentForm.svelte`, `src/routes/tournois/+page.ts`, `src/routes/tournois/+page.svelte`

**Interfaces:**
- Consumes: `admin` store, `api` client, `t` strings.
- Produces: a `/tournois` page listing tournaments, with admin-only "Ajouter un tournoi" and unlock control.

- [ ] **Step 1: Create `UnlockButton.svelte`**

`src/lib/components/UnlockButton.svelte`:
```svelte
<script lang="ts">
  import { admin } from '$lib/client/admin.svelte';
  import { t } from '$lib/i18n/fr';

  function toggle() {
    if (admin.isUnlocked) {
      admin.lock();
      return;
    }
    const value = prompt(t.adminPrompt);
    if (value) admin.unlock(value);
  }
</script>

<button
  onclick={toggle}
  class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
>
  {admin.isUnlocked ? t.lock : t.unlock}
</button>
```

- [ ] **Step 2: Create `TournamentCard.svelte`**

`src/lib/components/TournamentCard.svelte`:
```svelte
<script lang="ts">
  import { t } from '$lib/i18n/fr';
  import type { TournamentSummary } from '$lib/types';

  let { summary }: { summary: TournamentSummary } = $props();

  const statusLabel: Record<string, string> = {
    registration: t.registration,
    active: t.active,
    complete: t.complete
  };
</script>

<a
  href={`/tournois/${summary.id}`}
  class="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
>
  <div class="flex items-center justify-between gap-3">
    <h3 class="font-semibold">{summary.name}</h3>
    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {statusLabel[summary.status]}
    </span>
  </div>
  <p class="mt-2 text-sm text-slate-500">
    {summary.registered}/{summary.participantCount} {t.players.toLowerCase()}
  </p>
</a>
```

- [ ] **Step 3: Create `CreateTournamentForm.svelte`**

`src/lib/components/CreateTournamentForm.svelte`:
```svelte
<script lang="ts">
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';

  let { onCreated }: { onCreated: () => void } = $props();

  let name = $state('');
  let startDate = $state('');
  let endDate = $state('');
  let organiser = $state('');
  let participantCount = $state(16);
  let firstRoundByElo = $state(false);
  let error = $state('');
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      await api.create({ name, startDate, endDate, organiser, participantCount, firstRoundByElo });
      onCreated();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={submit} class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
  <label class="block text-sm">{t.name}
    <input bind:value={name} required class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
  </label>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label class="block text-sm">{t.startDate}
      <input type="date" bind:value={startDate} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
    </label>
    <label class="block text-sm">{t.endDate}
      <input type="date" bind:value={endDate} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
    </label>
  </div>
  <label class="block text-sm">{t.organiser}
    <input bind:value={organiser} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
  </label>
  <label class="block text-sm">{t.participantCount}
    <select bind:value={participantCount} class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
      <option value={2}>2</option>
      <option value={4}>4</option>
      <option value={8}>8</option>
      <option value={16}>16</option>
    </select>
  </label>
  <label class="flex items-center gap-2 text-sm">
    <input type="checkbox" bind:checked={firstRoundByElo} />
    {t.firstRoundByElo}
  </label>
  {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
  <button disabled={busy} class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
    {t.create}
  </button>
</form>
```

- [ ] **Step 4: Create the page loader and page**

`src/routes/tournois/+page.ts`:
```ts
import type { PageLoad } from './$types';
import type { TournamentSummary } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/tournaments');
  const tournaments: TournamentSummary[] = res.ok ? await res.json() : [];
  return { tournaments };
};
```

`src/routes/tournois/+page.svelte`:
```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { admin } from '$lib/client/admin.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import UnlockButton from '$lib/components/UnlockButton.svelte';
  import TournamentCard from '$lib/components/TournamentCard.svelte';
  import CreateTournamentForm from '$lib/components/CreateTournamentForm.svelte';
  import type { TournamentSummary } from '$lib/types';

  let { data }: { data: { tournaments: TournamentSummary[] } } = $props();
  let showForm = $state(false);

  // Re-fetch through the admin-aware client so admins also see registration tournaments.
  let tournaments = $state<TournamentSummary[]>(data.tournaments);
  $effect(() => {
    if (admin.isUnlocked) api.list().then((list) => (tournaments = list)).catch(() => {});
    else tournaments = data.tournaments;
  });

  async function onCreated() {
    showForm = false;
    await invalidateAll();
    if (admin.isUnlocked) tournaments = await api.list();
  }
</script>

<main class="mx-auto max-w-3xl px-4 py-8">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">{t.tournamentsTitle}</h1>
    <div class="flex items-center gap-2">
      {#if admin.isUnlocked}
        <button onclick={() => (showForm = !showForm)} class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
          {t.addTournament}
        </button>
      {/if}
      <UnlockButton />
    </div>
  </div>

  {#if showForm}
    <div class="mt-4"><CreateTournamentForm {onCreated} /></div>
  {/if}

  {#if tournaments.length === 0}
    <p class="mt-8 text-slate-500">{t.noTournaments}</p>
  {:else}
    <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each tournaments as summary (summary.id)}
        <TournamentCard {summary} />
      {/each}
    </div>
  {/if}
</main>
```

- [ ] **Step 5: Manual verification**

Run: `ADMIN_SECRET=test npm run dev`
Then in the browser:
1. Visit `http://localhost:5173/` → click "Voir les tournois" → land on `/tournois`. Expected: heading "Tournois", "Aucun tournoi pour le moment.", no "Ajouter un tournoi" button.
2. Click "Déverrouiller", enter `test`. Expected: "Ajouter un tournoi" appears.
3. Add a tournament (name, participants 4). Expected: form closes, a card appears showing "0/4 joueurs" and status "Inscriptions".
4. Click "Verrouiller", reload. Expected: the registration tournament disappears (hidden from non-admins).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components src/routes/tournois
git commit -m "feat: add tournaments list page with admin create + unlock"
```

---

## Task 11: Bracket view (read-only, responsive, current-round focus)

**Files:**
- Create: `src/lib/components/PlayerBadge.svelte`, `src/lib/components/MatchCard.svelte`, `src/lib/components/RoundColumn.svelte`, `src/lib/components/BracketView.svelte`, `src/routes/tournois/[id]/+page.ts`, `src/routes/tournois/[id]/+page.svelte`

**Interfaces:**
- Consumes: `roundName`, `PETITE_FINALE`, `currentRoundIndex`, types, `admin`.
- Produces: `BracketView` rendering rounds as columns (mobile: one round at a time focused on the current round; desktop: all columns side by side), plus a `/tournois/[id]` page that loads a tournament and polls it.

- [ ] **Step 1: Create `PlayerBadge.svelte`**

`src/lib/components/PlayerBadge.svelte`:
```svelte
<script lang="ts">
  import type { Player } from '$lib/types';

  let { player, isWinner = false }: { player: Player | undefined; isWinner?: boolean } = $props();
</script>

<div class="flex items-center gap-2 py-1 {isWinner ? 'font-semibold text-emerald-700' : ''}">
  {#if player?.photoUrl}
    <img src={player.photoUrl} alt={player.name} class="h-7 w-7 rounded-full object-cover" />
  {:else}
    <div class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
      {player?.name?.[0] ?? '?'}
    </div>
  {/if}
  <span class="truncate">{player?.name ?? '—'}</span>
  {#if player}<span class="ml-auto text-xs text-slate-400">{player.elo}</span>{/if}
</div>
```

- [ ] **Step 2: Create `MatchCard.svelte`**

`src/lib/components/MatchCard.svelte`:
```svelte
<script lang="ts">
  import PlayerBadge from './PlayerBadge.svelte';
  import type { Match, Player } from '$lib/types';

  let {
    match,
    players,
    onclick
  }: { match: Match; players: Player[]; onclick?: (m: Match) => void } = $props();

  function byId(id: string | null): Player | undefined {
    return id ? players.find((p) => p.id === id) : undefined;
  }
</script>

<div
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onclick={() => onclick?.(match)}
  onkeydown={(e) => e.key === 'Enter' && onclick?.(match)}
  class="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm {onclick ? 'cursor-pointer hover:border-indigo-300' : ''}"
>
  <PlayerBadge player={byId(match.playerAId)} isWinner={match.winnerId === match.playerAId} />
  <div class="my-1 border-t border-dashed border-slate-100"></div>
  <PlayerBadge player={byId(match.playerBId)} isWinner={match.winnerId === match.playerBId} />
</div>
```

- [ ] **Step 3: Create `RoundColumn.svelte`**

`src/lib/components/RoundColumn.svelte`:
```svelte
<script lang="ts">
  import MatchCard from './MatchCard.svelte';
  import type { Match, Player } from '$lib/types';

  let {
    title,
    matches,
    players,
    onMatchClick
  }: { title: string; matches: Match[]; players: Player[]; onMatchClick?: (m: Match) => void } = $props();
</script>

<section class="flex min-w-[16rem] flex-col gap-3">
  <h2 class="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
  <div class="flex flex-1 flex-col justify-around gap-3">
    {#each matches as match (match.id)}
      <MatchCard {match} {players} onclick={onMatchClick} />
    {/each}
  </div>
</section>
```

- [ ] **Step 4: Create `BracketView.svelte`**

`src/lib/components/BracketView.svelte`:
```svelte
<script lang="ts">
  import RoundColumn from './RoundColumn.svelte';
  import { roundName, PETITE_FINALE } from '$lib/i18n/fr';
  import { currentRoundIndex } from '$lib/tournament/rounds';
  import type { Match, Tournament } from '$lib/types';

  let {
    tournament,
    onMatchClick
  }: { tournament: Tournament; onMatchClick?: (m: Match) => void } = $props();

  // Mobile: show one round at a time, defaulting to the current round.
  let focused = $state(currentRoundIndex(tournament.rounds));
  $effect(() => {
    focused = currentRoundIndex(tournament.rounds);
  });

  function titleFor(matchCount: number): string {
    return roundName(matchCount * 2);
  }
</script>

{#if tournament.rounds.length === 0}
  <p class="text-slate-500">Le tournoi n’a pas encore démarré.</p>
{:else}
  <!-- Mobile: single focused round with navigation -->
  <div class="sm:hidden">
    <div class="mb-3 flex items-center justify-between">
      <button
        onclick={() => (focused = Math.max(0, focused - 1))}
        disabled={focused === 0}
        class="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >‹</button>
      <span class="text-sm font-medium">{titleFor(tournament.rounds[focused].matches.length)}</span>
      <button
        onclick={() => (focused = Math.min(tournament.rounds.length - 1, focused + 1))}
        disabled={focused === tournament.rounds.length - 1}
        class="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >›</button>
    </div>
    <RoundColumn
      title={titleFor(tournament.rounds[focused].matches.length)}
      matches={tournament.rounds[focused].matches}
      players={tournament.players}
      {onMatchClick}
    />
  </div>

  <!-- Desktop: full tree -->
  <div class="hidden overflow-x-auto sm:block">
    <div class="flex items-stretch gap-6 py-2">
      {#each tournament.rounds as round (round.index)}
        <RoundColumn
          title={titleFor(round.matches.length)}
          matches={round.matches}
          players={tournament.players}
          {onMatchClick}
        />
      {/each}
    </div>
  </div>

  {#if tournament.thirdPlaceMatch}
    <div class="mt-6 max-w-xs">
      <RoundColumn
        title={PETITE_FINALE}
        matches={[tournament.thirdPlaceMatch]}
        players={tournament.players}
        {onMatchClick}
      />
    </div>
  {/if}
{/if}
```

- [ ] **Step 5: Create the loader and page**

`src/routes/tournois/[id]/+page.ts`:
```ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Tournament } from '$lib/types';

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/tournaments/${params.id}`);
  if (!res.ok) throw error(res.status, 'Tournoi introuvable.');
  const tournament: Tournament = await res.json();
  return { tournament };
};
```

`src/routes/tournois/[id]/+page.svelte`:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { admin } from '$lib/client/admin.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import UnlockButton from '$lib/components/UnlockButton.svelte';
  import BracketView from '$lib/components/BracketView.svelte';
  import type { Tournament } from '$lib/types';

  let { data }: { data: { tournament: Tournament } } = $props();
  let tournament = $state<Tournament>(data.tournament);

  async function refresh() {
    try {
      tournament = await api.get(tournament.id);
    } catch {
      /* keep last good state */
    }
  }

  // Light polling every 10s for spectators; stops on unmount.
  onMount(() => {
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  });

  const statusLabel: Record<string, string> = {
    registration: t.registration,
    active: t.active,
    complete: t.complete
  };

  const champion = $derived(
    tournament.championId ? tournament.players.find((p) => p.id === tournament.championId) : undefined
  );
</script>

<main class="mx-auto max-w-5xl px-4 py-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <a href="/tournois" class="text-sm text-indigo-600">← {t.tournamentsTitle}</a>
      <h1 class="text-2xl font-bold">{tournament.name}</h1>
      <p class="text-sm text-slate-500">
        {statusLabel[tournament.status]} · {tournament.organiser}
      </p>
    </div>
    <UnlockButton />
  </div>

  {#if champion}
    <div class="mt-4 rounded-lg bg-amber-100 px-4 py-3 text-amber-900">
      🏆 {t.champion} : <strong>{champion.name}</strong>
    </div>
  {/if}

  <div class="mt-6">
    <BracketView {tournament} />
  </div>

  {#if admin.isUnlocked}
    <p class="mt-8 text-sm text-slate-400">Mode organisateur activé — panneaux de gestion à venir.</p>
  {/if}
</main>
```

- [ ] **Step 6: Manual verification**

Run: `ADMIN_SECRET=test npm run dev`
1. Unlock (`test`), create an 8-player tournament.
2. Open it. Expected: header shows "Inscriptions", back link works, bracket area says "Le tournoi n’a pas encore démarré."
3. Resize the window narrow (<640px). Expected: no horizontal page scroll; when a bracket exists later, only one round column with ‹ › navigation shows.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components src/routes/tournois/\[id\]
git commit -m "feat: add responsive bracket view and tournament page"
```

---

## Task 12: Admin management panels (registration, results, advance, 3rd place, edit, delete)

**Files:**
- Create: `src/lib/components/PlayerRegistration.svelte`, `src/lib/components/ResultEntry.svelte`
- Modify: `src/routes/tournois/[id]/+page.svelte`

**Interfaces:**
- Consumes: `api`, `admin`, `t`, `BracketView`'s `onMatchClick`.
- Produces: full admin control of a tournament from its page.

- [ ] **Step 1: Create `PlayerRegistration.svelte`**

`src/lib/components/PlayerRegistration.svelte`:
```svelte
<script lang="ts">
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import type { Tournament } from '$lib/types';

  let {
    tournament,
    onChange
  }: { tournament: Tournament; onChange: (t: Tournament) => void } = $props();

  let name = $state('');
  let elo = $state(1500);
  let lichessUsername = $state('');
  let error = $state('');
  let busy = $state(false);

  const full = $derived(tournament.players.length >= tournament.participantCount);
  const canStart = $derived(tournament.players.length === tournament.participantCount);

  async function addPlayer(e: Event) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const updated = await api.addPlayer(tournament.id, { name, elo, lichessUsername });
      onChange(updated);
      name = '';
      lichessUsername = '';
      elo = 1500;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function uploadPhoto(pid: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      await api.uploadPhoto(tournament.id, pid, files[0]);
      onChange(await api.get(tournament.id));
    } catch (err) {
      error = (err as Error).message;
    }
  }

  async function start() {
    error = '';
    try {
      onChange(await api.generate(tournament.id));
    } catch (err) {
      error = (err as Error).message;
    }
  }
</script>

<section class="rounded-lg border border-slate-200 bg-white p-4">
  <h2 class="font-semibold">{t.registration} ({tournament.players.length}/{tournament.participantCount})</h2>

  <ul class="mt-3 space-y-2">
    {#each tournament.players as p (p.id)}
      <li class="flex items-center gap-3 text-sm">
        {#if p.photoUrl}
          <img src={p.photoUrl} alt={p.name} class="h-8 w-8 rounded-full object-cover" />
        {:else}
          <div class="h-8 w-8 rounded-full bg-slate-200"></div>
        {/if}
        <span class="flex-1">{p.name} <span class="text-slate-400">({p.elo})</span></span>
        <label class="cursor-pointer text-xs text-indigo-600">
          {t.photo}
          <input type="file" accept="image/*" class="hidden" onchange={(e) => uploadPhoto(p.id, (e.currentTarget as HTMLInputElement).files)} />
        </label>
      </li>
    {/each}
  </ul>

  {#if !full}
    <form onsubmit={addPlayer} class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
      <input bind:value={name} placeholder={t.name} required class="rounded border border-slate-300 px-2 py-1 text-sm sm:col-span-2" />
      <input type="number" bind:value={elo} placeholder={t.elo} class="rounded border border-slate-300 px-2 py-1 text-sm" />
      <input bind:value={lichessUsername} placeholder={t.lichess} class="rounded border border-slate-300 px-2 py-1 text-sm" />
      <button disabled={busy} class="rounded bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-4">
        {t.addPlayer}
      </button>
    </form>
  {/if}

  {#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}

  <button
    onclick={start}
    disabled={!canStart}
    class="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
  >
    {t.startTournament}
  </button>
  {#if !canStart}<p class="mt-1 text-xs text-slate-400">{t.needExactPlayers}</p>{/if}
</section>
```

- [ ] **Step 2: Create `ResultEntry.svelte`**

`src/lib/components/ResultEntry.svelte`:
```svelte
<script lang="ts">
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import type { Game, Match, Tournament } from '$lib/types';

  let {
    tournament,
    match,
    onChange,
    onClose
  }: {
    tournament: Tournament;
    match: Match;
    onChange: (t: Tournament) => void;
    onClose: () => void;
  } = $props();

  // Local editable copy of the games.
  let games = $state<Game[]>(match.games.map((g) => ({ ...g })));
  let error = $state('');

  const tierLabels: Record<string, string> = { rapid: t.rapid, blitz: t.blitz, armageddon: t.armageddon };

  function playerName(id: string | null): string {
    return tournament.players.find((p) => p.id === id)?.name ?? '—';
  }

  async function save() {
    error = '';
    try {
      onChange(await api.recordGames(tournament.id, match.id, games));
      onClose();
    } catch (err) {
      error = (err as Error).message;
    }
  }
</script>

<div class="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
  <div class="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">{t.recordResults}</h3>
      <button onclick={onClose} class="text-slate-400">✕</button>
    </div>
    <p class="mt-1 text-sm text-slate-500">{playerName(match.playerAId)} vs {playerName(match.playerBId)}</p>

    <div class="mt-3 space-y-3">
      {#each games as game, i (i)}
        <div class="rounded border border-slate-200 p-2">
          <p class="text-xs font-medium text-slate-500">{tierLabels[game.tier]} #{game.index}</p>
          <label class="mt-1 block text-sm">{t.white}
            <select bind:value={game.whitePlayerId} class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              <option value={match.playerAId}>{playerName(match.playerAId)}</option>
              <option value={match.playerBId}>{playerName(match.playerBId)}</option>
            </select>
          </label>
          <label class="mt-2 block text-sm">{t.winner}
            <select bind:value={game.result} class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              <option value={null}>—</option>
              <option value="white">{t.resultWhiteWin}</option>
              <option value="black">{t.resultBlackWin}</option>
              <option value="draw">{t.resultDraw}</option>
            </select>
          </label>
        </div>
      {/each}
    </div>

    {#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}

    <div class="mt-4 flex justify-end gap-2">
      <button onclick={onClose} class="rounded px-3 py-1.5 text-sm">{t.cancel}</button>
      <button onclick={save} class="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">{t.save}</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Wire panels into the tournament page**

Replace the entire content of `src/routes/tournois/[id]/+page.svelte` with:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { admin } from '$lib/client/admin.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import UnlockButton from '$lib/components/UnlockButton.svelte';
  import BracketView from '$lib/components/BracketView.svelte';
  import PlayerRegistration from '$lib/components/PlayerRegistration.svelte';
  import ResultEntry from '$lib/components/ResultEntry.svelte';
  import { generateNextRound, buildThirdPlaceMatch } from '$lib/tournament/rounds';
  import type { Match, Tournament } from '$lib/types';

  let { data }: { data: { tournament: Tournament } } = $props();
  let tournament = $state<Tournament>(data.tournament);
  let selected = $state<Match | null>(null);
  let error = $state('');

  function setTournament(next: Tournament) {
    tournament = next;
  }

  async function refresh() {
    try {
      tournament = await api.get(tournament.id);
    } catch {
      /* keep last good state */
    }
  }

  onMount(() => {
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  });

  const statusLabel: Record<string, string> = {
    registration: t.registration,
    active: t.active,
    complete: t.complete
  };
  const champion = $derived(
    tournament.championId ? tournament.players.find((p) => p.id === tournament.championId) : undefined
  );
  const canAdvance = $derived(
    tournament.status === 'active' && generateNextRound(tournament.rounds) !== null
  );
  const canThirdPlace = $derived(
    tournament.status !== 'registration' &&
      !tournament.thirdPlaceMatch &&
      buildThirdPlaceMatch(tournament.rounds) !== null
  );

  async function advance() {
    error = '';
    try {
      tournament = await api.generate(tournament.id);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function addThirdPlace() {
    error = '';
    try {
      tournament = await api.createThirdPlace(tournament.id);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function removeTournament() {
    if (!confirm(`${t.delete} « ${tournament.name} » ?`)) return;
    await api.remove(tournament.id);
    goto('/tournois');
  }

  function onMatchClick(m: Match) {
    if (admin.isUnlocked && m.playerAId && m.playerBId) selected = m;
  }
</script>

<main class="mx-auto max-w-5xl px-4 py-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <a href="/tournois" class="text-sm text-indigo-600">← {t.tournamentsTitle}</a>
      <h1 class="text-2xl font-bold">{tournament.name}</h1>
      <p class="text-sm text-slate-500">{statusLabel[tournament.status]} · {tournament.organiser}</p>
    </div>
    <UnlockButton />
  </div>

  {#if champion}
    <div class="mt-4 rounded-lg bg-amber-100 px-4 py-3 text-amber-900">
      🏆 {t.champion} : <strong>{champion.name}</strong>
    </div>
  {/if}

  {#if admin.isUnlocked && tournament.status === 'registration'}
    <div class="mt-6"><PlayerRegistration {tournament} onChange={setTournament} /></div>
  {/if}

  {#if tournament.rounds.length > 0}
    <div class="mt-6">
      <BracketView {tournament} onMatchClick={admin.isUnlocked ? onMatchClick : undefined} />
    </div>
  {/if}

  {#if admin.isUnlocked}
    <div class="mt-6 flex flex-wrap gap-2">
      {#if canAdvance}
        <button onclick={advance} class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">{t.advanceRound}</button>
      {/if}
      {#if canThirdPlace}
        <button onclick={addThirdPlace} class="rounded bg-slate-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">{t.thirdPlace}</button>
      {/if}
      <button onclick={removeTournament} class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">{t.delete}</button>
    </div>
    {#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}
  {/if}
</main>

{#if selected}
  <ResultEntry
    {tournament}
    match={selected}
    onChange={setTournament}
    onClose={() => (selected = null)}
  />
{/if}
```

- [ ] **Step 4: Manual verification — full happy path**

Run: `ADMIN_SECRET=test npm run dev`
1. Unlock (`test`), create a 4-player tournament with "Premier tour par ELO" checked.
2. Add 4 players with distinct ELOs; optionally upload a photo for one. Expected: "0/4" climbs to "4/4"; "Démarrer le tournoi" enables.
3. Click "Démarrer". Expected: registration panel disappears, bracket shows 2 semifinal cards; strongest is paired with weakest.
4. Click a match (admin) → result modal. Set the rapid #1 and #2 to make one player win (e.g. both "Victoire des Blancs" with White = same player across the two rapid games won't work since colors alternate — instead set rapid#1 "Victoire des Blancs" and rapid#2 "Victoire des Noirs" so player A wins 2-0). Save. Expected: winner highlighted in green.
5. Decide the other semifinal similarly. Expected: "Générer le tour suivant" and "Créer la petite finale" appear.
6. Click "Créer la petite finale" → a "Petite finale" card appears with the two losers.
7. Click "Générer le tour suivant" → a "Finale" column appears.
8. Decide the final. Expected: champion banner "🏆 Champion : …" appears and status becomes "Terminé".
9. Lock, reload as spectator. Expected: bracket visible read-only; clicking matches does nothing; tournament is listed.

- [ ] **Step 5: Type-check and full test run**

Run: `npm run check && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components src/routes/tournois/\[id\]/+page.svelte
git commit -m "feat: add admin registration, result entry, advance, and third-place panels"
```

---

## Task 13: Deployment config, uploads dir, and README

**Files:**
- Create: `static/uploads/.gitkeep`, `README.md`
- Verify: `.gitignore` already ignores `/static/uploads` contents (Task 1).

**Interfaces:**
- Produces: documented setup + deployment; local uploads directory exists.

- [ ] **Step 1: Create the uploads placeholder**

Create `static/uploads/.gitkeep` (empty file) so the local-fallback photo directory exists in a fresh checkout. Since `.gitignore` ignores `/static/uploads`, force-add the placeholder:

```bash
git add -f static/uploads/.gitkeep
```

- [ ] **Step 2: Write `README.md`**

`README.md`:
```markdown
# Tournoi KO

Site de visualisation de tournois d’échecs à élimination directe (PoC). SvelteKit + Vercel KV + Vercel Blob.

## Développement local

```bash
npm install
ADMIN_SECRET=test npm run dev
```

Without KV/Blob env vars the app uses in-memory storage (reset on restart) and writes photos to `static/uploads/`. Set `ADMIN_SECRET` to unlock organiser mode in the UI.

## Tests

```bash
npm test          # run once
npm run test:watch
npm run check     # type-check
```

## Deploy to Vercel

1. Import the repo into Vercel.
2. Add the **Upstash Redis** integration (Marketplace) — it provisions `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add the **Vercel Blob** store — it provisions `BLOB_READ_WRITE_TOKEN`.
4. Set env var `ADMIN_SECRET` to a private passphrase.
5. Deploy. Organiser mode is unlocked in the browser with that passphrase; spectators only see tournaments whose registration is complete.

## Notes

- `participantCount` must be a power of two (2/4/8/16).
- Match format: 2×10min → (if tied) 2×3m+2s → (if tied) 1 armageddon; an armageddon draw counts as a Black win.
```

- [ ] **Step 3: Verify production build**

Run: `npm run build`
Expected: build completes without error (adapter-vercel emits `.vercel/output`).

- [ ] **Step 4: Commit**

```bash
git add README.md static/uploads/.gitkeep
git commit -m "docs: add README and local uploads directory; verify build"
```

---

## Self-Review

**Spec coverage:**
- Create tournament (name/dates/organiser/firstRoundByElo/participantCount): Task 5 factory + Task 7 POST + Task 10 form. ✓
- Add players (name/ELO/lichess/photo): Task 8 players + photo routes; Task 12 registration UI. ✓
- Pairing (ELO-seeded vs random, fixed tree): Task 3 seeding + Task 5 startTournament/generateNextRound. ✓
- Match format (2×10, 2×3+2, armageddon; White per game; draw=Black): Task 4 + Task 12 ResultEntry. ✓
- Knockout + advance + champion: Task 8 generate/games routes; Task 12 advance. ✓
- 3rd-place match: Task 5 buildThirdPlaceMatch + Task 8 route + Task 12 button. ✓
- Persistence (KV per-tournament + index; Blob photos; local fallbacks): Task 6. ✓
- Admin passphrase gating; spectators hidden registration: Task 6 auth + Task 7 GET filter + Task 9/10 client. ✓
- Home → list → bracket navigation: Task 1 home, Task 10 list, Task 11 view. ✓
- Responsive, current-round focus: Task 11 BracketView. ✓
- All UI text French: Task 2 i18n used throughout. ✓
- TDD for logic + API: Tasks 2–8 test-first. ✓

**Placeholder scan:** none — the only "à venir" placeholder text in Task 11's page is fully replaced in Task 12.

**Type consistency:** `api` method names in Task 9 (`generate`, `recordGames`, `createThirdPlace`, `addPlayer`, `uploadPhoto`, `patch`, `remove`) are used consistently in Tasks 10–12. Route handler signatures use `@sveltejs/kit`'s generic `RequestHandler`; tests invoke them with `{ params, request }` cast, matching the handlers' destructuring. `computeMatchWinner`, `generateNextRound`, `buildThirdPlaceMatch`, `currentRoundIndex`, `startTournament`, `createMatch`, `createPlayer`, `createTournament` names are consistent across producer and consumer tasks.
