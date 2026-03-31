<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import BarcodeScanner from './BarcodeScanner.svelte';

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
	let scannerOpen = $state(false);

	const isNumeric = $derived(/^\d+$/.test(quantityInfo.trim()) || quantityInfo.trim() === '');

	function increment() {
		const n = quantityInfo.trim() === '' ? 0 : parseInt(quantityInfo.trim());
		quantityInfo = String(n + 1);
	}

	function decrement() {
		const n = parseInt(quantityInfo.trim());
		if (isNaN(n) || n <= 1) quantityInfo = '';
		else quantityInfo = String(n - 1);
	}

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

	function handleBarcodeFound(productName: string) {
		void onAdd(productName, '');
		// Scanner bleibt offen für weitere Scans
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0" style="z-index: 50; background-color: rgba(0,0,0,0.5)"></div>

<!-- Bottom sheet -->
<div class="fixed left-0 right-0 z-[60] max-w-[430px] mx-auto" style="bottom: {bottomOffset}px">
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
			<!-- svelte-ignore a11y_autofocus -->
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
			<div class="flex items-center gap-2 rounded-xl px-4 py-3"
			     style="background-color: var(--color-surface-card)">
				<input
					type="text"
					placeholder={t.item_quantity_placeholder}
					bind:value={quantityInfo}
					onkeydown={handleKeydown}
					autocomplete="off"
					class="flex-1 bg-transparent outline-none text-base min-w-0"
					style="color: var(--color-on-surface)"
				/>
				<button
					onpointerdown={(e) => e.preventDefault()}
					onclick={decrement}
					disabled={!isNumeric || quantityInfo.trim() === ''}
					tabindex="-1"
					class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				>−</button>
				<button
					onpointerdown={(e) => e.preventDefault()}
					onclick={increment}
					disabled={!isNumeric}
					tabindex="-1"
					class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				>+</button>
			</div>
		</div>

		<!-- Barcode scannen -->
		<button
			type="button"
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => { (document.activeElement as HTMLElement)?.blur(); scannerOpen = true; }}
			class="w-full h-11 rounded-full flex items-center justify-center gap-2 text-sm font-medium mb-2"
			style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
			aria-label={t.barcode_scan}
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 9V6a2 2 0 0 1 2-2h2"/>
				<path d="M3 15v3a2 2 0 0 0 2 2h2"/>
				<path d="M21 9V6a2 2 0 0 0-2-2h-2"/>
				<path d="M21 15v3a2 2 0 0 1-2 2h-2"/>
				<line x1="7" y1="12" x2="7" y2="12"/>
				<line x1="10" y1="9" x2="10" y2="15"/>
				<line x1="13" y1="9" x2="13" y2="15"/>
				<line x1="16" y1="9" x2="16" y2="15"/>
				<line x1="19" y1="12" x2="19" y2="12"/>
			</svg>
			{t.barcode_scan}
		</button>

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

{#if scannerOpen}
	<BarcodeScanner
		onFound={handleBarcodeFound}
		onClose={() => scannerOpen = false}
	/>
{/if}
