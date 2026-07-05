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
