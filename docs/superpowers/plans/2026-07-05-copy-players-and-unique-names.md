# Copy Players on Creation + Unique Tournament Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organiser create a new tournament pre-populated with a past tournament's exact player roster, and prevent two tournaments from ever sharing a name (on both creation and rename).

**Architecture:** Tournament-name uniqueness is a pure comparison function (`isNameTaken`) called from the two routes that can set a name (`POST` create, `PATCH` rename). Copying players is entirely client-side: after creating the tournament, the form fetches the source tournament's roster and re-POSTs each player through the existing add-player endpoint — no new backend route.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind CSS v4, Vitest.

## Global Constraints

- **Language:** all user-facing text is French, sourced from `src/lib/i18n/fr.ts`. Code identifiers and comments are English.
- **TDD scope:** pure logic and API routes are developed test-first with Vitest. Svelte UI (`.svelte` files) has no automated test in this codebase — verify those changes via `npm run check` plus a manual dev-server walkthrough.
- **Auth:** all write API routes require header `x-admin-secret` equal to env `ADMIN_SECRET` (`requireAdmin` from `$lib/server/auth`), already enforced by the routes this plan touches — no change to auth itself.
- **Name matching:** "same name" means trimmed and case-insensitive (`name.trim().toLowerCase()`), not raw string equality.
- **Svelte 5 syntax:** use runes (`$state`, `$derived`, `$props`), not the Svelte 4 reactive-statement style.

---

## File Structure

- `src/lib/tournament/factory.ts` — modify. Add `isNameTaken(name, existing, excludeId?): boolean`.
- `src/lib/tournament/factory.test.ts` — modify. Add unit tests for `isNameTaken`.
- `src/routes/api/tournaments/+server.ts` — modify. `POST` rejects a duplicate name.
- `src/routes/api/tournaments/[id]/+server.ts` — modify. `PATCH` rejects renaming into a duplicate name.
- `src/routes/api/tournaments/api.test.ts` — modify. Add route-level duplicate-name tests.
- `src/lib/i18n/fr.ts` — modify. Add `copyPlayersFrom`, `copyPlayersNone`.
- `src/lib/components/CreateTournamentForm.svelte` — modify. Add the "copy players from" dropdown and the copy logic.
- `src/routes/tournois/+page.svelte` — modify. Pass its existing `tournaments` state into `CreateTournamentForm`.

---

### Task 1: Unique tournament names

**Files:**
- Modify: `src/lib/tournament/factory.ts`
- Modify: `src/lib/tournament/factory.test.ts`
- Modify: `src/routes/api/tournaments/+server.ts`
- Modify: `src/routes/api/tournaments/[id]/+server.ts`
- Modify: `src/routes/api/tournaments/api.test.ts`

**Interfaces:**
- Consumes: `TournamentSummary` (`$lib/types`, fields `id`, `name`, `status`, `participantCount`, `registered`), `listTournaments(): Promise<TournamentSummary[]>` (`$lib/server/storage`).
- Produces: `isNameTaken(name: string, existing: TournamentSummary[], excludeId?: string): boolean` from `$lib/tournament/factory`, used by both routes below.

- [ ] **Step 1: Write the failing unit tests for `isNameTaken`**

In `src/lib/tournament/factory.test.ts`, add this import and this new `describe` block (leave the existing `createTournament`/`startTournament` blocks untouched):

```ts
import { createTournament, createPlayer, startTournament, isNameTaken } from './factory';
import type { TournamentSummary } from '../types';
```

```ts
function summary(overrides: Partial<TournamentSummary> = {}): TournamentSummary {
  return { id: 't1', name: 'Open', status: 'registration', participantCount: 4, registered: 0, ...overrides };
}

describe('isNameTaken', () => {
  it('matches an exact name', () => {
    expect(isNameTaken('Open', [summary({ name: 'Open' })])).toBe(true);
  });
  it('matches case-insensitively and trims whitespace', () => {
    expect(isNameTaken('  open  ', [summary({ name: 'Open' })])).toBe(true);
  });
  it('returns false when no tournament matches', () => {
    expect(isNameTaken('Closed', [summary({ name: 'Open' })])).toBe(false);
  });
  it('excludes the given id from the comparison', () => {
    expect(isNameTaken('Open', [summary({ id: 't1', name: 'Open' })], 't1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tournament/factory.test.ts`
Expected: FAIL — `isNameTaken` is not exported from `./factory`.

- [ ] **Step 3: Implement `isNameTaken`**

In `src/lib/tournament/factory.ts`, change the top import line from:

