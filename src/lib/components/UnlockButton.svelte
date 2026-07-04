<script lang="ts">
  import { admin } from '$lib/client/admin.svelte';
  import { t } from '$lib/i18n/fr';

  function toggle() {
    if (admin.isUnlocked) {
      admin.lock();
      return;
    }
    const value = prompt(t.adminPrompt);
    if (value) admin.unlock(value);
  }
</script>

<button
  onclick={toggle}
  class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
>
  {admin.isUnlocked ? t.lock : t.unlock}
</button>
