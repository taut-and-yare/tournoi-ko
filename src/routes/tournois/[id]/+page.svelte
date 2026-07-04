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

  // Resync when the loader hands us a different tournament (e.g. in-app
  // navigation between /tournois/A and /tournois/B reuses this component
  // instance, so `data` changes without `tournament` being reassigned).
  $effect(() => {
    if (data.tournament.id !== tournament.id) {
      tournament = data.tournament;
    }
  });

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
