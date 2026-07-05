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
