# Tournoi-KO — Knockout Tournament Visualization (PoC)

**Date:** 2026-07-04
**Status:** Approved design — ready for implementation planning

## 1. Purpose & scope

A small website to run and **visualize knockout (single-elimination) chess tournaments**. An
organiser creates and manages tournaments; spectators open the site and watch live brackets.
Built as a quick PoC, deployed to Vercel. The app holds a small list of tournaments, but is
still expected to run just a few at a time.

All user-facing text is in **French** (see §11). This spec and the code are in English.

Out of scope (YAGNI): user accounts, real-time websockets, native mobile app, historical
archive/analytics.

## 2. Stack & deployment

- **SvelteKit + TypeScript**, deployed to **Vercel** via `@sveltejs/adapter-vercel`.
  Server API routes are required to hold the admin secret and talk to KV/Blob.
- **Tailwind CSS** for fast styling of the bracket and cards.
- **Vercel KV (Upstash Redis)** — each tournament is one JSON document under key
  `tournament:{id}`; a `tournaments:index` key holds a lightweight array of summaries
  (id, name, status, participantCount, registered count) for the list page. Note: "Vercel KV"
  is now provisioned through Vercel's **Upstash Redis** marketplace integration; the
  `@vercel/kv` client is unchanged.
- **Vercel Blob** — hosts the player photos and returns public URLs stored in the JSON.
- **Admin passphrase** stored in the `ADMIN_SECRET` env var. The organiser unlocks "edit
  mode" in the browser (secret kept in `localStorage`); write API routes verify it via an
  `x-admin-secret` header. Read is public.

## 3. Access model

- **Organiser (admin):** unlocks edit mode with the passphrase; sees an "Ajouter un tournoi"
  button on the list page and can create tournaments, add/edit players, record results, advance
  rounds. Sees **all** tournaments, including those still in registration.
- **Spectators:** browse read-only. On the list page they see **only tournaments whose
  registration is complete** (all players in — status `active` or `complete`); in-registration
  tournaments are hidden from them. The tournament view polls its `GET` endpoint roughly every
  10s so results appear without a manual refresh.

## 4. Data model

Each tournament is one JSON document stored under KV key `tournament:{id}` (see §2 for the
`tournaments:index` list). The document shape:

