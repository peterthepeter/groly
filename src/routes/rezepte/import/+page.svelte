<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';

	type ParsedRecipe = {
		title: string;
		description: string | null;
		imageUrl: string | null;
		sourceUrl: string;
		servings: number;
		prepTime: number | null;
		cookTime: number | null;
		ingredients: Array<{ amount: string | null; unit: string | null; name: string }>;
		steps: Array<{ stepNumber: number; text: string }>;
	};

	let url = $state('');
	let loading = $state(false);
	let error = $state('');
	let parsed = $state<ParsedRecipe | null>(null);
	let saving = $state(false);

	async function importUrl() {
		const trimmed = url.trim();
		if (!trimmed) return;
		loading = true;
		error = '';
		parsed = null;
		try {
			const res = await fetch('/api/recipes/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: trimmed })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Fehler beim Importieren';
			} else {
				parsed = data;
			}
		} catch {
			error = 'Verbindungsfehler. Bitte prüfe deine Internetverbindung.';
		}
		loading = false;
	}

	async function saveRecipe() {
		if (!parsed || saving) return;
		saving = true;
		try {
			const res = await fetch('/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed)
			});
			if (res.ok) {
				const data = await res.json();
				goto(`/rezepte/${data.id}`);
			} else {
				const data = await res.json();
				error = data.error ?? 'Fehler beim Speichern';
				saving = false;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Netzwerkfehler beim Speichern';
			saving = false;
		}
	}

	// Handle PWA Share Target: ?url=https://...
	onMount(() => {
		const sharedUrl = $page.url.searchParams.get('url');
		if (sharedUrl) {
			url = sharedUrl;
			importUrl();
		}
	});

	async function pasteFromClipboard() {
		try {
			const text = await navigator.clipboard.readText();
			if (text.startsWith('http')) url = text.trim();
		} catch {}
	}
</script>

