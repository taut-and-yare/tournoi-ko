# Copy Players on Creation + Unique Tournament Names — Design

Date: 2026-07-05
Status: Approved

## Motivation

Organisers running a recurring event (e.g. a weekly club tournament) currently
have to re-enter every player by hand each time they create a new tournament.
While adding this, we also close a gap noticed in passing: tournament names
aren't checked for uniqueness anywhere, so two tournaments can silently share
a name, which is confusing on the tournaments list and now doubly so once a
"copy from" dropdown references tournaments by name.

## Part A — Create a tournament with the same players

### Entry point

`CreateTournamentForm.svelte` gains a "Copier les joueurs de…" `<select>`,
populated from the tournament list its parent page already loads via
`api.list()`. The page (`src/routes/tournois/+page.svelte`) passes its
existing `tournaments: TournamentSummary[]` state down as a new prop.

The dropdown only lists tournaments where `registered === participantCount`
(a completed roster — copying a still-registering, partial roster isn't
useful) — filtered client-side from the passed-in list. Each option's label
is `${name} (${registered} joueurs)`. The first option is a placeholder,
"— Aucun —" (empty value), meaning "don't copy anything" — today's behavior.

### participantCount interaction

- Picking a source option sets `participantCount` to that tournament's
  `registered` count and disables the `<select>` for `participantCount`
  (copying an exact-size roster; a mismatched count would just require
  manual add/remove immediately after anyway).
- Picking "— Aucun —" re-enables the `participantCount` select, leaving its
  current value as-is.

### Copy mechanism

On submit, after `api.create(...)` resolves:

```
if (sourceTournamentId) {
  const source = await api.get(sourceTournamentId);
  for (const p of source.players) {
    await api.addPlayer(created.id, {
      name: p.name,
      elo: p.elo,
      lichessUsername: p.lichessUsername,
      photoUrl: p.photoUrl
    });
  }
}
```

Sequential, awaited one at a time (bounded by `participantCount` ≤ 16, so
this is at most 16 requests). `photoUrl` is copied as-is — it's already a
stable Blob/static URL, no re-upload needed. No new backend route: this
reuses `api.create` and the existing `api.addPlayer`/`POST
/api/tournaments/:id/players` route unchanged.

### Error handling

Matches this codebase's existing pragmatic style (e.g. `removeTournament`
has no rollback either): if a copy call fails partway through the loop, the
error message surfaces in the form via the existing `error` state, and the
tournament plus whichever players succeeded before the failure remain saved.
The organiser can finish manually — add the rest, or fix a player via the
per-player edit page.

### New i18n (`src/lib/i18n/fr.ts`)

- `copyPlayersFrom: 'Copier les joueurs de…'`
- `copyPlayersNone: '— Aucun —'`

### Testing

No new backend logic, so no new route/unit tests. Verified via `npm run
check` (type-check) plus a manual dev-server walkthrough, consistent with
this codebase's convention for UI-only changes.

## Part B — Unique tournament names

### Rule

A tournament's `name`, trimmed and compared case-insensitively, must not
match any other tournament's name. Applies to both creation and rename.

### Shared helper

New pure function in `src/lib/tournament/factory.ts` (alongside
`createTournament`, which already does the "name is required" check):

```ts
export function isNameTaken(name: string, existing: TournamentSummary[], excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase();
  return existing.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === normalized);
}
```

Pure and synchronous (no I/O), so it's unit-testable in isolation like the
rest of `factory.ts`. Route handlers fetch the existing list via
`listTournaments()` (already used elsewhere) and pass it in.

### Route changes

- `POST /api/tournaments` (`src/routes/api/tournaments/+server.ts`): before
  calling `createTournament(body)`, fetch `listTournaments()` and call
  `isNameTaken(body?.name ?? '', existing)`. If true, `error(400, 'Un
  tournoi avec ce nom existe déjà.')`.
- `PATCH /api/tournaments/:id` (`src/routes/api/tournaments/[id]/+server.ts`):
  when `'name' in updates`, fetch `listTournaments()` and call
  `isNameTaken(String(updates.name), existing, t.id)` — passing the current
  tournament's own id as `excludeId` so re-saving a tournament with its
  existing name (or a same-name-different-case no-op edit) doesn't
  self-collide. If true, same `400` as above.

### Testing

- Unit tests for `isNameTaken` in `src/lib/tournament/factory.test.ts`:
  exact match, case-insensitive match, whitespace-trimmed match, no match,
  and `excludeId` excluding the tournament's own entry.
- Route tests added to `src/routes/api/tournaments/api.test.ts`:
  - `POST` with a name matching an existing tournament (including a
    case/whitespace variant) → `400`.
  - `PATCH` renaming one tournament to another existing tournament's name →
    `400`.
  - `PATCH` renaming a tournament to its own current name (no-op rename) →
    succeeds (`excludeId` works).

## Non-goals

- No uniqueness constraint on player names within or across tournaments.
- No merge/dedupe UI if two tournaments already share a name before this
  ships (pre-existing data, if any, is left as-is; the constraint only
  blocks new collisions going forward).
- No change to how photos are stored or served — copying a `photoUrl`
  reuses the exact same stored file, it doesn't duplicate it.
