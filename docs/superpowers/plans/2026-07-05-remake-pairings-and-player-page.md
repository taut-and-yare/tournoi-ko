# Remake Pairings + Player Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organiser regenerate round-0 pairings before any result is recorded, and let anyone navigate from a player's name to a page showing (and, for admins, editing) that player's details.

**Architecture:** A new admin-only API route rebuilds round 0 in place using the same seeding helpers `startTournament` already uses. A new SvelteKit route renders a per-player page reusing the already-implemented `patchPlayer`/`uploadPhoto` client calls. `PlayerBadge` gains a link to that route, threaded down through the three components that render it.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind CSS v4, Vitest.

## Global Constraints

- **Language:** all user-facing text is French, sourced from `src/lib/i18n/fr.ts`. Code identifiers and comments are English.
- **TDD scope:** pure logic and API routes are developed test-first with Vitest. Svelte UI (`.svelte` files) has no automated test in this codebase — verify those changes via `npm run check` plus a manual dev-server walkthrough, matching how all prior UI work in this project was verified.
- **Auth:** all write API routes require header `x-admin-secret` equal to env `ADMIN_SECRET` (`requireAdmin` from `$lib/server/auth`). Reads are public.
- **Round-0-only re-pairing:** the bracket is otherwise a fixed tree once generated — this feature only ever rebuilds `rounds[0]`, and only while it holds zero recorded game results. It never touches round 1+.
- **Armageddon rule:** a draw counts as a Black win (already implemented in `$lib/tournament/match.ts`; not touched by this plan).
- **Svelte 5 syntax:** use runes (`$state`, `$derived`, `$props`, `$effect`), not the Svelte 4 reactive-statement style.

---

## File Structure

- `src/routes/api/tournaments/[id]/rounds/remake/+server.ts` — new. `POST` handler that rebuilds round 0.
- `src/routes/api/tournaments/[id]/rounds/remake/remake.test.ts` — new. Integration tests for the route above.
- `src/lib/client/api.ts` — modify. Add `api.remakePairings(id)`.
- `src/lib/i18n/fr.ts` — modify. Add `remakePairings` and `confirmRemakePairings`.
- `src/routes/tournois/[id]/+page.svelte` — modify. Add the ELO toggle + "Refaire les appariements" button.
- `src/routes/tournois/[id]/joueurs/[pid]/+page.ts` — new. Loader: fetch tournament, find player, 404 on either miss.
- `src/routes/tournois/[id]/joueurs/[pid]/joueur.test.ts` — new. Unit tests for the loader.
- `src/routes/tournois/[id]/joueurs/[pid]/+page.svelte` — new. Read-only display + admin edit form.
- `src/lib/components/PlayerBadge.svelte` — modify. Name becomes a link; gains a `tournamentId` prop.
- `src/lib/components/MatchCard.svelte` — modify. Threads `tournamentId` through to `PlayerBadge`.
- `src/lib/components/RoundColumn.svelte` — modify. Threads `tournamentId` through to `MatchCard`.
- `src/lib/components/BracketView.svelte` — modify. Passes `tournamentId={tournament.id}` at its three `RoundColumn` call sites.

---

### Task 1: Backend remake-pairings route

**Files:**
- Create: `src/routes/api/tournaments/[id]/rounds/remake/+server.ts`
- Create: `src/routes/api/tournaments/[id]/rounds/remake/remake.test.ts`
- Modify: `src/lib/client/api.ts`

