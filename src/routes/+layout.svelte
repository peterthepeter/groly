<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Groly</title>
</svelte:head>

{@render children()}
