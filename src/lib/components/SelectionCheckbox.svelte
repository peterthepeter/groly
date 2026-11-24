<script lang="ts">
	let { label, checked, disabled = false, onchange }: {
		label: string;
		checked: boolean;
		disabled?: boolean;
		onchange: () => void;
	} = $props();
</script>

<input type="checkbox" {checked} {disabled} {onchange} aria-label={label} />
<span aria-hidden="true">
	{#if checked}
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	{/if}
</span>

<style>
	input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
	span { display: flex; width: 18px; height: 18px; flex: none; align-items: center; justify-content: center; border: 1.5px solid var(--color-outline); border-radius: 5px; }
	input:checked + span { background-color: var(--color-primary); border-color: var(--color-primary); }
	input:focus-visible + span { outline: 2px solid var(--color-primary); outline-offset: 3px; }
</style>