```ts
Tournament {
  id: string
  name: string
  startDate: string        // ISO date
  endDate: string          // ISO date
  organiser: string
  firstRoundByElo: boolean
  status: 'registration' | 'active' | 'complete'
  participantCount: number // declared at creation; must be a power of 2 (2/4/8/16…);
                           // registration must reach exactly this count
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
  matches: Match[]
}
// A round's display name is derived from its distance to the Final and rendered via the
// French i18n map (§11) — not stored on the round.

Match {
  id: string
  playerAId: string | null // null = TBD (feeding match winner not yet decided)
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

One fixed single-elimination bracket of size N = `participantCount` (validated as a power of
two at creation, so the tree divides evenly with no byes). Winners advance along fixed tree
edges — there is **no re-pairing** after round 1.

- **`firstRoundByElo = true`** → standard **seeded** placement, keeping top seeds apart and
  pairing strong–weak. Slot order is the classic seeding sequence:
  - N=8: `1, 8, 4, 5, 2, 7, 3, 6` → round 1 `(1,8)(4,5)(2,7)(3,6)`, round 2
    `winner(1,8) vs winner(4,5)` and `winner(2,7) vs winner(3,6)`.
  - N=16: `1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15`.
  - Generated recursively so seeds meet as late as possible; seed = ELO rank (1 = highest).
- **`firstRoundByElo = false`** → players are **randomly shuffled into the N slots**. The
  bracket tree is then fixed; adjacent match winners meet in the next round.

Round display names derive from each round's distance to the Final and are rendered in French
via the i18n map (§11): for N=16 → 8es de finale, Quarts de finale, Demi-finales, Finale.

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

**Responsive behaviour (mobile-first):**
- **Opening a tournament focuses on the current round** — the latest round that has undecided
  matches (or the Final/champion once complete) — so the most relevant matchups are visible
  first without scrolling.
- **Mobile / narrow screens:** show **one round column at a time**, defaulting to the current
  round, with previous/next round navigation (and a round selector). Match cards stack
  vertically and fill the width.
- **Wide screens:** show the full horizontal bracket tree with connectors, auto-scrolled to
  centre the current round.

## 8. Pages & API

**Pages (SvelteKit routes):**
- `/` — **home / landing page**: short intro and a prominent link to the tournaments list.
- `/tournois` — **tournaments list**. Spectators see only registration-complete tournaments;
  admins (edit mode unlocked) also see in-registration ones plus an **"Ajouter un tournoi"**
  button. An "Unlock" control prompts for the passphrase to enter edit mode.
- `/tournois/[id]` — **tournament view**: header + bracket tree, opened on the current round
  (see §7). Read-only for spectators; in admin mode it also surfaces management panels:
  registration (add/edit players + photo upload), record results, advance round, 3rd-place
  toggle, edit tournament, delete. Light polling (~10s) to refresh state.

**API routes** — all tournament-scoped (write routes require `x-admin-secret`):
- `GET    /api/tournaments` — list summaries; spectators receive only registration-complete
  tournaments, admins receive all.
- `POST   /api/tournaments` — create a tournament (admin); validates `participantCount` is a
  power of two.
- `GET    /api/tournaments/:id` — public; returns the tournament JSON document.
- `PATCH  /api/tournaments/:id` — update editable fields (name, dates, organiser,
  firstRoundByElo, participantCount) (admin).
- `DELETE /api/tournaments/:id` — delete the tournament and its index entry (admin).
- `POST   /api/tournaments/:id/players` — add a player (admin).
- `PATCH  /api/tournaments/:id/players/:pid` — update a player's fields (admin).
- `POST   /api/tournaments/:id/players/:pid/photo` — multipart upload to Vercel Blob at a
  deterministic path (`tournaments/{id}/players/{pid}`); overwrites any previous photo and sets
  that player's `photoUrl` directly. Returns the updated player (admin).
- `POST   /api/tournaments/:id/rounds/generate` — build round 0 from registration, or
  materialize the next round from winners (admin).
- `POST   /api/tournaments/:id/matches/:mid/games` — record/update game results; recomputes
  winner (admin).
- `POST   /api/tournaments/:id/thirdplace` — create the 3rd-place match from semifinal losers
  (admin).

## 9. Registration rules

- Players are added one at a time (name, ELO, lichess username). A player exists first, then
  their photo is uploaded via `POST /api/tournaments/:id/players/:pid/photo`, which links it to
  the player.
  Oversized images may be downscaled client-side before upload to stay within free-tier limits.
- Both the tournament and existing players remain editable during registration via the PATCH
  endpoints.
- "Start tournament" is disabled unless the registered player count equals `participantCount`.
  On start, round 0 is generated via the seeding/shuffle rule and `status` becomes `active`.

## 10. Non-goals / accepted PoC limitations

- No optimistic concurrency: the organiser is the sole writer, so last-write-wins on a
  tournament's KV key is acceptable.
- Passphrase auth is not hardened (no rate limiting/lockout); adequate for a private PoC.
- Developed test-first (TDD). Pure logic (`computeMatchWinner`, seeding order, next-round
  generation, factory/validation) has unit tests; API routes have integration tests
  (validation, auth, storage via the local fallback) with Vitest. Svelte UI is verified via
  manual dev-server steps rather than component tests.

## 11. Styling & language

- **Responsive, mobile-first** with Tailwind. The bracket adapts per §7 (single focused round
  column on mobile, full tree on wide screens); all pages, forms, and match cards must be
  usable on a phone (stacked layouts, touch-friendly targets, no horizontal page overflow).
- **All user-facing text is in French** — page titles, buttons ("Ajouter un tournoi",
  "Ajouter un joueur", "Enregistrer les résultats", etc.), labels, round names ("8es de
  finale"/"Quarts"/"Demi-finales"/"Finale"/"Petite finale"), status text, and error messages.
  Strings are collected in a single `src/lib/i18n/fr.ts` module (keys in English, values in
  French) so text stays consistent and out of component logic. Code identifiers, comments, and
  this spec remain in English.