```ts
import type { Player, Tournament } from '../types';
```

to:

```ts
import type { Player, Tournament, TournamentSummary } from '../types';
```

Then add this function directly after `createTournament`'s closing brace (before the `CreatePlayerInput` interface):

```ts
export function isNameTaken(name: string, existing: TournamentSummary[], excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase();
  return existing.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === normalized);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/tournament/factory.test.ts`
Expected: PASS (10/10 — 6 existing + 4 new).

- [ ] **Step 5: Write the failing route tests**

In `src/routes/api/tournaments/api.test.ts`, add these three `it` blocks inside the existing `describe('tournaments API', ...)` block (after the `'reads, patches, and deletes an item'` test):

```ts
  it('rejects creating a tournament whose name matches an existing one (case/whitespace-insensitive)', async () => {
    await create(); // name: 'T'
    await expect(
      createPOST({ request: post({ ...valid, name: '  t  ' }) } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects renaming a tournament to another existing tournament's name", async () => {
    await create(); // name: 'T'
    const b = await (await createPOST({ request: post({ ...valid, name: 'Other' }) } as never)).json();
    const patchReq = new Request('http://x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-secret': 'secret' },
      body: JSON.stringify({ name: 'T' })
    });
    await expect(itemPATCH({ params: { id: b.id }, request: patchReq } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('allows renaming a tournament to its own current name', async () => {
    const a = await create(); // name: 'T'
    const patchReq = new Request('http://x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-secret': 'secret' },
      body: JSON.stringify({ name: 'T' })
    });
    const patched = await (await itemPATCH({ params: { id: a.id }, request: patchReq } as never)).json();
    expect(patched.name).toBe('T');
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/routes/api/tournaments/api.test.ts`
Expected: FAIL — the first two new tests resolve (`201`/`200`) instead of rejecting with `400`.

- [ ] **Step 7: Implement the route checks**

In `src/routes/api/tournaments/+server.ts`, change the import line from:

```ts
import { createTournament } from '$lib/tournament/factory';
```

to:

```ts
import { createTournament, isNameTaken } from '$lib/tournament/factory';
```

Then replace the `POST` handler with:

