<script lang="ts">
  import { t } from '$lib/i18n/fr';
  import type { TournamentSummary } from '$lib/types';

  let { summary }: { summary: TournamentSummary } = $props();

  const statusLabel: Record<string, string> = {
    registration: t.registration,
    active: t.active,
    complete: t.complete
  };
</script>

<a
  href={`/tournois/${summary.id}`}
  class="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
>
  <div class="flex items-center justify-between gap-3">
    <h3 class="font-semibold">{summary.name}</h3>
    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {statusLabel[summary.status]}
    </span>
  </div>
  <p class="mt-2 text-sm text-slate-500">
    {summary.registered}/{summary.participantCount} {t.players.toLowerCase()}
  </p>
</a>
