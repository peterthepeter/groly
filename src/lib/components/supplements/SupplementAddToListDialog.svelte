<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	let {
		supplementId = $bindable<string | null>(null),
		itemName
	}: {
		supplementId: string | null;
		itemName: string;
	} = $props();

	type ListEntry = { id: string; name: string; iconId: string | null };

	let lists = $state<ListEntry[]>([]);
	let loading = $state(false);
	let search = $state('');
	let adding = $state(false);
	let newMode = $state(false);
	let newName = $state('');

	const filtered = $derived(
		search.trim()
			? lists.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
			: lists
	);

	$effect(() => {
		if (supplementId) {
			search = '';
			newMode = false;
			newName = '';
			if (lists.length === 0) loadLists();
		}
	});

	async function loadLists() {
		loading = true;
		try {
			const res = await fetch('/api/lists');
			if (res.ok) { const d = await res.json(); lists = d.lists ?? d ?? []; }
		} catch { lists = []; }
		loading = false;
	}

	async function addToList(listId: string) {
		if (adding) return;
		adding = true;
		try {
			await fetch(`/api/lists/${listId}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: itemName, quantityInfo: null })
			});
			supplementId = null;
		} finally {
			adding = false;
		}
	}

	async function createListAndAdd() {
		const name = newName.trim();
		if (adding || !name) return;
		adding = true;
		try {
			const res = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description: null, iconId: null })
			});
			if (!res.ok) throw new Error();
			const newList = await res.json();
			adding = false;
			await addToList(newList.id);
		} catch { adding = false; }
	}
</script>

{#if supplementId}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color: rgba(0,0,0,0.6)"
	     onclick={(e) => { if (e.target === e.currentTarget && !adding) supplementId = null; }}>
		<div class="w-full max-w-[430px] rounded-t-3xl px-4 pb-10 pt-4"
		     style="background-color: var(--color-surface-low); max-height: 80vh; display: flex; flex-direction: column">
			<div class="flex justify-center mb-4 flex-shrink-0">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<h2 class="text-lg font-bold mb-3 px-2 flex-shrink-0" style="color: var(--color-on-surface)">{t.recipe_to_list_title}</h2>

			{#if lists.length > 4}
				<div class="flex items-center gap-2 px-4 rounded-xl mb-3 flex-shrink-0"
				     style="background-color: var(--color-surface-container); height: 44px">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
					</svg>
					<input type="search" placeholder={t.recipe_list_search} bind:value={search}
					       class="flex-1 bg-transparent outline-none"
					       style="color: var(--color-on-surface); font-size: 16px" />
				</div>
			{/if}

			<div class="overflow-y-auto flex-1 space-y-2">
				{#if newMode}
					<div class="flex items-center gap-2 px-4 py-3 rounded-xl"
					     style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							bind:value={newName}
							onkeydown={(e) => { if (e.key === 'Enter') createListAndAdd(); if (e.key === 'Escape') newMode = false; }}
							class="flex-1 bg-transparent outline-none font-semibold"
							style="color: var(--color-on-surface); font-size: 16px"
							autofocus
						/>
						<button
							onclick={createListAndAdd}
							disabled={!newName.trim() || adding}
							class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:opacity-70"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))"
						>
							{#if adding}
								<div class="w-4 h-4 rounded-full border-2 animate-spin" style="border-color: var(--color-on-primary); border-top-color: transparent"></div>
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
						</button>
						<button onclick={() => newMode = false} aria-label="Abbrechen"
							class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-70"
							style="background-color: var(--color-surface-high)">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					</div>
				{:else}
					<button
						onclick={() => { newName = ''; newMode = true; }}
						disabled={adding}
						class="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70 disabled:opacity-40 transition-opacity"
						style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))"
					>
						<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
						     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round">
								<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
						</div>
						<span class="text-sm font-semibold" style="color: var(--color-primary)">{t.recipe_new_list}</span>
					</button>
				{/if}

				{#if loading}
					<div class="flex justify-center py-4">
						<div class="w-5 h-5 rounded-full border-2 animate-spin"
						     style="border-color: var(--color-primary); border-top-color: transparent"></div>
					</div>
				{:else}
					{#each filtered as list (list.id)}
						<button
							onclick={() => addToList(list.id)}
							disabled={adding}
							class="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70 disabled:opacity-40 transition-opacity text-left"
							style="background-color: var(--color-surface-card)"
						>
							<span class="flex-1 text-sm font-medium truncate" style="color: var(--color-on-surface)">{list.name}</span>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="9 18 15 12 9 6"/>
							</svg>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