```ts
export const POST: RequestHandler = async ({ request }) => {
  requireAdmin(request);
  const body = await request.json();
  const existing = await listTournaments();
  if (isNameTaken(body?.name ?? '', existing)) {
    throw error(400, 'Un tournoi avec ce nom existe déjà.');
  }
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

In `src/routes/api/tournaments/[id]/+server.ts`, change the import lines from:

```ts
import { getTournament, saveTournament, deleteTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { isPowerOfTwo } from '$lib/tournament/seeding';
```

to:

```ts
import { getTournament, saveTournament, deleteTournament, listTournaments } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { isPowerOfTwo } from '$lib/tournament/seeding';
import { isNameTaken } from '$lib/tournament/factory';
```

Then, in the `PATCH` handler, insert this check immediately after the existing `participantCount` guard (right before `const next = { ...t, ...updates, ... }`):

```ts
  if ('name' in updates) {
    const existing = await listTournaments();
    if (isNameTaken(String(updates.name), existing, t.id)) {
      throw error(400, 'Un tournoi avec ce nom existe déjà.');
    }
  }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/routes/api/tournaments/api.test.ts`
Expected: PASS (7/7 — 4 existing + 3 new).

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: all tests pass (49/49 — 42 existing + 4 factory + 3 route).

- [ ] **Step 10: Commit**

```bash
git add src/lib/tournament/factory.ts src/lib/tournament/factory.test.ts src/routes/api/tournaments/+server.ts src/routes/api/tournaments/\[id\]/+server.ts src/routes/api/tournaments/api.test.ts
git commit -m "feat: reject duplicate tournament names on create and rename"
```

---

### Task 2: Copy players from an existing tournament on creation

**Files:**
- Modify: `src/lib/i18n/fr.ts`
- Modify: `src/lib/components/CreateTournamentForm.svelte`
- Modify: `src/routes/tournois/+page.svelte`

**Interfaces:**
- Consumes: `TournamentSummary` (`$lib/types`), `api.list(): Promise<TournamentSummary[]>`, `api.get(id): Promise<Tournament>`, `api.create(input): Promise<Tournament>`, `api.addPlayer(id, input: CreatePlayerInput): Promise<Tournament>` (all existing in `$lib/client/api.ts`).
- Produces: nothing consumed by later tasks (leaf UI change).

- [ ] **Step 1: Add the new French strings**

In `src/lib/i18n/fr.ts`, add these two lines right after the `firstRoundByElo` key:

```ts
  firstRoundByElo: 'Premier tour par ELO (fort contre faible)',
  copyPlayersFrom: 'Copier les joueurs de…',
  copyPlayersNone: '— Aucun —',
```

(Only the two new lines are additions; `firstRoundByElo`'s existing line and trailing comma are unchanged.)

- [ ] **Step 2: Rewrite `CreateTournamentForm.svelte`**

Replace the full contents of `src/lib/components/CreateTournamentForm.svelte`:

```svelte
<script lang="ts">
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import type { TournamentSummary } from '$lib/types';

  let { onCreated, tournaments }: { onCreated: () => void; tournaments: TournamentSummary[] } = $props();

  let name = $state('');
  let startDate = $state('');
  let endDate = $state('');
  let organiser = $state('');
  let participantCount = $state(16);
  let firstRoundByElo = $state(false);
  let sourceTournamentId = $state('');
  let error = $state('');
  let busy = $state(false);

  let fullRosterTournaments = $derived(tournaments.filter((s) => s.registered === s.participantCount));

  function onSourceChange() {
    if (!sourceTournamentId) return;
    const source = tournaments.find((s) => s.id === sourceTournamentId);
    if (source) participantCount = source.registered;
  }

  async function submit(e: Event) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const created = await api.create({ name, startDate, endDate, organiser, participantCount, firstRoundByElo });
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
  <label class="block text-sm">{t.copyPlayersFrom}
    <select bind:value={sourceTournamentId} onchange={onSourceChange} class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
      <option value="">{t.copyPlayersNone}</option>
      {#each fullRosterTournaments as s (s.id)}
        <option value={s.id}>{s.name} ({s.registered} joueurs)</option>
      {/each}
    </select>
  </label>
  <label class="block text-sm">{t.participantCount}
    <select bind:value={participantCount} disabled={!!sourceTournamentId} class="mt-1 w-full rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100">
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

- [ ] **Step 3: Pass `tournaments` into the form from the tournaments list page**

In `src/routes/tournois/+page.svelte`, change:

```svelte
  {#if showForm}
    <div class="mt-4"><CreateTournamentForm {onCreated} /></div>
  {/if}
```

to:

```svelte
  {#if showForm}
    <div class="mt-4"><CreateTournamentForm {onCreated} {tournaments} /></div>
  {/if}
```

- [ ] **Step 4: Type-check and run the full suite**

Run: `npm run check && npm test`
Expected: 0 type errors; all tests pass (49/49).

- [ ] **Step 5: Manual verification**

Run: `ADMIN_SECRET=test npm run dev`
- Create and fully register a 2-player tournament (add exactly 2 players, including a photo on one).
- Open the create form again — confirm the new tournament appears in "Copier les joueurs de…" as "`<name>` (2 joueurs)", and that a tournament still mid-registration (not full) does NOT appear.
- Pick it — confirm `participantCount` snaps to 2 and its selector becomes disabled/greyed out.
- Submit — confirm the new tournament lands on `/tournois` already showing 2/2 registered, with the same names/ELOs/photo as the source.
- Reselect "— Aucun —" on a fresh form open — confirm `participantCount` becomes editable again.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/fr.ts src/lib/components/CreateTournamentForm.svelte src/routes/tournois/+page.svelte
git commit -m "feat: copy a past tournament's player roster when creating a new one"
```

---

## Self-Review

**Spec coverage:**
- Part A (copy players): dropdown filtered to full rosters, participantCount auto-lock, sequential copy via existing endpoints, error handling matching existing style, new i18n keys: Task 2. ✓
- Part B (unique names): shared pure `isNameTaken`, applied to both create and rename, with unit + route test coverage: Task 1. ✓
- Non-goals (no player-name uniqueness, no photo duplication, no backfill for existing collisions) — untouched by both tasks. ✓

**Placeholder scan:** none — every step has complete, runnable code.

**Type consistency:** `isNameTaken(name: string, existing: TournamentSummary[], excludeId?: string): boolean` signature and name match between Task 1's implementation and both call sites (`+server.ts` POST, `[id]/+server.ts` PATCH). `TournamentSummary` fields (`id`, `name`, `status`, `participantCount`, `registered`) match `src/lib/types.ts` and are used consistently in Task 1's test helper and Task 2's `fullRosterTournaments` filter. `api.addPlayer`'s `CreatePlayerInput` fields (`name`, `elo`, `lichessUsername`, `photoUrl?`) match what Task 2 passes from a copied `Player`.
