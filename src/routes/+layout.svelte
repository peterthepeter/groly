<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLanguage } from '$lib/i18n.svelte';

	let { children } = $props();

	onMount(initLanguage);
</script>

<svelte:head>
	<title>Groly</title>
</svelte:head>

<div class="max-w-[430px] mx-auto relative">
	{@render children()}
</div>
