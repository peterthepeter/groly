<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '$lib/i18n.svelte';

	let { onAdd, onClose, suggestions = [] }: {
		onAdd: (name: string, quantityInfo: string) => Promise<void>;
		onClose: () => void;
		suggestions?: string[];
	} = $props();

	let name = $state('');
	let quantityInfo = $state('');
	let adding = $state(false);
	let nameInput: HTMLInputElement;
	let showSuggestions = $state(false);
	let bottomOffset = $state(0);

	$effect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		function update() {
			bottomOffset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
		}
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		update();
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	const filtered = $derived(
		name.length >= 1
			? suggestions.filter(s => s.toLowerCase().includes(name.toLowerCase()) && s.toLowerCase() !== name.toLowerCase()).slice(0, 5)
			: []
	);

	async function handleAdd() {
		if (!name.trim() || adding) return;
		adding = true;
		showSuggestions = false;
		await onAdd(name.trim(), quantityInfo.trim());
		name = '';
		quantityInfo = '';
		adding = false;
		await tick();
		nameInput?.focus();
	}

	async function pickSuggestion(s: string) {
		showSuggestions = false;
		name = '';
		quantityInfo = '';
		await onAdd(s, '');
		await tick();
		nameInput?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAdd();
		if (e.key === 'Escape') onClose();
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0" style="z-index: 39; background-color: rgba(0,0,0,0.5)"></div>

<!-- Bottom sheet -->
<div class="fixed left-0 right-0 z-40 max-w-[430px] mx-auto" style="bottom: {bottomOffset}px">
	<div class="rounded-t-3xl px-4 pb-6 pt-3 shadow-2xl"
	     style="background-color: var(--color-surface-low)">

		<!-- Handle -->
		<div class="flex justify-center mb-4">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>

		<!-- Suggestions -->
		{#if filtered.length > 0 && showSuggestions}
			<div class="flex gap-2 flex-wrap mb-3">
				{#each filtered as s}
					<button
						onpointerdown={(e) => e.preventDefault()}
						onclick={() => pickSuggestion(s)}
						class="px-3 py-1.5 rounded-full text-xs font-medium"
						style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)"
					>
						{s}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Eingabefelder -->
		<div class="space-y-2 mb-3">
			<input
				bind:this={nameInput}
				type="text"
				placeholder={t.item_name_label}
				bind:value={name}
				oninput={() => showSuggestions = true}
				onkeydown={handleKeydown}
				autofocus
				autocomplete="off"
				class="w-full rounded-xl px-4 py-3 text-base font-medium outline-none"
				style="background-color: var(--color-surface-card); color: var(--color-on-surface)"
			/>
			<input
				type="text"
				placeholder={t.item_quantity_placeholder}
				bind:value={quantityInfo}
				onkeydown={handleKeydown}
				autocomplete="off"
				class="w-full rounded-xl px-4 py-3 text-base outline-none"
				style="background-color: var(--color-surface-card); color: var(--color-on-surface)"
			/>
		</div>

		<!-- Schließen links, Hinzufügen rechts -->
		<div class="flex gap-2">
			<button
				onclick={onClose}
				class="flex-1 h-12 rounded-full text-sm font-semibold"
				style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
			>
				{t.close}
			</button>
			<button
				onpointerdown={(e) => e.preventDefault()}
				onclick={handleAdd}
				disabled={!name.trim() || adding}
				class="flex-1 h-12 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{t.add}
			</button>
		</div>
	</div>
</div>
