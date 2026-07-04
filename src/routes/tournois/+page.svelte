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
