<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n.svelte';

	type Ingredient = { id: string; amount: string; unit: string; name: string };
	type Step = { id: string; text: string };

	function uid() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

	const recipeId = $derived($page.params.id);

	let title = $state('');
	let description = $state('');
	let imageUrl = $state<string | null>(null);
	let sourceUrl = $state<string | null>(null);
	let servings = $state(4);
	let prepTime = $state('');
	let cookTime = $state('');
	let ingredients = $state<Ingredient[]>([]);
	let steps = $state<Step[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');

	// Image state
	let imageFileInput = $state<HTMLInputElement | null>(null);
	let imagePreview = $state<string | null>(null);
	let imageUploading = $state(false);
	let imageUploadError = $state('');

	async function handleImageSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		imageUploading = true;
		imageUploadError = '';

		imagePreview = await readAsDataUrl(file);

		let uploadBlob: Blob = file;
		try {
			uploadBlob = await compressImage(file, 800, 0.78);
		} catch {
			// Compression not supported — fall back to original file
		}

		try {
			const fd = new FormData();
			fd.append('image', uploadBlob, 'photo.jpg');
			const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
			if (res.ok) {
				imageUrl = (await res.json()).url;
			} else {
				const body = await res.json().catch(() => ({}));
				imageUploadError = body.error ?? 'Upload failed';
			}
		} catch {
			imageUploadError = 'Network error';
		}
		imageUploading = false;
	}

	async function compressImage(file: File, maxPx: number, quality: number): Promise<Blob> {
		const bitmap = await createImageBitmap(file, { resizeWidth: maxPx, resizeQuality: 'medium' });
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
		bitmap.close();
		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
				'image/jpeg',
				quality
			);
		});
	}

	function readAsDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function loadRecipe() {
		try {
			const res = await fetch(`/api/recipes/${recipeId}`);
			if (!res.ok) {
				error = `Fehler beim Laden (${res.status})`;
				loading = false;
				return;
			}
			const data = await res.json();
			title = data.title ?? '';
			description = data.description ?? '';
			imageUrl = data.imageUrl ?? null;
			sourceUrl = data.sourceUrl ?? null;
			servings = data.servings ?? 4;
			prepTime = data.prepTime ? String(data.prepTime) : '';
			cookTime = data.cookTime ? String(data.cookTime) : '';
			ingredients = (data.ingredients ?? []).map((i: any) => ({
				id: i.id ?? uid(),
				amount: i.amount ?? '',
				unit: i.unit ?? '',
				name: i.name ?? ''
			}));
			if (ingredients.length === 0) ingredients = [{ id: uid(), amount: '', unit: '', name: '' }];
			steps = (data.steps ?? []).map((s: any) => ({
				id: uid(),
				text: s.text ?? ''
			}));
			if (steps.length === 0) steps = [{ id: uid(), text: '' }];
		} catch (e) {
			console.error('loadRecipe error:', e);
			error = 'Verbindungsfehler beim Laden';
		}
		loading = false;
	}

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

	function autoResize(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	function growTextarea(el: HTMLTextAreaElement) {
		autoResize(el);
		const handler = () => autoResize(el);
		el.addEventListener('input', handler);
		return { destroy() { el.removeEventListener('input', handler); } };
	}

	async function save() {
		if (!title.trim() || saving || imageUploading) return;
		saving = true;
		error = '';
		try {
			const res = await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || null,
					imageUrl,
					sourceUrl,
					servings,
					prepTime: prepTime ? parseInt(prepTime) : null,
					cookTime: cookTime ? parseInt(cookTime) : null,
					ingredients: ingredients
						.filter(i => i.name.trim())
						.map(i => ({ id: i.id, amount: i.amount.trim() || null, unit: i.unit.trim() || null, name: i.name.trim() })),
					steps: steps
						.filter(s => s.text.trim())
						.map(s => ({ text: s.text.trim() }))
				})
			});
			if (res.ok) {
				goto(`/rezepte/${recipeId}`);
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

	onMount(() => loadRecipe());
</script>

<div class="h-[100dvh] flex flex-col" style="background-color: var(--color-bg)">

	<!-- Header -->
	<div class="fixed top-0 left-0 right-0 z-40 max-w-[430px] mx-auto px-4 pb-2"
	     style="padding-top: calc(env(safe-area-inset-top) + 1rem)">
		<div class="flex items-center justify-between rounded-2xl px-4 py-3"
		     style="background-color: var(--color-surface-low)">
			<button
				onclick={() => goto(`/rezepte/${recipeId}`)}
				class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
				style="background-color: var(--color-surface-high)"
				aria-label="Zurück"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"/>
				</svg>
			</button>
			<span class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.recipe_edit_title}</span>
		</div>
	</div>

	{#if loading && !error}
		<div class="flex-1 flex items-center justify-center">
			<div class="w-6 h-6 rounded-full border-2 animate-spin"
			     style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if error && !title}
		<div class="flex-1 flex flex-col items-center justify-center gap-4 px-6">
			<p class="text-sm text-center" style="color: var(--color-error)">{error}</p>
			<button onclick={() => goto(`/rezepte/${recipeId}`)}
			        class="px-6 py-2.5 rounded-full text-sm font-semibold"
			        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface)">Zurück</button>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto px-4 space-y-3"
		     style="padding-top: calc(env(safe-area-inset-top) + 5.25rem); padding-bottom: 6rem">

			<!-- Bild -->
			<input bind:this={imageFileInput} type="file" accept="image/*"
			       style="display:none" onchange={handleImageSelect} />
			<div class="rounded-2xl overflow-hidden relative" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<button type="button" onclick={() => imageFileInput?.click()}
				        class="w-full text-left active:opacity-75">
					{#if imagePreview || imageUrl}
						<img src={imagePreview ?? imageUrl} alt="Rezeptbild" class="w-full object-cover" style="max-height: 200px" />
						{#if imageUploading}
							<div class="absolute inset-0 flex items-center justify-center" style="background: rgba(0,0,0,0.35)">
								<div class="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
							</div>
						{/if}
						{#if imageUploadError}
							<div class="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg text-xs font-medium" style="background: rgba(180,0,0,0.75); color: white">
								{imageUploadError}
							</div>
						{/if}
						<div class="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg text-xs font-medium" style="background: rgba(0,0,0,0.55); color: white">
							{t.recipe_change_image}
						</div>
					{:else}
						<div class="flex items-center gap-3 px-4 py-3.5">
							<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: var(--color-surface-high)">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
									<polyline points="21 15 16 10 5 21"/>
								</svg>
							</div>
							<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.recipe_add_image}</span>
						</div>
					{/if}
				</button>
			</div>

			<!-- Block 1: Name + Beschreibung + Portionen/Zeiten -->
			<div class="rounded-2xl" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<div class="px-4 pt-4 pb-2">
					<input
						type="text"
						placeholder={t.recipe_name_placeholder}
						bind:value={title}
						class="w-full bg-transparent outline-none font-semibold"
						style="color: var(--color-on-surface); font-size: 16px; border: none"
					/>
				</div>
				<div class="px-4 pb-3">
					<textarea
						placeholder={t.recipe_description_placeholder}
						bind:value={description}
						rows="1"
						class="w-full bg-transparent outline-none resize-none"
						style="color: var(--color-on-surface-variant); font-size: 16px; border: none"
					></textarea>
				</div>
				<!-- Portionen + Zeiten -->
				<div class="px-4 pb-3" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: center">
					<div style="display: flex; align-items: center; gap: 5px">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
						</svg>
						<button onclick={() => { if (servings > 1) servings--; }} aria-label="Portionen verringern"
						        style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background-color:var(--color-surface-high)"
						        class="active:opacity-60">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
						<span style="font-size:13px;font-weight:700;min-width:14px;text-align:center;color:var(--color-on-surface)">{servings}</span>
						<button onclick={() => servings++} aria-label="Portionen erhöhen"
						        style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background-color:var(--color-surface-high)"
						        class="active:opacity-60">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
					</div>
					<div style="display:flex;align-items:center;gap:4px;justify-content:center">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
							<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
						</svg>
						<input type="number" placeholder={t.recipe_prep_min_placeholder} bind:value={prepTime} min="0"
						       class="bg-transparent outline-none"
						       style="color:var(--color-on-surface);font-size:14px;width:0;flex:1;min-width:0;border:none" />
					</div>
					<div style="display:flex;align-items:center;gap:4px;justify-content:flex-end">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
							<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
						</svg>
						<input type="number" placeholder={t.recipe_cook_min_placeholder} bind:value={cookTime} min="0"
						       class="bg-transparent outline-none"
						       style="color:var(--color-on-surface);font-size:14px;width:0;flex:1;min-width:0;border:none" />
					</div>
				</div>
			</div>

			<!-- Zutaten -->
			<div class="rounded-2xl" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<div class="flex items-center justify-between px-4 pt-3 pb-1">
					<h2 class="text-sm font-bold" style="color: var(--color-on-surface)">{t.recipe_ingredients}</h2>
					<button onclick={addIngredient} class="flex items-center gap-1 text-xs font-semibold active:opacity-60" style="color: var(--color-primary)">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
						{t.recipe_add_ingredient}
					</button>
				</div>
				{#each ingredients as ing (ing.id)}
					<div style="display:grid;grid-template-columns:52px 56px 1fr auto;align-items:center;gap:0;padding:0 12px 0 16px">
						<input type="text" placeholder={t.recipe_amount_placeholder} bind:value={ing.amount}
						       class="bg-transparent outline-none text-right pr-3"
						       style="color:var(--color-on-surface);font-size:15px;height:38px;border:none;min-width:0" />
						<input type="text" placeholder={t.recipe_unit_placeholder} bind:value={ing.unit}
						       class="bg-transparent outline-none"
						       style="color:var(--color-on-surface-variant);font-size:15px;height:38px;border:none;min-width:0" />
						<input type="text" placeholder={t.recipe_ingredient_placeholder} bind:value={ing.name}
						       class="bg-transparent outline-none"
						       style="color:var(--color-on-surface);font-size:15px;height:38px;border:none;min-width:0" />
						{#if ingredients.length > 1}
							<button onclick={() => removeIngredient(ing.id)} aria-label="Zutat entfernen"
							        class="flex items-center justify-center active:opacity-60"
							        style="width:28px;height:38px;flex-shrink:0">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2.5" stroke-linecap="round">
									<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
								</svg>
							</button>
						{:else}
							<div style="width:28px"></div>
						{/if}
					</div>
				{/each}
				<div class="h-2"></div>
			</div>

			<!-- Schritte -->
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
							<div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-2"
							     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
								<span class="text-xs font-bold" style="color: var(--color-on-primary)">{i + 1}</span>
							</div>
							<textarea
								placeholder={t.recipe_step_placeholder}
								bind:value={step.text}
								rows="1"
								use:growTextarea
								class="flex-1 rounded-xl px-3 py-2.5 outline-none resize-none"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; border: none; overflow: hidden"
							></textarea>
							{#if steps.length > 1}
								<button onclick={() => removeStep(step.id)} aria-label="Schritt entfernen"
								        class="flex items-center justify-center active:opacity-60 mt-1"
								        style="width:32px;height:32px;flex-shrink:0">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2.5" stroke-linecap="round">
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

		<!-- Speichern-Button -->
		<div class="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto px-4 z-30"
		     style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
			<button
				onclick={save}
				disabled={!title.trim() || saving || imageUploading}
				class="w-full py-4 rounded-full font-semibold text-sm disabled:opacity-40 active:scale-95 transition-transform shadow-lg"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{imageUploading ? t.recipe_saving : saving ? t.recipe_saving : t.recipe_save_changes}
			</button>
		</div>
	{/if}
</div>
