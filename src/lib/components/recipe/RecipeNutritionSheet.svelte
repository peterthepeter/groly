<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import AddComponentSheet from '$lib/components/supplements/AddComponentSheet.svelte';
	import ManageSheetShell from '$lib/components/supplements/ManageSheetShell.svelte';
	import { t } from '$lib/i18n.svelte';

	type Comp = {
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
	};
	type Ingredient = { id: string; amount: string | null; unit: string | null; name: string };
	type Row = {
		ingredientId: string;
		label: string;
		suggestedAmount: number | null;
		suggestedUnit: 'g' | 'ml' | null;
		hint: string | null;
		skipped: boolean;
		comp: Comp | null;
	};

	let { recipeId, ingredients, servings, onclose, onsaved }: {
		recipeId: string;
		ingredients: Ingredient[];
		servings: number;
		onclose: () => void;
		onsaved?: () => void;
	} = $props();

	const ACCENT = '#FB923C';

	let rows = $state<Row[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let assignIndex = $state<number | null>(null);
	let draftRestored = $state(false);

	// Lokaler Entwurf: Fortschritt überlebt versehentliches Verlassen (Zurück-Geste, Tab zu).
	// Wird bei jeder Änderung geschrieben; bei „Speichern" und „Abbrechen"/„Verwerfen" gelöscht.
	const draftKey = $derived(`recipe_nutrition_draft:${recipeId}`);
	function saveDraft() {
		try {
			const payload = rows
				.filter((r) => r.comp || r.skipped)
				.map((r) => ({ ingredientId: r.ingredientId, skipped: r.skipped, comp: r.comp }));
			if (payload.length) localStorage.setItem(draftKey, JSON.stringify(payload));
			else localStorage.removeItem(draftKey);
		} catch { /* localStorage evtl. nicht verfügbar */ }
	}
	function clearDraft() {
		try { localStorage.removeItem(draftKey); } catch { /* noop */ }
	}

	// Ableitung der echten Menge (g/ml) aus dem freien Rezept-Text. „gr"/„kl" sind hier
	// Größenangaben (groß/klein), keine Einheiten — daher bewusst NICHT als Gramm gewertet.
	function parseIng(amount: string | null, unit: string | null, name: string) {
		const paren = name.match(/\((\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\)/i);
		if (paren) {
			let v = parseFloat(paren[1].replace(',', '.'));
			const u = paren[2].toLowerCase();
			if (u === 'kg') return { amount: v * 1000, unit: 'g' as const, hint: null };
			if (u === 'l') return { amount: v * 1000, unit: 'ml' as const, hint: null };
			return { amount: v, unit: u as 'g' | 'ml', hint: null };
		}
		const a = amount ? parseFloat(amount.replace(',', '.')) : null;
		const u = (unit ?? '').trim().toLowerCase().replace('.', '');
		if (a != null && Number.isFinite(a)) {
			if (u === 'g' || u === 'gramm') return { amount: a, unit: 'g' as const, hint: null };
			if (u === 'kg') return { amount: a * 1000, unit: 'g' as const, hint: null };
			if (u === 'ml') return { amount: a, unit: 'ml' as const, hint: null };
			if (u === 'l' || u === 'liter') return { amount: a * 1000, unit: 'ml' as const, hint: null };
			if (u === 'el' || u === 'essl' || u === 'esslöffel')
				return { amount: a * 15, unit: 'ml' as const, hint: `${amount} EL ≈ ${a * 15} ml` };
			if (u === 'tl' || u === 'teel' || u === 'teelöffel')
				return { amount: a * 5, unit: 'ml' as const, hint: `${amount} TL ≈ ${a * 5} ml` };
		}
		return { amount: null, unit: null, hint: null };
	}

	onMount(() => {
		void load();
		// Same-URL History-Eintrag, damit die iOS-Zurück-Geste erst dieses Sheet schließt
		// (statt das Rezept zu verlassen). Gleiches Muster wie auf der Tracker-Seite.
		try { history.pushState(null, '', location.href); } catch { /* noop */ }
	});

	// Zurück/Wische: erst die Lebensmittel-Auswahl, dann das Sheet schließen — nie die Seite verlassen.
	beforeNavigate(({ type, cancel }) => {
		if (type !== 'popstate') return;
		if (assignIndex != null) { assignIndex = null; cancel(); return; }
		cancel();
		onclose();
	});

	async function load() {
		const base: Row[] = ingredients.map((ing) => {
			const p = parseIng(ing.amount, ing.unit, ing.name);
			const label = `${ing.amount ?? ''}${ing.unit ? ' ' + ing.unit : ''} ${ing.name}`.trim();
			return {
				ingredientId: ing.id,
				label,
				suggestedAmount: p.amount,
				suggestedUnit: p.unit,
				hint: p.hint,
				skipped: false,
				comp: null
			};
		});
		try {
			const res = await fetch(`/api/nutrition/recipe-components?recipeId=${encodeURIComponent(recipeId)}`);
			if (res.ok) {
				const d = await res.json();
				// Mengen wurden für d.mappedServings Portionen gespeichert. Steht das Rezept jetzt auf
				// einer anderen Portionenzahl, skalieren wir die gespeicherten Mengen mit, damit
				// Beschriftung (live aus dem Rezept) und Zuordnung auf demselben Stand sind.
				const mapped = typeof d.mappedServings === 'number' && d.mappedServings > 0 ? d.mappedServings : servings;
				const factor = mapped > 0 && servings > 0 ? servings / mapped : 1;
				const byIng = new Map<string, any>();
				for (const c of d.components ?? []) if (c.ingredientId) byIng.set(c.ingredientId, c);
				for (const r of base) {
					const c = byIng.get(r.ingredientId);
					if (!c) continue;
					r.skipped = !!c.skipped;
					if (!c.skipped) {
						r.comp = {
							productBarcode: c.productBarcode ?? null,
							genericFoodId: c.genericFoodId ?? null,
							customName: c.customName ?? null,
							displayName: c.displayName,
							imageUrl: c.imageUrl ?? null,
							amount: factor === 1 ? c.amount : Math.round(c.amount * factor * 100) / 100,
							unit: c.unit,
							gramsPerPiece: c.gramsPerPiece ?? null,
							kcalPer100: c.kcalPer100 ?? null,
							proteinPer100: c.proteinPer100 ?? null,
							fatPer100: c.fatPer100 ?? null,
							carbsPer100: c.carbsPer100 ?? null,
							sugarPer100: c.sugarPer100 ?? null,
							fiberPer100: c.fiberPer100 ?? null,
							saltPer100: c.saltPer100 ?? null
						};
					}
				}
			}
		} catch { /* offline / leer */ }

		// Entwurf (lokal) hat Vorrang vor dem Server-Stand und überschreibt geänderte Zeilen.
		let applied = false;
		try {
			const raw = localStorage.getItem(draftKey);
			if (raw) {
				const draft = JSON.parse(raw) as { ingredientId: string; skipped: boolean; comp: Comp | null }[];
				const map = new Map(draft.map((d) => [d.ingredientId, d]));
				for (const r of base) {
					const d = map.get(r.ingredientId);
					if (d) { r.skipped = d.skipped; r.comp = d.comp; applied = true; }
				}
			}
		} catch { /* noop */ }
		draftRestored = applied;

		rows = base;
		loading = false;
	}

	function discardDraft() {
		clearDraft();
		draftRestored = false;
		loading = true;
		void load();
	}

	function cancelAndClose() {
		clearDraft();
		onclose();
	}

	function effGrams(c: Comp): number {
		return c.unit === 'piece' ? c.amount * (c.gramsPerPiece ?? 0) : c.amount;
	}
	function compKcal(c: Comp): number {
		return ((c.kcalPer100 ?? 0) * effGrams(c)) / 100;
	}

	const totalKcal = $derived(
		rows.reduce((s, r) => s + (r.comp && !r.skipped ? compKcal(r.comp) : 0), 0)
	);
	const totalProtein = $derived(
		rows.reduce((s, r) => s + (r.comp && !r.skipped ? ((r.comp.proteinPer100 ?? 0) * effGrams(r.comp)) / 100 : 0), 0)
	);
	const openCount = $derived(rows.filter((r) => !r.comp && !r.skipped).length);
	const perPortionKcal = $derived(servings > 0 ? Math.round(totalKcal / servings) : 0);
	const perPortionProtein = $derived(servings > 0 ? totalProtein / servings : 0);

	function openAssign(i: number) {
		assignIndex = i;
	}
	function onAssigned(c: Comp) {
		if (assignIndex == null) return;
		rows[assignIndex] = { ...rows[assignIndex], comp: c, skipped: false };
		rows = [...rows];
		assignIndex = null;
		saveDraft();
	}
	function toggleSkip(i: number) {
		const r = rows[i];
		rows[i] = { ...r, skipped: !r.skipped, comp: r.skipped ? r.comp : null };
		rows = [...rows];
		saveDraft();
	}

	async function save() {
		if (saving) return;
		saving = true;
		try {
			const components = rows.map((r, i) => ({
				ingredientId: r.ingredientId,
				skipped: r.skipped,
				sortOrder: i,
				displayName: r.comp?.displayName ?? (r.label.slice(0, 120) || '–'),
				productBarcode: r.comp?.productBarcode ?? null,
				genericFoodId: r.comp?.genericFoodId ?? null,
				customName: r.comp?.customName ?? null,
				imageUrl: r.comp?.imageUrl ?? null,
				amount: r.comp?.amount ?? 0,
				unit: r.comp?.unit ?? 'g',
				gramsPerPiece: r.comp?.gramsPerPiece ?? null,
				kcalPer100: r.comp?.kcalPer100 ?? null,
				proteinPer100: r.comp?.proteinPer100 ?? null,
				fatPer100: r.comp?.fatPer100 ?? null,
				carbsPer100: r.comp?.carbsPer100 ?? null,
				sugarPer100: r.comp?.sugarPer100 ?? null,
				fiberPer100: r.comp?.fiberPer100 ?? null,
				saltPer100: r.comp?.saltPer100 ?? null
			}))
			// nur Zeilen mit Zuordnung ODER bewusstem Überspringen speichern
			.filter((c) => c.skipped || c.kcalPer100 != null || c.productBarcode || c.genericFoodId);
			const res = await fetch('/api/nutrition/recipe-components', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ recipeId, components, mappedServings: servings })
			});
			if (res.ok) {
				clearDraft();
				saved = true;
				setTimeout(() => { onsaved?.(); onclose(); }, 600);
			}
		} finally {
			saving = false;
		}
	}