**Interfaces:**
- Consumes: `getTournament`/`saveTournament` (`$lib/server/storage`), `requireAdmin` (`$lib/server/auth`), `buildFirstRoundSlots(players: Player[], byElo: boolean, rng?: () => number): Player[]` (`$lib/tournament/seeding`), `createMatch(aId: string, bId: string): Match` (`$lib/tournament/match`).
- Produces: `POST /api/tournaments/:id/rounds/remake` (admin-only, `200` with the updated `Tournament` JSON, or `400` if the guard fails, or `404` if the tournament doesn't exist). `api.remakePairings(id: string): Promise<Tournament>` in `$lib/client/api.ts`.

- [ ] **Step 1: Write the failing route test**

Create `src/routes/api/tournaments/[id]/rounds/remake/remake.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createTournament } from '../../../+server';
import { POST as addPlayer } from '../../players/+server';
import { POST as generate } from '../generate/+server';
import { POST as recordGames } from '../../matches/[mid]/games/+server';
import { POST as remake } from './+server';
import { __resetMemForTests } from '$lib/server/storage';

const H = { 'content-type': 'application/json', 'x-admin-secret': 'secret' };

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function jreq(body: unknown): Request {
  return new Request('http://x', { method: 'POST', headers: H, body: JSON.stringify(body) });
}

async function createFour() {
  const res = await createTournament({
    request: jreq({ name: 'T', startDate: '', endDate: '', organiser: '', participantCount: 4, firstRoundByElo: true })
  } as never);
  return res.json();
}

describe('POST /api/tournaments/:id/rounds/remake', () => {
  it('rebuilds round 0 over the same players when no result has been recorded yet', async () => {
    const t = await createFour();
    for (const elo of [2000, 1000, 1500, 1200]) {
      await addPlayer({ params: { id: t.id }, request: jreq({ name: `p${elo}`, elo, lichessUsername: `p${elo}` }) } as never);
    }
    const started = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();

    const remade = await (await remake({ params: { id: t.id }, request: jreq({}) } as never)).json();

    expect(remade.rounds).toHaveLength(1);
    expect(remade.rounds[0].matches).toHaveLength(2);
    expect(remade.rounds[0].matches.every((m: any) => m.winnerId === null)).toBe(true);
    const allPlayerIds = remade.rounds[0].matches.flatMap((m: any) => [m.playerAId, m.playerBId]).sort();
    expect(allPlayerIds).toEqual(started.players.map((p: any) => p.id).sort());
  });

  it('rejects remaking once a game result has been recorded', async () => {
    const t = await createFour();
    for (const elo of [2000, 1000, 1500, 1200]) {
      await addPlayer({ params: { id: t.id }, request: jreq({ name: `p${elo}`, elo, lichessUsername: `p${elo}` }) } as never);
    }
    const started = await (await generate({ params: { id: t.id }, request: jreq({}) } as never)).json();
    const m = started.rounds[0].matches[0];
    await recordGames({
      params: { id: t.id, mid: m.id },
      request: jreq({ games: [{ tier: 'rapid', index: 1, whitePlayerId: m.playerAId, result: 'white' }] })
    } as never);

    await expect(
      remake({ params: { id: t.id }, request: jreq({}) } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('404s for an unknown tournament', async () => {
    await expect(
      remake({ params: { id: 'nope' }, request: jreq({}) } as never)
    ).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/tournaments/[id]/rounds/remake/remake.test.ts`
Expected: FAIL — `./+server` has no exported member `POST` (file doesn't exist yet).

- [ ] **Step 3: Implement the route**

Create `src/routes/api/tournaments/[id]/rounds/remake/+server.ts`:

```ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getTournament, saveTournament } from '$lib/server/storage';
import { requireAdmin } from '$lib/server/auth';
import { buildFirstRoundSlots } from '$lib/tournament/seeding';
import { createMatch } from '$lib/tournament/match';

export const POST: RequestHandler = async ({ params, request }) => {
  requireAdmin(request);
  const t = await getTournament(params.id!);
  if (!t) throw error(404, 'Tournoi introuvable.');

  const canRemake =
    t.status === 'active' &&
    t.rounds.length === 1 &&
    t.rounds[0].matches.every((m) => m.games.every((g) => g.result === null));
  if (!canRemake) {
    throw error(400, 'Les appariements ne peuvent être refaits qu’avant tout résultat.');
  }

  const slots = buildFirstRoundSlots(t.players, t.firstRoundByElo);
  const matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    matches.push(createMatch(slots[i].id, slots[i + 1].id));
  }
  const next = { ...t, rounds: [{ index: 0, matches }], updatedAt: new Date().toISOString() };
  await saveTournament(next);
  return json(next);
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/routes/api/tournaments/[id]/rounds/remake/remake.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Add the client API method**

In `src/lib/client/api.ts`, add to the exported `api` object (after `generate`):

```ts
  remakePairings: (id: string) =>
    req<Tournament>(`/api/tournaments/${id}/rounds/remake`, { method: 'POST', body: '{}' }),
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 3 new ones.

- [ ] **Step 7: Commit**

```bash
git add src/routes/api/tournaments/\[id\]/rounds/remake src/lib/client/api.ts
git commit -m "feat: add admin route to remake round-0 pairings before results exist"
```

---

### Task 2: Tournament page — ELO toggle and remake button

**Files:**
- Modify: `src/lib/i18n/fr.ts`
- Modify: `src/routes/tournois/[id]/+page.svelte`

**Interfaces:**
- Consumes: `api.remakePairings(id)` and `api.patch(id, patch)` (both existing/Task 1), `tournament.firstRoundByElo: boolean`, `tournament.rounds[0].matches` shape from `$lib/types`.
- Produces: nothing consumed by later tasks (leaf UI change).

- [ ] **Step 1: Add the new French strings**

In `src/lib/i18n/fr.ts`, add these two keys right after `organiserModeNotice` (before the closing `};`):

```ts
  organiserModeNotice: 'Mode organisateur activé — panneaux de gestion à venir.',
  remakePairings: 'Refaire les appariements',
  confirmRemakePairings: 'Régénérer les appariements du premier tour ? Cette action est irréversible.'
```

(Only the two new lines are additions; `organiserModeNotice`'s line keeps its existing trailing comma.)

- [ ] **Step 2: Add the derived guard and action functions**

In `src/routes/tournois/[id]/+page.svelte`, add this `$derived` next to the existing `canThirdPlace` declaration:

```ts
  const canRemake = $derived(
    tournament.status === 'active' &&
      tournament.rounds.length === 1 &&
      tournament.rounds[0].matches.every((m) => m.games.every((g) => g.result === null))
  );
```

Add these two functions next to the existing `addThirdPlace`:

```ts
  async function remakePairings() {
    if (!confirm(t.confirmRemakePairings)) return;
    error = '';
    try {
      tournament = await api.remakePairings(tournament.id);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function toggleFirstRoundByElo(value: boolean) {
    error = '';
    try {
      tournament = await api.patch(tournament.id, { firstRoundByElo: value });
    } catch (e) {
      error = (e as Error).message;
    }
  }
```

- [ ] **Step 3: Add the UI block**

In the template, inside the existing `{#if admin.isUnlocked}` block, immediately before the `<div class="mt-6 flex flex-wrap gap-2">` (the advance/thirdplace/delete buttons row), add:

```svelte
    {#if canRemake}
      <div class="mt-6 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tournament.firstRoundByElo}
            onchange={(e) => toggleFirstRoundByElo((e.target as HTMLInputElement).checked)}
          />
          {t.firstRoundByElo}
        </label>
        <button
          onclick={remakePairings}
          class="rounded bg-slate-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
        >{t.remakePairings}</button>
      </div>
    {/if}
```

- [ ] **Step 4: Type-check and run tests**

Run: `npm run check && npm test`
Expected: 0 type errors; all existing tests still pass (no logic tests target this file).

- [ ] **Step 5: Manual verification**

Run: `ADMIN_SECRET=test npm run dev`
- Open a tournament, unlock organiser mode, start it with 4 players.
- Confirm the toggle + "Refaire les appariements" button appear, and clicking the button (after confirming the dialog) reshuffles round 0.
- Record one game result in a round-0 match, confirm the toggle/button disappear.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/fr.ts src/routes/tournois/\[id\]/+page.svelte
git commit -m "feat: add remake-pairings button and ELO toggle to the tournament page"
```

---

### Task 3: Player page route

**Files:**
- Create: `src/routes/tournois/[id]/joueurs/[pid]/+page.ts`
- Create: `src/routes/tournois/[id]/joueurs/[pid]/joueur.test.ts`
- Create: `src/routes/tournois/[id]/joueurs/[pid]/+page.svelte`

**Interfaces:**
- Consumes: `Tournament`/`Player` types (`$lib/types`), `t.notFound` (`$lib/i18n/fr`), `admin.isUnlocked` (`$lib/client/admin.svelte`), `api.patchPlayer(id, pid, patch: Partial<Player>): Promise<Tournament>`, `api.uploadPhoto(id, pid, file): Promise<Player>`, `api.get(id): Promise<Tournament>` (all existing in `$lib/client/api.ts`).
- Produces: the route `/tournois/:id/joueurs/:pid`, consumed by Task 4's link.

- [ ] **Step 1: Write the failing loader tests**

Create `src/routes/tournois/[id]/joueurs/[pid]/joueur.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { load } from './+page';

function fetchReturning(status: number, body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('player page loader', () => {
  it('propagates the tournament fetch status when the tournament is not found', async () => {
    const fetchStub = fetchReturning(404, { message: 'Tournoi introuvable.' });
    await expect(
      load({ params: { id: 'missing', pid: 'p1' }, fetch: fetchStub } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the player id is not in the tournament', async () => {
    const tournament = { id: 't1', players: [{ id: 'p1', name: 'A', elo: 1000, lichessUsername: '', photoUrl: '' }] };
    const fetchStub = fetchReturning(200, tournament);
    await expect(
      load({ params: { id: 't1', pid: 'nope' }, fetch: fetchStub } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns the tournament and matching player', async () => {
    const tournament = { id: 't1', players: [{ id: 'p1', name: 'A', elo: 1000, lichessUsername: '', photoUrl: '' }] };
    const fetchStub = fetchReturning(200, tournament);
    const result = await load({ params: { id: 't1', pid: 'p1' }, fetch: fetchStub } as never);
    expect(result.tournament.id).toBe('t1');
    expect(result.player.id).toBe('p1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/tournois/[id]/joueurs/[pid]/joueur.test.ts`
Expected: FAIL — cannot find module `./+page` (doesn't exist yet).

- [ ] **Step 3: Implement the loader**

Create `src/routes/tournois/[id]/joueurs/[pid]/+page.ts`:

```ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Tournament } from '$lib/types';
import { t } from '$lib/i18n/fr';

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/tournaments/${params.id}`);
  if (!res.ok) throw error(res.status, t.notFound);
  const tournament: Tournament = await res.json();
  const player = tournament.players.find((p) => p.id === params.pid);
  if (!player) throw error(404, t.notFound);
  return { tournament, player };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/routes/tournois/[id]/joueurs/[pid]/joueur.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Implement the page**

Create `src/routes/tournois/[id]/joueurs/[pid]/+page.svelte`:

```svelte
<script lang="ts">
  import { admin } from '$lib/client/admin.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import type { Player, Tournament } from '$lib/types';

  let { data }: { data: { tournament: Tournament; player: Player } } = $props();

  let tournament = $state<Tournament>(data.tournament);
  let player = $derived(tournament.players.find((p) => p.id === data.player.id) ?? data.player);

  let name = $state(data.player.name);
  let elo = $state(data.player.elo);
  let lichessUsername = $state(data.player.lichessUsername);
  let error = $state('');
  let busy = $state(false);

  async function save(e: Event) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      tournament = await api.patchPlayer(tournament.id, player.id, { name, elo, lichessUsername });
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function uploadPhoto(files: FileList | null) {
    if (!files || files.length === 0) return;
    error = '';
    try {
      await api.uploadPhoto(tournament.id, player.id, files[0]);
      tournament = await api.get(tournament.id);
    } catch (err) {
      error = (err as Error).message;
    }
  }
</script>

<main class="mx-auto max-w-md px-4 py-6">
  <a href="/tournois/{tournament.id}" class="text-sm text-indigo-600">← {tournament.name}</a>

  <div class="mt-4 flex items-center gap-4">
    {#if player.photoUrl}
      <img src={player.photoUrl} alt={player.name} class="h-16 w-16 rounded-full object-cover" />
    {:else}
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl text-slate-500">
        {player.name[0] ?? '?'}
      </div>
    {/if}
    <div>
      <h1 class="text-xl font-bold">{player.name}</h1>
      <p class="text-sm text-slate-500">{t.elo} {player.elo} · {player.lichessUsername}</p>
    </div>
  </div>

  {#if admin.isUnlocked}
    <form class="mt-6 space-y-3" onsubmit={save}>
      <label class="block text-sm">{t.name}
        <input bind:value={name} class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block text-sm">{t.elo}
        <input type="number" bind:value={elo} class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block text-sm">{t.lichess}
        <input bind:value={lichessUsername} class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block text-sm">{t.photo}
        <input
          type="file"
          accept="image/*"
          onchange={(e) => uploadPhoto((e.target as HTMLInputElement).files)}
          class="mt-1 block text-sm"
        />
      </label>
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <button
        type="submit"
        disabled={busy}
        class="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >{t.save}</button>
    </form>
  {/if}
</main>
```

- [ ] **Step 6: Type-check and run the full suite**

Run: `npm run check && npm test`
Expected: 0 type errors; all tests pass (loader's 3 new tests included).

- [ ] **Step 7: Manual verification**

Run: `ADMIN_SECRET=test npm run dev`
- Navigate directly to `/tournois/<id>/joueurs/<pid>` for a real player (copy an id via devtools or a temporary console.log) — confirm the read-only view renders.
- Unlock organiser mode, reload the same URL — confirm the edit form appears, editing a field and clicking Save persists (reload to confirm), and uploading a photo updates it.
- Try a bogus `pid` — confirm a 404 page.

- [ ] **Step 8: Commit**

```bash
git add src/routes/tournois/\[id\]/joueurs
git commit -m "feat: add per-player page with admin-editable name/ELO/lichess/photo"
```

---

### Task 4: Link player names to the player page

**Files:**
- Modify: `src/lib/components/PlayerBadge.svelte`
- Modify: `src/lib/components/MatchCard.svelte`
- Modify: `src/lib/components/RoundColumn.svelte`
- Modify: `src/lib/components/BracketView.svelte`

**Interfaces:**
- Consumes: the route from Task 3 (`/tournois/:id/joueurs/:pid`).
- Produces: nothing consumed by later tasks (leaf UI change).

- [ ] **Step 1: Add `tournamentId` to `PlayerBadge` and link the name**

Replace the full contents of `src/lib/components/PlayerBadge.svelte`:

```svelte
<script lang="ts">
  import type { Player } from '$lib/types';

  let {
    player,
    tournamentId,
    isWinner = false
  }: { player: Player | undefined; tournamentId: string; isWinner?: boolean } = $props();
</script>

<div class="flex items-center gap-2 py-1 {isWinner ? 'font-semibold text-emerald-700' : ''}">
  {#if player?.photoUrl}
    <img src={player.photoUrl} alt={player.name} class="h-7 w-7 rounded-full object-cover" />
  {:else}
    <div class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
      {player?.name?.[0] ?? '?'}
    </div>
  {/if}
  {#if player}
    <a
      href="/tournois/{tournamentId}/joueurs/{player.id}"
      onclick={(e) => e.stopPropagation()}
      class="truncate hover:underline"
    >{player.name}</a>
  {:else}
    <span class="truncate">—</span>
  {/if}
  {#if player}<span class="ml-auto text-xs text-slate-400">{player.elo}</span>{/if}
</div>
```

- [ ] **Step 2: Thread `tournamentId` through `MatchCard`**

In `src/lib/components/MatchCard.svelte`, replace the props destructuring:

```ts
  let {
    match,
    players,
    tournamentId,
    onclick
  }: { match: Match; players: Player[]; tournamentId: string; onclick?: (m: Match) => void } = $props();
```

And update both `PlayerBadge` usages to pass it through:

```svelte
  <PlayerBadge player={byId(match.playerAId)} {tournamentId} isWinner={match.winnerId === match.playerAId} />
  <div class="my-1 border-t border-dashed border-slate-100"></div>
  <PlayerBadge player={byId(match.playerBId)} {tournamentId} isWinner={match.winnerId === match.playerBId} />
```

- [ ] **Step 3: Thread `tournamentId` through `RoundColumn`**

In `src/lib/components/RoundColumn.svelte`, replace the props destructuring:

```ts
  let {
    title,
    matches,
    players,
    tournamentId,
    onMatchClick
  }: {
    title: string;
    matches: Match[];
    players: Player[];
    tournamentId: string;
    onMatchClick?: (m: Match) => void;
  } = $props();
```

And update the `MatchCard` usage:

```svelte
    {#each matches as match (match.id)}
      <MatchCard {match} {players} {tournamentId} onclick={onMatchClick} />
    {/each}
```

- [ ] **Step 4: Pass `tournamentId` from `BracketView`'s three `RoundColumn` call sites**

In `src/lib/components/BracketView.svelte`, add `tournamentId={tournament.id}` to each of the three `<RoundColumn>` invocations (mobile view, desktop `{#each}`, and third-place). Resulting mobile block:

```svelte
    <RoundColumn
      title={titleFor(tournament.rounds[safeFocused].matches.length)}
      matches={tournament.rounds[safeFocused].matches}
      players={tournament.players}
      tournamentId={tournament.id}
      {onMatchClick}
    />
```

Desktop block:

```svelte
      {#each tournament.rounds as round (round.index)}
        <RoundColumn
          title={titleFor(round.matches.length)}
          matches={round.matches}
          players={tournament.players}
          tournamentId={tournament.id}
          {onMatchClick}
        />
      {/each}
```

Third-place block:

```svelte
      <RoundColumn
        title={PETITE_FINALE}
        matches={[tournament.thirdPlaceMatch]}
        players={tournament.players}
        tournamentId={tournament.id}
        {onMatchClick}
      />
```

- [ ] **Step 5: Type-check and run the full suite**

Run: `npm run check && npm test`
Expected: 0 type errors; all tests pass (no logic tests target these presentational components).

- [ ] **Step 6: Manual verification**

Run: `ADMIN_SECRET=test npm run dev`
- Open an active tournament's bracket. Click a player's name — confirm it navigates to that player's page (not the result-entry modal).
- As admin, click a match's background (not a name) — confirm the result-entry modal still opens as before.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/PlayerBadge.svelte src/lib/components/MatchCard.svelte src/lib/components/RoundColumn.svelte src/lib/components/BracketView.svelte
git commit -m "feat: link player names in the bracket to their player page"
```

---

## Self-Review

**Spec coverage:**
- Remake-pairings guard, backend route, client method, toggle + button UI, i18n: Task 1 + Task 2. ✓
- Player page route, read-only + admin-edit content, back link: Task 3. ✓
- PlayerBadge link + `tournamentId` threading + click-conflict handling with `MatchCard`'s existing `onclick`: Task 4. ✓
- Out-of-scope items from the spec (PlayerRegistration's list, ResultEntry's inline names) are untouched by all four tasks. ✓

**Placeholder scan:** none — every step has complete, runnable code.

**Type consistency:** `api.remakePairings`, `api.patchPlayer`, `api.uploadPhoto`, `api.get`, `api.patch` names and signatures match `src/lib/client/api.ts`'s existing/added exports across Tasks 1–3. `tournamentId: string` prop name and type match at all four call sites in Task 4. `Player`/`Tournament` field names (`photoUrl`, `lichessUsername`, `elo`, `firstRoundByElo`, `rounds`, `games`, `result`) match `src/lib/types.ts` throughout.
