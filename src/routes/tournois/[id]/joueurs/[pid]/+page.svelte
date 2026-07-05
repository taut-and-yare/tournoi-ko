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
