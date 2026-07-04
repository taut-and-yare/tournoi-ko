<script lang="ts">
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/fr';
  import type { Game, GameTier, Match, Tournament } from '$lib/types';

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
  const tiers: GameTier[] = ['rapid', 'blitz', 'armageddon'];

  function gamesFor(tier: GameTier): Game[] {
    return games.filter((g) => g.tier === tier);
  }

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
  <div class="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
    <div class="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div>
        <h3 class="font-semibold">{t.recordResults}</h3>
        <p class="text-sm text-slate-500">{playerName(match.playerAId)} vs {playerName(match.playerBId)}</p>
      </div>
      <button onclick={onClose} class="shrink-0 text-slate-400">✕</button>
    </div>

    <div class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {#each tiers as tier (tier)}
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{tierLabels[tier]}</p>
          <div class="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {#each gamesFor(tier) as game (tier + game.index)}
              <div class="rounded border border-slate-200 p-2">
                <p class="text-[11px] text-slate-400">#{game.index}</p>
                <div class="mt-1 grid grid-cols-2 gap-2">
                  <label class="block text-xs">{t.white}
                    <select bind:value={game.whitePlayerId} class="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-sm">
                      <option value={match.playerAId}>{playerName(match.playerAId)}</option>
                      <option value={match.playerBId}>{playerName(match.playerBId)}</option>
                    </select>
                  </label>
                  <label class="block text-xs">{t.winner}
                    <select bind:value={game.result} class="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-sm">
                      <option value={null}>—</option>
                      <option value="white">{t.resultWhiteWin}</option>
                      <option value="black">{t.resultBlackWin}</option>
                      <option value="draw">{t.resultDraw}</option>
                    </select>
                  </label>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}

      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
    </div>

    <div class="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
      <button onclick={onClose} class="rounded px-3 py-1.5 text-sm">{t.cancel}</button>
      <button onclick={save} class="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">{t.save}</button>
    </div>
  </div>
</div>
