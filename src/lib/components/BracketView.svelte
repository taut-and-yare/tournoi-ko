<script lang="ts">
  import { untrack } from 'svelte';
  import RoundColumn from './RoundColumn.svelte';
  import { roundName, PETITE_FINALE, t } from '$lib/i18n/fr';
  import { currentRoundIndex } from '$lib/tournament/rounds';
  import type { Match, Tournament } from '$lib/types';

  let {
    tournament,
    onMatchClick
  }: { tournament: Tournament; onMatchClick?: (m: Match) => void } = $props();

  // Mobile: show one round at a time, defaulting to the current round.
  // Only re-focus when the number of rounds actually changes (a new round
  // was generated) or the tournament itself changes (navigation) — not on
  // every poll of the same tournament with the same round count, which
  // would otherwise discard a spectator's manual ‹/› navigation.
  let focused = $state(currentRoundIndex(tournament.rounds));
  // Clamp for array indexing: `focused` can briefly point past the end of
  // `tournament.rounds` when navigating to a tournament with fewer rounds,
  // since render effects run before the roundKey-driven $effect below
  // corrects `focused`. Always index the array via this, never via `focused`.
  let safeFocused = $derived(Math.min(focused, tournament.rounds.length - 1));
  let roundKey = $derived(`${tournament.id}:${tournament.rounds.length}`);
  $effect(() => {
    roundKey; // establish the dependency (id changes on navigation, count changes on new round)
    focused = currentRoundIndex(untrack(() => tournament.rounds));
  });

  function titleFor(matchCount: number): string {
    return roundName(matchCount * 2);
  }
</script>

{#if tournament.rounds.length === 0}
  <p class="text-slate-500">{t.tournamentNotStarted}</p>
{:else}
  <!-- Mobile: single focused round with navigation -->
  <div class="sm:hidden">
    <div class="mb-3 flex items-center justify-between">
      <button
        onclick={() => (focused = Math.max(0, focused - 1))}
        disabled={focused === 0}
        class="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >‹</button>
      <span class="text-sm font-medium">{titleFor(tournament.rounds[safeFocused].matches.length)}</span>
      <button
        onclick={() => (focused = Math.min(tournament.rounds.length - 1, focused + 1))}
        disabled={focused === tournament.rounds.length - 1}
        class="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >›</button>
    </div>
    <RoundColumn
      title={titleFor(tournament.rounds[safeFocused].matches.length)}
      matches={tournament.rounds[safeFocused].matches}
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
