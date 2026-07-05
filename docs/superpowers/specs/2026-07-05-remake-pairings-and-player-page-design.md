# Remake Pairings + Player Page — Design

Date: 2026-07-05
Status: Approved

## Motivation

Two small organiser-facing gaps found during live testing of the deployed app:

1. If the ELO-vs-random toggle was set wrong at creation, or the organiser just
   wants a different draw, there's no way to redo round 0 without deleting and
   recreating the whole tournament.
2. Player names render as plain text everywhere; there's no way to fix a typo,
   correct an ELO, or add/replace a photo once registration has moved on,
   short of going through `PlayerRegistration`'s (registration-only) inline
   photo uploader.

## Part 1 — Remake pairings

### Guard condition

Remaking round 0 is only offered while it is safe to discard without losing
real results:

```
tournament.status === 'active'
  && tournament.rounds.length === 1
  && tournament.rounds[0].matches.every(m => m.games.every(g => g.result === null))
```

i.e. round 0 exists but not a single game has been scored yet. The moment one
game result is saved, the option disappears (client) and is rejected (server).

### Backend

New route `src/routes/api/tournaments/[id]/rounds/remake/+server.ts`:

- `POST`, admin-only (`requireAdmin`).
- Loads the tournament; re-checks the guard condition server-side (never
  trust the client hide) — on failure, `error(400, ...)` with a French
  message.
- Rebuilds round 0 from scratch using the existing
  `buildFirstRoundSlots(t.players, t.firstRoundByElo, Math.random)` +
  `createMatch` helpers (the same ones `startTournament` already uses),
  replacing `rounds[0]` in place. Round index stays `0`.
- Saves and returns the updated tournament, same shape as every other route.

### Client

- `api.remakePairings(id)` added to `src/lib/client/api.ts`
  (`POST /api/tournaments/${id}/rounds/remake`, empty body).
- The existing `firstRoundByElo` checkbox stays on the creation form
  unchanged (sets the initial value).
- On the tournament page, when the guard condition is true, show:
  - A copy of the `firstRoundByElo` checkbox bound to
    `tournament.firstRoundByElo`; toggling it calls the existing generic
    `api.patch(id, { firstRoundByElo })`.
  - A "Refaire les appariements" button that, after a `confirm()` prompt
    (mirroring the existing delete-tournament confirm), calls
    `api.remakePairings(id)` and applies the result via `setTournament`.

### i18n (`src/lib/i18n/fr.ts`)

New keys:
- `remakePairings: 'Refaire les appariements'`
- `confirmRemakePairings: 'Régénérer les appariements du premier tour ? Cette action est irréversible.'`

Reuses the existing `firstRoundByElo` key as the toggle's label.

### Testing

Integration test alongside `src/routes/api/tournaments/flow.test.ts`'s
existing style:
- Start a 4-player tournament, call remake before any result is recorded —
  assert it succeeds and round 0 is still 2 matches over the same 4 players.
- Record one game result in a round-0 match, call remake again — assert
  `400`.

## Part 2 — Player page

### Route

`src/routes/tournois/[id]/joueurs/[pid]/+page.ts` + `+page.svelte`, mirroring
the existing tournament page's loader (`fetch('/api/tournaments/${id}')`,
`error(res.status, t.notFound)` on failure), plus a 404 if `pid` isn't found
in `tournament.players`.

### Page content

- Photo, name, ELO, Lichess handle — read-only for everyone.
- When `admin.isUnlocked`, the same fields render as an editable form (text
  inputs + photo file input) with a Save button, wired to the
  already-implemented-but-unused `api.patchPlayer` and `api.uploadPhoto`
  client calls.
- A back link to the tournament page (`/tournois/[id]`).

### Linking

- `PlayerBadge.svelte`'s name span becomes
  `<a href="/tournois/{tournamentId}/joueurs/{player.id}">`.
- `PlayerBadge` gains a `tournamentId` prop, threaded through the one call
  chain that renders it: `BracketView` → `RoundColumn` → `MatchCard` →
  `PlayerBadge`.
- `MatchCard`'s wrapping `<div>` has its own `onclick` (opens the
  result-entry modal for admins); the anchor's click handler calls
  `stopPropagation()` so clicking a name navigates instead of also opening
  that modal.

### Out of scope

- `PlayerRegistration`'s player list (shown only during `registration`
  status) keeps its existing inline name/photo-upload UI unchanged — it is
  not routed through `PlayerBadge`.
- `ResultEntry`'s inline player names (in the White/Winner selects) stay
  plain text.

### Testing

Unit test for the loader's 404 behavior (unknown tournament id, unknown
player id within a known tournament).

## Non-goals

- No change to who can create/delete players.
- No change to match-result recording or bracket progression logic.
- No new bulk-editing or history/audit trail for player edits.
