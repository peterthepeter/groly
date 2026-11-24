<script lang="ts">
	let { label, disabled, onsave }: { label: string; disabled: boolean; onsave: () => void } = $props();
</script>

<footer>
	<button type="button" {disabled} onclick={onsave}>{label}</button>
</footer>

<style>
	footer {
		flex-shrink: 0;
		padding: 8px 16px calc(var(--recipe-form-bottom-inset, 0px) + 16px);
		background: var(--color-bg);
	}
	button {
		width: 100%;
		min-height: 52px;
		padding: 8px 16px;
		border-radius: 999px;
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim));
		color: var(--color-on-primary);
		font-size: 14px;
		font-weight: 650;
	}
	button:disabled { background: var(--color-surface-container); color: var(--color-on-surface-variant); }
</style>
