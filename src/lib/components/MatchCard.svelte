<script lang="ts">
  import PlayerBadge from './PlayerBadge.svelte';
  import type { Match, Player } from '$lib/types';

  let {
    match,
    players,
    tournamentId,
    onclick
  }: { match: Match; players: Player[]; tournamentId: string; onclick?: (m: Match) => void } = $props();

  function byId(id: string | null): Player | undefined {
    return id ? players.find((p) => p.id === id) : undefined;
  }
</script>

<div
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onclick={() => onclick?.(match)}
  onkeydown={(e) => e.key === 'Enter' && onclick?.(match)}
  class="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm {onclick ? 'cursor-pointer hover:border-indigo-300' : ''}"
>
  <PlayerBadge player={byId(match.playerAId)} {tournamentId} isWinner={match.winnerId === match.playerAId} />
  <div class="my-1 border-t border-dashed border-slate-100"></div>
  <PlayerBadge player={byId(match.playerBId)} {tournamentId} isWinner={match.winnerId === match.playerBId} />
</div>