</script>

<ManageSheetShell accent={ACCENT} title={t.recipe_nutrition_title} subtitle={t.recipe_nutrition_assign_hint} {onclose} zIndex={61} maxHeight="92dvh">
	{#snippet body()}
		<div class="manage-stack">
		{#if draftRestored}
			<div class="recipe-draft-row"><span>{t.nutrition_draft_restored}</span><button type="button" onclick={discardDraft}>{t.nutrition_discard_draft}</button></div>
		{/if}
		<div>
		{#if loading}
			<div class="flex justify-center py-10">
				<div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color: {ACCENT}; border-top-color: transparent"></div>
			</div>
		{:else if rows.length === 0}
			<p class="text-center text-sm py-8" style="color: var(--color-on-surface-variant)">{t.recipe_no_ingredients}</p>
		{:else}
			<div class="rounded-2xl overflow-hidden"
			     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				{#each rows as row, i (row.ingredientId)}
					{#if i > 0}
						<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
					{/if}
					<div class="flex items-center gap-2.5 px-3 py-2.5 min-w-0">
						<!-- Status -->
						<div class="shrink-0">
							{#if row.skipped}
								<div class="w-6 h-6 rounded-full flex items-center justify-center"
								     style="border: 1.5px solid var(--color-outline)">
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
								</div>
							{:else if row.comp}
								<div class="w-6 h-6 rounded-full flex items-center justify-center" style="background-color: {ACCENT}">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								</div>
							{:else}
								<div class="w-6 h-6 rounded-full" style="border: 1.5px solid var(--color-outline)"></div>
							{/if}
						</div>

						<!-- Main: tap to assign -->
						<button onclick={() => openAssign(i)} class="flex-1 min-w-0 text-left active:opacity-60">
							<div class="text-sm truncate"
							     style="color: var(--color-on-surface); text-decoration: {row.skipped ? 'line-through' : 'none'}; opacity: {row.skipped ? 0.6 : 1}">
								{row.label}
							</div>
							{#if row.comp && !row.skipped}
								<div class="text-xs truncate" style="color: {ACCENT}">
									{row.comp.displayName} · {row.comp.amount}{row.comp.unit === 'piece' ? ' ' + t.nutrition_unit_short_piece : row.comp.unit} · {Math.round(compKcal(row.comp))} kcal
								</div>
							{:else if row.skipped}
								<div class="text-xs" style="color: var(--color-on-surface-variant)">{t.recipe_nutrition_skipped}</div>
							{:else}
								<div class="text-xs" style="color: var(--color-on-surface-variant)">
									{t.recipe_nutrition_tap_assign}{#if row.hint} · {row.hint}{/if}
								</div>
							{/if}
						</button>

						<!-- Skip toggle -->
						<button onclick={() => toggleSkip(i)}
						        class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60"
						        style="color: {row.skipped ? ACCENT : 'var(--color-on-surface-variant)'}"
						        aria-label={t.recipe_nutrition_skip} title={t.recipe_nutrition_skip}>
							{#if row.skipped}
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M9 12l2 2 4-4"/></svg>
							{:else}
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{/if}
		</div>
		<section class="manage-section recipe-nutrition-summary">
			<span>{#if openCount > 0}{openCount} {t.recipe_nutrition_open_remaining}{:else}{t.recipe_nutrition_complete}{/if}</span>
			<strong>{perPortionKcal} kcal · {perPortionProtein.toFixed(1)} g {t.nutrition_protein}</strong>
			<small>{t.recipe_nutrition_total} {Math.round(totalKcal)} kcal · {t.recipe_nutrition_for} {servings} {t.recipe_nutrition_portions}</small>
		</section>
		</div>
	{/snippet}
	{#snippet footer()}
		<button type="button" class="manage-secondary" onclick={cancelAndClose}>{t.nutrition_cancel}</button>
		<button type="button" class="manage-primary disabled:opacity-40" onclick={save} disabled={saving}>{saved ? '✓' : saving ? '…' : t.nutrition_save}</button>
	{/snippet}
</ManageSheetShell>

{#if assignIndex != null}
	<AddComponentSheet
		initial={rows[assignIndex].comp}
		suggestedAmount={rows[assignIndex].comp ? null : rows[assignIndex].suggestedAmount}
		suggestedUnit={rows[assignIndex].comp ? null : rows[assignIndex].suggestedUnit}
		onclose={() => (assignIndex = null)}
		onadd={onAssigned}
	/>
{/if}

<style>
	.recipe-draft-row { display: flex; min-height: 40px; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border: 1px solid color-mix(in srgb, #FB923C 28%, transparent); border-radius: 12px; background: color-mix(in srgb, #FB923C 7%, transparent); color: var(--color-on-surface-variant); font-size: 11px; }
	.recipe-draft-row button { min-height: 32px; color: #FB923C; font-weight: 650; }
	.recipe-nutrition-summary { display: grid; gap: 2px; padding: 10px 12px; text-align: right; }
	.recipe-nutrition-summary span, .recipe-nutrition-summary small { color: var(--color-on-surface-variant); font-size: 11px; }
	.recipe-nutrition-summary strong { color: #FB923C; font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; }
</style>
