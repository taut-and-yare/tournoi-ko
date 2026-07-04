<script lang="ts">
  import RoundColumn from './RoundColumn.svelte';
  import { roundName, PETITE_FINALE } from '$lib/i18n/fr';
  import { currentRoundIndex } from '$lib/tournament/rounds';
  import type { Match, Tournament } from '$lib/types';

  let {
    tournament,
    onMatchClick
  }: { tournament: Tournament; onMatchClick?: (m: Match) => void } = $props();

  // Mobile: show one round at a time, defaulting to the current round.
  let focused = $state(currentRoundIndex(tournament.rounds));
  $effect(() => {
    focused = currentRoundIndex(tournament.rounds);
  });

  function titleFor(matchCount: number): string {
    return roundName(matchCount * 2);
  }
</script>

{#if tournament.rounds.length === 0}
  <p class="text-slate-500">Le tournoi n'a pas encore démarré.</p>
{:else}
  <!-- Mobile: single focused round with navigation -->
  <div class="sm:hidden">
    <div class="mb-3 flex items-center justify-between">
      <button
        onclick={() => (focused = Math.max(0, focused - 1))}
        disabled={focused === 0}
        class="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >‹</button>
      <span class="text-sm font-medium">{titleFor(tournament.rounds[focused].matches.length)}</span>
      <button
        onclick={() => (focused = Math.min(tournament.rounds.length - 1, focused + 1))}
        disabled={focused === tournament.rounds.length - 1}
        class="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >›</button>
    </div>
    <RoundColumn
      title={titleFor(tournament.rounds[focused].matches.length)}
      matches={tournament.rounds[focused].matches}
      players={tournament.players}
      {onMatchClick}
    />
  </div>

  <!-- Desktop: full tree -->
  <div class="hidden overflow-x-auto sm:block">
    <div class="flex items-stretch gap-6 py-2">
      {#each tournament.rounds as round (round.index)}
        <RoundColumn
          title={titleFor(round.matches.length)}
          matches={round.matches}
          players={tournament.players}
          {onMatchClick}
        />
      {/each}
    </div>
  </div>

  {#if tournament.thirdPlaceMatch}
    <div class="mt-6 max-w-xs">
      <RoundColumn
        title={PETITE_FINALE}
        matches={[tournament.thirdPlaceMatch]}
        players={tournament.players}
        {onMatchClick}
      />
    </div>
  {/if}
{/if}
