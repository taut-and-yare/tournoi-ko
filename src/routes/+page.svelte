<script lang="ts">
  import { t } from '$lib/i18n/fr';
</script>

<main class="mx-auto max-w-xl px-4 py-16 text-center">
  <h1 class="text-3xl font-bold sm:text-4xl">{t.appTitle}</h1>
  <p class="mt-4 text-slate-600">{t.homeIntro}</p>
  <a
    href="/tournois"
    class="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
  >
    {t.seeTournaments}
  </a>
</main>
