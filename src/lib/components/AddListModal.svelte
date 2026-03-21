<script lang="ts">
	let { onSave, onClose }: {
		onSave: (name: string, description: string) => void;
		onClose: () => void;
	} = $props();

	let name = $state('');
	let description = $state('');
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<!-- Modal -->
<div class="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-6 pb-8 pt-4"
     style="background-color: var(--color-surface-low)">
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<h2 class="text-lg font-bold mb-5" style="color: var(--color-on-surface)">Neue Liste</h2>

	<div class="space-y-3 mb-6">
		<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				placeholder="Name der Liste"
				bind:value={name}
				autofocus
				class="w-full bg-transparent outline-none text-sm font-medium"
				style="color: var(--color-on-surface)"
			/>
		</div>

		<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
			<input
				type="text"
				placeholder="Zusatzinfo (optional)"
				bind:value={description}
				class="w-full bg-transparent outline-none text-sm"
				style="color: var(--color-on-surface)"
			/>
		</div>
	</div>

	<div class="flex gap-3">
		<button
			onclick={onClose}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			Abbrechen
		</button>
		<button
			onclick={() => name.trim() && onSave(name.trim(), description.trim())}
			disabled={!name.trim()}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			Erstellen
		</button>
	</div>
</div>
