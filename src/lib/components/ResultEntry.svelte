<script lang="ts">
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import type { Game, Match, Tournament } from '$lib/types';

  let {
    tournament,
    match,
    onChange,
    onClose
  }: {
    tournament: Tournament;
    match: Match;
    onChange: (t: Tournament) => void;
    onClose: () => void;
  } = $props();

  // Local editable copy of the games.
  let games = $state<Game[]>(match.games.map((g) => ({ ...g })));
  let error = $state('');

  const tierLabels: Record<string, string> = { rapid: t.rapid, blitz: t.blitz, armageddon: t.armageddon };

  function playerName(id: string | null): string {
    return tournament.players.find((p) => p.id === id)?.name ?? '—';
  }

  async function save() {
    error = '';
    try {
      onChange(await api.recordGames(tournament.id, match.id, games));
      onClose();
    } catch (err) {
      error = (err as Error).message;
    }
  }
</script>

<div class="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
  <div class="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">{t.recordResults}</h3>
      <button onclick={onClose} class="text-slate-400">✕</button>
    </div>
    <p class="mt-1 text-sm text-slate-500">{playerName(match.playerAId)} vs {playerName(match.playerBId)}</p>

    <div class="mt-3 space-y-3">
      {#each games as game, i (i)}
        <div class="rounded border border-slate-200 p-2">
          <p class="text-xs font-medium text-slate-500">{tierLabels[game.tier]} #{game.index}</p>
          <label class="mt-1 block text-sm">{t.white}
            <select bind:value={game.whitePlayerId} class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              <option value={match.playerAId}>{playerName(match.playerAId)}</option>
              <option value={match.playerBId}>{playerName(match.playerBId)}</option>
            </select>
          </label>
          <label class="mt-2 block text-sm">{t.winner}
            <select bind:value={game.result} class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              <option value={null}>—</option>
              <option value="white">{t.resultWhiteWin}</option>
              <option value="black">{t.resultBlackWin}</option>
              <option value="draw">{t.resultDraw}</option>
            </select>
          </label>
        </div>
      {/each}
    </div>

    {#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}

    <div class="mt-4 flex justify-end gap-2">
      <button onclick={onClose} class="rounded px-3 py-1.5 text-sm">{t.cancel}</button>
      <button onclick={save} class="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">{t.save}</button>
    </div>
  </div>
</div>
