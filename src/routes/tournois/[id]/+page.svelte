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

  // Resync when the loader hands us a different tournament (e.g. in-app
  // navigation between /tournois/A and /tournois/B reuses this component
  // instance, so `data` changes without `tournament` being reassigned).
  $effect(() => {
    if (data.tournament.id !== tournament.id) {
      tournament = data.tournament;
    }
  });

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
  const canAdvance = $derived(
    tournament.status === 'active' && generateNextRound(tournament.rounds) !== null
  );
  const canThirdPlace = $derived(
    tournament.status !== 'registration' &&
      !tournament.thirdPlaceMatch &&
      buildThirdPlaceMatch(tournament.rounds) !== null
  );
  const canRemake = $derived(
    tournament.status === 'active' &&
      tournament.rounds.length === 1 &&
      tournament.rounds[0].matches.every((m) => m.games.every((g) => g.result === null))
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

  {#if admin.isUnlocked && tournament.status === 'registration'}
    <div class="mt-6"><PlayerRegistration {tournament} onChange={setTournament} /></div>
  {/if}

  {#if tournament.rounds.length > 0}
    <div class="mt-6">
      <BracketView {tournament} onMatchClick={admin.isUnlocked ? onMatchClick : undefined} />
    </div>
  {/if}

  {#if admin.isUnlocked}
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
