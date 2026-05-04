<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	type MeditationEditLogSheetType = {
		id: string;
		durationSeconds: number;
		time: string; // "HH:MM"
	};

	let {
		sheet = $bindable<MeditationEditLogSheetType | null>(null),
		onreload
	}: {
		sheet: MeditationEditLogSheetType | null;
		onreload: () => void;
	} = $props();

	let saving = $state(false);

	function adjustMinutes(delta: number) {
		if (!sheet) return;
		sheet.durationSeconds = Math.max(60, sheet.durationSeconds + delta * 60);
	}

	function formatDuration(s: number): string {
		const m = Math.floor(s / 60);
		return `${m} min`;
	}

	async function save() {
		if (!sheet) return;
		saving = true;
		try {
			const [h, min] = sheet.time.split(':').map(Number);
			const d = new Date();
			d.setHours(h, min, 0, 0);
			await fetch(`/api/meditation-logs/${sheet.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ durationSeconds: sheet.durationSeconds, loggedAt: d.getTime() })
			});
			sheet = null;
			onreload();
		} finally {
			saving = false;
		}
	}

	async function del() {
		if (!sheet) return;
		const res = await fetch(`/api/meditation-logs/${sheet.id}`, { method: 'DELETE' });
		if (!res.ok) return;
		sheet = null;
		onreload();
	}
</script>

{#if sheet}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => sheet = null}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">
		<div class="p-6 space-y-5">
			<div class="flex justify-center">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{t.supplement_log_edit_title} · {t.meditation_title}
			</p>

			<!-- Duration + Time in one row -->
			<div class="flex gap-2">
				<div class="flex-1">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.meditation_duration}</label>
					<div class="flex items-center gap-0 rounded-xl overflow-hidden h-10" style="background-color: var(--color-surface-container)">
						<button
							onclick={() => adjustMinutes(-1)}
							class="w-9 h-10 flex items-center justify-center text-base font-bold active:opacity-60 transition-opacity shrink-0"
							style="color: var(--color-on-surface)"
						>−</button>
						<span class="flex-1 text-center text-sm font-semibold" style="color: var(--color-on-surface)">
							{formatDuration(sheet.durationSeconds)}
						</span>
						<button
							onclick={() => adjustMinutes(1)}
							class="w-9 h-10 flex items-center justify-center text-base font-bold active:opacity-60 transition-opacity shrink-0"
							style="color: var(--color-on-surface)"
						>+</button>
					</div>
				</div>
				<div class="shrink-0">
					<label for="meditation-edit-time" class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_log_time}</label>
					<input
						id="meditation-edit-time"
						type="time"
						bind:value={sheet.time}
						class="w-28 px-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 40px"
					/>
				</div>
			</div>

			<div class="flex gap-2 pt-1">
				<button
					onclick={del}
					class="px-4 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-error)"
				>{t.supplement_log_delete}</button>
				<button
					onclick={save}
					disabled={saving}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>{saving ? '…' : t.supplement_reminders_save}</button>
			</div>
		</div>
	</div>
{/if}
