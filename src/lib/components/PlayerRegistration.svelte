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