<div class="h-[100dvh] flex flex-col justify-end" style="background-color: var(--color-bg)">

	<!-- Bottom sheet card -->
	<div class="rounded-t-3xl flex flex-col"
	     style="background-color: var(--color-surface-card); max-height: 92dvh; padding-bottom: max(env(safe-area-inset-bottom), 1.5rem)">

		<!-- Drag handle + header -->
		<div class="flex-shrink-0 pt-3 px-6 pb-4">
			<div class="w-10 h-1 rounded-full mx-auto mb-5" style="background-color: var(--color-outline-variant)"></div>
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{t.recipe_import_title}</h2>
				<button
					onclick={() => goto('/rezepte')}
					class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 transition-opacity"
					style="background-color: var(--color-surface-container)"
					aria-label="Schließen"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Scrollable content -->
		<div class="flex-1 min-h-0 overflow-y-auto px-6 flex flex-col gap-4 pb-2">

			<!-- Preview (erscheint nach erfolgreichem Import) -->
			{#if parsed}
				<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
					{#if parsed.imageUrl}
						<img src={parsed.imageUrl} alt={parsed.title} class="w-full h-40 object-cover" />
					{/if}
					<div class="p-4">
						<h2 class="text-base font-bold mb-2" style="color: var(--color-on-surface)">{parsed.title}</h2>
						{#if parsed.description}
							<p class="text-sm mb-3 line-clamp-2" style="color: var(--color-on-surface-variant)">{parsed.description}</p>
						{/if}
						<div class="flex gap-2 flex-wrap">
							<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
							     style="background-color: var(--color-surface-card)">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
								</svg>
								<span class="text-xs font-medium" style="color: var(--color-on-surface)">{parsed.ingredients.length} {t.recipe_ingredients}</span>
							</div>
							<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
							     style="background-color: var(--color-surface-card)">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
								</svg>
								<span class="text-xs font-medium" style="color: var(--color-on-surface)">{parsed.steps.length} {t.recipe_instructions}</span>
							</div>
							{#if (parsed.prepTime ?? 0) + (parsed.cookTime ?? 0) > 0}
								<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
								     style="background-color: var(--color-surface-card)">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
									</svg>
									<span class="text-xs font-medium" style="color: var(--color-on-surface)">{(parsed.prepTime ?? 0) + (parsed.cookTime ?? 0)} {t.recipe_minutes}</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Supported sites hint -->
			{#if !parsed && !loading}
				<div>
					<p class="text-xs font-semibold uppercase tracking-wider mb-2.5" style="color: var(--color-on-surface-variant)">{t.recipe_import_supported}</p>
					<div class="flex flex-wrap gap-2">
						{#each [
							{ label: 'Chefkoch', href: 'https://www.chefkoch.de/rs/s0/Rezepte.html' },
							{ label: 'BBC Good Food', href: 'https://www.bbcgoodfood.com/recipes' },
							{ label: 'Sallys Welt', href: 'https://sallys-blog.de/rezepte' },
							{ label: 'Kitchen Stories', href: 'https://www.kitchenstories.com/de/rezepte' },
							{ label: 'Allrecipes', href: 'https://www.allrecipes.com' },
							{ label: 'Lecker.de', href: 'https://www.lecker.de/rezepte' }
						] as site}
							<a href={site.href} target="_blank" rel="noopener noreferrer"
							   class="px-3 py-1 rounded-full text-xs active:opacity-70 transition-opacity"
							   style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant); text-decoration: none">
								{site.label}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Error -->
			{#if error}
				<div class="px-4 py-3 rounded-xl flex items-start gap-3"
				     style="background-color: color-mix(in srgb, var(--color-error) 12%, var(--color-surface-container))">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
						<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
					</svg>
					<p class="text-sm" style="color: var(--color-error)">{error}</p>
				</div>
			{/if}

			<!-- URL input -->
			<div class="flex gap-2">
				<div class="flex-1 flex items-center px-4 rounded-2xl"
				     style="background-color: var(--color-surface-container); height: 52px">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mr-2">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
					</svg>
					<input
						type="url"
						placeholder="https://www.chefkoch.de/…"
						bind:value={url}
						onkeydown={(e) => e.key === 'Enter' && importUrl()}
						class="flex-1 bg-transparent outline-none truncate"
						style="color: var(--color-on-surface); font-size: 16px"
					/>
					{#if url}
						<button onclick={() => url = ''} class="ml-1 active:opacity-60" aria-label="URL löschen">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					{/if}
				</div>
				<button
					onclick={pasteFromClipboard}
					class="px-4 rounded-2xl text-xs font-semibold active:opacity-70 transition-opacity"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant); height: 52px"
				>{t.recipe_import_paste}</button>
			</div>

		</div>

		<!-- Action button (fixed at bottom of sheet) -->
		<div class="flex-shrink-0 px-6 pt-3">
			{#if parsed}
				<button
					onclick={saveRecipe}
					disabled={saving}
					class="w-full py-4 rounded-full font-semibold text-sm disabled:opacity-40 active:scale-95 transition-all"
					style="background-color: var(--color-primary); color: var(--color-on-primary)"
				>
					{saving ? t.recipe_saving : t.recipe_save}
				</button>
			{:else}
				<button
					onclick={importUrl}
					disabled={!url.trim() || loading}
					class="w-full py-4 rounded-full font-semibold text-sm disabled:opacity-40 active:scale-95 transition-all"
					style="background-color: var(--color-primary); color: var(--color-on-primary)"
				>
					{#if loading}
						<div class="flex items-center justify-center gap-2">
							<div class="w-4 h-4 rounded-full border-2 animate-spin" style="border-color: var(--color-on-primary); border-top-color: transparent"></div>
							{t.recipe_import_loading}
						</div>
					{:else}
						{t.recipe_import_button}
					{/if}
				</button>
			{/if}
		</div>

	</div>
</div>
