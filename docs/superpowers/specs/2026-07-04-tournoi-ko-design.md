# Tournoi-KO — Knockout Tournament Visualization (PoC)

**Date:** 2026-07-04
**Status:** Approved design — ready for implementation planning

## 1. Purpose & scope

A small website to run and **visualize a single knockout (single-elimination) chess tournament**.
One organiser creates the tournament and manages it; spectators open a URL and watch a live
bracket. Built as a quick PoC, deployed to Vercel. Only ever one tournament exists at a time.

Out of scope (YAGNI): multiple concurrent tournaments, user accounts, real-time websockets,
mobile app, historical archive.

## 2. Stack & deployment

- **SvelteKit + TypeScript**, deployed to **Vercel** via `@sveltejs/adapter-vercel`.
  Server API routes are required to hold the admin secret and talk to KV/Blob.
- **Tailwind CSS** for fast styling of the bracket and cards.
- **Vercel KV (Upstash Redis)** — a single key `tournament` holds the entire state as one
  JSON document. Note: "Vercel KV" is now provisioned through Vercel's **Upstash Redis**
  marketplace integration; the `@vercel/kv` client and the single-key approach are unchanged.
- **Vercel Blob** — hosts the player photos and returns public URLs stored in the JSON.
- **Admin passphrase** stored in the `ADMIN_SECRET` env var. The organiser unlocks "edit
  mode" in the browser (secret kept in `localStorage`); write API routes verify it via an
  `x-admin-secret` header. Read is public.

## 3. Access model

- **Organiser (you):** unlocks edit mode with the passphrase; can create the tournament,
  add players, record results, advance rounds.
- **Spectators:** open the public URL, see the live bracket read-only. The page polls
  `GET /api/tournament` roughly every 10s so results appear without a manual refresh.

## 4. Data model

The entire state is one JSON document stored under KV key `tournament`.

```ts
Tournament {
  id: string
  name: string
  startDate: string        // ISO date
  endDate: string          // ISO date
  organiser: string
  firstRoundByElo: boolean
  status: 'registration' | 'active' | 'complete'
  size: number             // bracket size, power of 2 (2/4/8/16)
  players: Player[]
  rounds: Round[]
  thirdPlaceMatch?: Match   // optional, semifinal losers
  championId?: string
  createdAt: string
  updatedAt: string
}

Player {
  id: string
  name: string
  elo: number
  lichessUsername: string
  photoUrl: string         // Vercel Blob URL ('' until uploaded)
}

Round {
  index: number            // 0 = first round
  name: string             // "Round of 16" | "Quarterfinals" | "Semifinals" | "Final"
  matches: Match[]
}

Match {
  id: string
  playerAId: string | null // null = TBD (winner not yet decided) or bye
  playerBId: string | null
  games: Game[]
  winnerId: string | null
  loserId: string | null
  status: 'pending' | 'in_progress' | 'complete'
}

Game {
  tier: 'rapid' | 'blitz' | 'armageddon'   // 10min | 3m+2s | armageddon
  index: number            // 1 or 2 within a tier (armageddon has index 1 only)
  whitePlayerId: string
  result: 'white' | 'black' | 'draw' | null
}
```

## 5. Match format & winner logic

Each match resolves in up to three tiers. Every game records **who had White** and the outcome.

1. **Rapid** — 2 games of 10min, players alternate colours. If a player wins the pair
   (e.g. 2–0 or 1.5–0.5), they win the match. If **1–1**, proceed to tier 2.
2. **Blitz** — 2 games of 3m+2s, alternate colours. If **1–1**, proceed to tier 3.
3. **Armageddon** — 1 game; organiser assigns White; **a draw counts as a Black win**.
   Always produces a match winner.

A pure function `computeMatchWinner(match): { winnerId, loserId } | null` derives the result
from the recorded games. Scoring per game: win = 1, draw = 0.5. A tier is "decided" when the
two games are not split 1–1; otherwise the next tier's games are revealed for entry.

Result entry: a per-match form. For each game the organiser picks the White player (defaulting
to the alternation rule) and the outcome. When a tier splits 1–1, the UI reveals the next
tier's inputs.

## 6. Seeding & bracket

One fixed single-elimination bracket of size N (a power of 2). Winners advance along fixed
tree edges — there is **no re-pairing** after round 1.

- **`firstRoundByElo = true`** → standard **seeded** placement, keeping top seeds apart and
  pairing strong–weak. Slot order is the classic seeding sequence:
  - N=8: `1, 8, 4, 5, 2, 7, 3, 6` → round 1 `(1,8)(4,5)(2,7)(3,6)`, round 2
    `winner(1,8) vs winner(4,5)` and `winner(2,7) vs winner(3,6)`.
  - N=16: `1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15`.
  - Generated recursively so seeds meet as late as possible; seed = ELO rank (1 = highest).
- **`firstRoundByElo = false`** → players are **randomly shuffled into the N slots**. The
  bracket tree is then fixed; adjacent match winners meet in the next round.

Round names derive from N: for 16 → Round of 16, Quarterfinals, Semifinals, Final.

**Advancing:** "Generate next round" materializes the next round's matches from the recorded
winners of each pair of feeding matches. No randomness after the initial placement.

**3rd-place match:** optional. When both semifinal matches are complete, their losers can be
placed into a 3rd-place match (organiser toggles it on).

## 7. Visualization

A **classic left-to-right bracket tree** with connector lines, since the tree is fixed from
the start. Each match is a card showing both players' photos, names, ELO, and per-game
results, with the winner highlighted; connectors flow rightward toward the Final. The two
semifinal losers feed the optional 3rd-place match, shown near the Final. The champion is
highlighted when the tournament completes.

## 8. Pages & API

**Pages (SvelteKit routes):**
- `/` — public overview: tournament header + bracket tree. Read-only for spectators; shows
  admin controls when edit mode is unlocked. Light polling (~10s) to refresh state.
- Admin UI is surfaced inline on `/` (an "Unlock" button prompts for the passphrase). Panels:
  create tournament, registration (add players + photo upload), record results, advance round,
  3rd-place toggle, reset.

**API routes** (write routes require `x-admin-secret`):
- `GET  /api/tournament` — public; returns the JSON document.
- `POST /api/tournament` — create/replace the tournament (admin).
- `POST /api/players` — add a player (admin).
- `POST /api/upload` — upload a photo to Vercel Blob, returns the URL (admin).
- `POST /api/rounds/generate` — build round 0 from registration, or materialize the next
  round from winners (admin).
- `POST /api/matches/:id/games` — record/update game results for a match; recomputes winner
  (admin).
- `POST /api/thirdplace` — create the 3rd-place match from semifinal losers (admin).
- `POST /api/tournament/reset` — clear state (admin).

## 9. Registration rules

- Players are added one at a time (name, ELO, lichess username, photo).
- Photos are uploaded to Blob on add; oversized images may be downscaled client-side before
  upload to stay within free-tier limits.
- "Start tournament" is disabled unless the player count is a power of two (2/4/8/16). On
  start, `size` is set, round 0 is generated via the seeding/shuffle rule, and `status`
  becomes `active`.

## 10. Non-goals / accepted PoC limitations

- No optimistic concurrency: the organiser is the sole writer, so last-write-wins on the
  single KV key is acceptable.
- Passphrase auth is not hardened (no rate limiting/lockout); adequate for a private PoC.
- No automated tests (per request); a few pure functions — `computeMatchWinner`, seeding
  order, next-round generation — are structured to be trivially testable later.
