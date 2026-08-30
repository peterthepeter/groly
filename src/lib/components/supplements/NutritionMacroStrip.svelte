<script lang="ts">
	let {
		items,
		accent = '#FB923C',
		compact = false
	}: {
		items: Array<{
			label: string;
			value: number;
			goal?: number | null;
			goalType?: 'min' | 'max';
			color?: string;
		}>;
		accent?: string;
		compact?: boolean;
	} = $props();

	function format(value: number): string {
		return value < 10 && value % 1 !== 0 ? value.toFixed(1) : Math.round(value).toString();
	}

	const palette = ['#A78BFA', '#FB923C', '#60A5FA', '#66BB7A'];
</script>

<div class="nutrition-macro-strip" data-compact={compact} style="--nutrition-accent: {accent}">
	{#each items as item, index}
		{@const goal = item.goal && item.goal > 0 ? item.goal : null}
		{@const ratio = goal ? item.value / goal : 0}
		{@const over = item.goalType === 'max' && goal && item.value > goal}
		<div class="nutrition-macro-cell" style="--nutrition-macro-color: {item.color ?? palette[index % palette.length]}">
			<span class="nutrition-macro-label">{item.label}</span>
			<span class="nutrition-macro-value" data-over={!!over}>
				{format(item.value)}<small>{goal ? ` / ${format(goal)}` : ''} g</small>
			</span>
			{#if goal}
				<span class="nutrition-macro-track" aria-hidden="true">
					<span data-over={!!over} style="width: {Math.min(100, ratio * 100)}%"></span>
				</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.nutrition-macro-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.nutrition-macro-cell {
		display: grid;
		min-width: 0;
		gap: 4px;
	}

	.nutrition-macro-label {
		overflow: hidden;
		color: var(--color-on-surface-variant);
		font-size: 9px;
		font-weight: 550;
		line-height: 1.1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nutrition-macro-value {
		overflow: hidden;
		color: var(--color-on-surface);
		font-size: 12px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nutrition-macro-value[data-over='true'] { color: var(--color-error); }

	.nutrition-macro-value small {
		color: var(--color-on-surface-variant);
		font-size: 9px;
		font-weight: 500;
	}

	.nutrition-macro-track {
		display: block;
		height: 2px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-on-surface) 9%, transparent);
	}

	.nutrition-macro-track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--nutrition-macro-color, var(--nutrition-accent));
		transition: width 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.nutrition-macro-track span[data-over='true'] { background: var(--color-error); }

	.nutrition-macro-strip[data-compact='true'] { gap: 5px; }
	.nutrition-macro-strip[data-compact='true'] .nutrition-macro-label { font-size: 8px; }
	.nutrition-macro-strip[data-compact='true'] .nutrition-macro-value { font-size: 10px; }
	.nutrition-macro-strip[data-compact='true'] .nutrition-macro-value small { font-size: 8px; }

	@media (max-width: 360px) {
		.nutrition-macro-strip { gap: 5px; }
		.nutrition-macro-label { font-size: 8px; }
		.nutrition-macro-value { font-size: 11px; }
	}
</style>
