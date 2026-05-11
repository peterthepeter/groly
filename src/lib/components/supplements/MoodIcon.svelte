<script lang="ts">
	import { Angry, Frown, Meh, Smile, Laugh } from 'lucide-svelte';

	const ICONS = { 1: Angry, 2: Frown, 3: Meh, 4: Smile, 5: Laugh };

	let {
		value,
		size = 24,
		style = ''
	}: {
		value: 1 | 2 | 3 | 4 | 5;
		size?: number;
		style?: string;
	} = $props();

	const Component = $derived(ICONS[value]);
</script>

<Component {size} {style} strokeWidth={1.7} />
