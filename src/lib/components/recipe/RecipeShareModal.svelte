<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	let { recipeId, open, onClose }: {
		recipeId: string;
		open: boolean;
		onClose: () => void;
	} = $props();

	let shareUsername = $state('');
	let shareLoading = $state(false);
	let shareError = $state('');
	let shareSuccess = $state(false);

	async function shareRecipe() {
		if (!shareUsername.trim() || shareLoading) return;
		shareLoading = true;
		shareError = '';
		try {
			const res = await fetch(`/api/recipes/${recipeId}/share`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: shareUsername.trim() })
			});
			const data = await res.json();
			if (!res.ok) {
				shareError = data.error ?? 'Fehler beim Teilen';
			} else {
				shareSuccess = true;
				shareUsername = '';
				setTimeout(() => { shareSuccess = false; onClose(); }, 1500);
			}
		} finally {
			shareLoading = false;
		}
	}

	function handleOpen() {
		shareError = '';
		shareSuccess = false;
	}

	$effect(() => {
		if (open) handleOpen();
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color: rgba(0,0,0,0.6)"
	     onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
		<div class="w-full max-w-[430px] rounded-t-3xl px-6 pb-10 pt-4"
		     style="background-color: var(--color-surface-low)">
			<div class="flex justify-center mb-5">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<h2 class="text-lg font-bold mb-4" style="color: var(--color-on-surface)">{t.recipe_share_title}</h2>
			{#if shareSuccess}
				<div class="text-center py-6">
					<div class="text-4xl mb-2">✓</div>
					<p class="text-sm font-medium" style="color: var(--color-primary)">{t.recipe_share_sent}</p>
				</div>
			{:else}
				<div class="flex gap-2">
					<div class="flex-1 flex items-center px-4 rounded-xl" style="background-color: var(--color-surface-container); height: 52px">
						<input
							type="text"
							placeholder={t.recipe_username_placeholder}
							bind:value={shareUsername}
							onkeydown={(e) => e.key === 'Enter' && shareRecipe()}
							class="w-full bg-transparent outline-none"
							style="color: var(--color-on-surface); font-size: 16px"
						/>
					</div>
					<button
						onclick={shareRecipe}
						disabled={!shareUsername.trim() || shareLoading}
						class="px-5 rounded-xl font-semibold text-sm disabled:opacity-40"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary); height: 52px"
					>
						{shareLoading ? '…' : t.recipe_share_send}
					</button>
				</div>
				{#if shareError}
					<p class="text-xs mt-2" style="color: var(--color-error)">{shareError}</p>
				{/if}
			{/if}
		</div>
	</div>
{/if}
