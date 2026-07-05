<script lang="ts">
  import MatchCard from './MatchCard.svelte';
  import type { Match, Player } from '$lib/types';

  let {
    title,
    matches,
    players,
    tournamentId,
    onMatchClick
  }: {
    title: string;
    matches: Match[];
    players: Player[];
    tournamentId: string;
    onMatchClick?: (m: Match) => void;
  } = $props();
</script>

<section class="flex min-w-[16rem] flex-col gap-3">
  <h2 class="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
  <div class="flex flex-1 flex-col justify-around gap-3">
    {#each matches as match (match.id)}
      <MatchCard {match} {players} {tournamentId} onclick={onMatchClick} />
    {/each}
  </div>
</section>
