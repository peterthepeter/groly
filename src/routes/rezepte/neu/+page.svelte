<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';

	type Ingredient = { id: string; amount: string; unit: string; name: string };
	type Step = { id: string; text: string };

	function uid() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

	let title = $state('');
	let description = $state('');
	let servings = $state(4);
	let prepTime = $state('');
	let cookTime = $state('');
	let ingredients = $state<Ingredient[]>([{ id: uid(), amount: '', unit: '', name: '' }]);
	let steps = $state<Step[]>([{ id: uid(), text: '' }]);
	let saving = $state(false);
	let error = $state('');

	function addIngredient() {
		ingredients = [...ingredients, { id: uid(), amount: '', unit: '', name: '' }];
	}

	function removeIngredient(id: string) {
		if (ingredients.length <= 1) return;
		ingredients = ingredients.filter(i => i.id !== id);
	}

	function addStep() {
		steps = [...steps, { id: uid(), text: '' }];
	}

	function removeStep(id: string) {
		if (steps.length <= 1) return;
		steps = steps.filter(s => s.id !== id);
	}

	async function save() {
		if (!title.trim() || saving) return;
		saving = true;
		error = '';
		try {
			const res = await fetch('/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || null,
					servings,
					prepTime: prepTime ? parseInt(prepTime) : null,
					cookTime: cookTime ? parseInt(cookTime) : null,
					ingredients: ingredients
						.filter(i => i.name.trim())
						.map(i => ({ amount: i.amount.trim() || null, unit: i.unit.trim() || null, name: i.name.trim() })),
					steps: steps
						.filter(s => s.text.trim())
						.map(s => ({ text: s.text.trim() }))
				})
			});
			if (res.ok) {
				const data = await res.json();
				goto(`/rezepte/${data.id}`);
			} else {
				const data = await res.json();
				error = data.error ?? 'Fehler beim Speichern';
				saving = false;
			}
		} catch {
			error = 'Verbindungsfehler';
			saving = false;
		}
	}
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<!-- Header -->
	<div class="fixed top-0 left-0 right-0 z-40 max-w-[430px] mx-auto px-4 pb-2"
	     style="padding-top: calc(env(safe-area-inset-top) + 1rem)">
		<div class="flex items-center justify-between rounded-2xl px-4 py-3"
		     style="background-color: var(--color-surface-low)">
			<button
				onclick={() => goto('/rezepte')}
				class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
				style="background-color: var(--color-surface-high)"
				aria-label="Zurück"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"/>
				</svg>
			</button>
			<div class="text-right">
				<div class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.recipe_new_title}</div>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto px-4 space-y-4"
	     style="padding-top: calc(env(safe-area-inset-top) + 5.5rem); padding-bottom: 6rem">

		<!-- Title -->
		<div>
			<div class="flex items-center px-4 rounded-xl" style="background-color: var(--color-surface-container); height: 52px">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					placeholder={t.recipe_name_placeholder}
					bind:value={title}
					autofocus
					class="w-full bg-transparent outline-none font-semibold"
					style="color: var(--color-on-surface); font-size: 16px"
				/>
			</div>
		</div>

		<!-- Description -->
		<div class="px-4 py-3 rounded-xl" style="background-color: var(--color-surface-container)">
			<textarea
				placeholder={t.recipe_description_placeholder}
				bind:value={description}
				rows="2"
				class="w-full bg-transparent outline-none resize-none"
				style="color: var(--color-on-surface); font-size: 16px"
			></textarea>
		</div>

		<!-- Servings + Times -->
		<div class="flex gap-2">
			<div class="flex items-center gap-2 flex-1 px-3 rounded-xl" style="background-color: var(--color-surface-container); height: 52px">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
				</svg>
				<button onclick={() => { if (servings > 1) servings--; }} aria-label="Portionen verringern" class="w-7 h-7 rounded-full flex items-center justify-center active:opacity-60" style="background-color: var(--color-surface-high)">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
				<span class="text-sm font-bold w-4 text-center" style="color: var(--color-on-surface)">{servings}</span>
				<button onclick={() => servings++} aria-label="Portionen erhöhen" class="w-7 h-7 rounded-full flex items-center justify-center active:opacity-60" style="background-color: var(--color-surface-high)">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
			</div>
			<div class="flex items-center gap-2 px-3 rounded-xl" style="background-color: var(--color-surface-container); height: 52px; flex: 1">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
				</svg>
				<input type="number" placeholder={t.recipe_prep_min_placeholder} bind:value={prepTime} min="0"
				       class="w-full bg-transparent outline-none" style="color: var(--color-on-surface); font-size: 16px" />
			</div>
			<div class="flex items-center gap-2 px-3 rounded-xl" style="background-color: var(--color-surface-container); height: 52px; flex: 1">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
				</svg>
				<input type="number" placeholder={t.recipe_cook_min_placeholder} bind:value={cookTime} min="0"
				       class="w-full bg-transparent outline-none" style="color: var(--color-on-surface); font-size: 16px" />
			</div>
		</div>

		<!-- Ingredients -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<h2 class="text-sm font-bold" style="color: var(--color-on-surface)">{t.recipe_ingredients}</h2>
				<button onclick={addIngredient} class="flex items-center gap-1 text-xs font-semibold active:opacity-60" style="color: var(--color-primary)">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					{t.recipe_add_ingredient}
				</button>
			</div>
			<div class="space-y-2">
				{#each ingredients as ing, i (ing.id)}
					<div class="flex gap-1.5 items-center">
						<input type="text" placeholder={t.recipe_amount_placeholder} bind:value={ing.amount}
						       class="rounded-xl px-3 bg-transparent outline-none text-center"
						       style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 44px; width: 64px; flex-shrink: 0" />
						<input type="text" placeholder={t.recipe_unit_placeholder} bind:value={ing.unit}
						       class="rounded-xl px-3 bg-transparent outline-none"
						       style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 44px; width: 72px; flex-shrink: 0" />
						<input type="text" placeholder={t.recipe_ingredient_placeholder} bind:value={ing.name}
						       class="flex-1 rounded-xl px-3 bg-transparent outline-none"
						       style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 44px" />
						{#if ingredients.length > 1}
							<button onclick={() => removeIngredient(ing.id)}
							        aria-label="Zutat entfernen"
							        class="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 active:opacity-60"
							        style="background-color: color-mix(in srgb, var(--color-error) 12%, var(--color-surface-container))">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round">
									<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Steps -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<h2 class="text-sm font-bold" style="color: var(--color-on-surface)">{t.recipe_instructions}</h2>
				<button onclick={addStep} class="flex items-center gap-1 text-xs font-semibold active:opacity-60" style="color: var(--color-primary)">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					{t.recipe_add_step}
				</button>
			</div>
			<div class="space-y-2">
				{#each steps as step, i (step.id)}
					<div class="flex gap-2 items-start">
						<div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-2.5"
						     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
							<span class="text-xs font-bold" style="color: var(--color-on-primary)">{i + 1}</span>
						</div>
						<textarea
							placeholder={t.recipe_step_placeholder}
							bind:value={step.text}
							rows="2"
							class="flex-1 rounded-xl px-3 py-2.5 bg-transparent outline-none resize-none"
							style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
						></textarea>
						{#if steps.length > 1}
							<button onclick={() => removeStep(step.id)}
							        aria-label="Schritt entfernen"
							        class="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-1 active:opacity-60"
							        style="background-color: color-mix(in srgb, var(--color-error) 12%, var(--color-surface-container))">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round">
									<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if error}
			<p class="text-sm" style="color: var(--color-error)">{error}</p>
		{/if}
	</div>

	<!-- Sticky Save Bar -->
	<div class="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto px-4 z-30"
	     style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
		<button
			onclick={save}
			disabled={!title.trim() || saving}
			class="w-full py-4 rounded-full font-semibold text-sm disabled:opacity-40 transition-opacity active:scale-95 transition-transform shadow-lg"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			{saving ? t.recipe_saving : t.recipe_save}
		</button>
	</div>
</div>
