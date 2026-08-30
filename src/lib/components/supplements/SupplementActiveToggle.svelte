<script lang="ts">
	let {
		active,
		label,
		onclick,
		accent = 'var(--color-primary)'
	}: {
		active: boolean;
		label: string;
		onclick: () => void;
		accent?: string;
	} = $props();
</script>

<button
	type="button"
	{onclick}
	class="h-5 w-10 shrink-0 rounded-full transition-colors"
	style="background-color: {active ? accent : 'var(--color-surface-container)'}"
	aria-label={label}
	aria-pressed={active}
></button>
