<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import type { CaffeineDrink } from '$lib/db/schema';
	import CaffeineDrinkPickerContent from './CaffeineDrinkPickerContent.svelte';

	let {
		open = $bindable<boolean>(false),
		drinks,
		onlogged,
		preselectedDrink = null,
		logDate = null as string | null
	}: {
		open: boolean;
		drinks: CaffeineDrink[];
		onlogged: () => void;
		preselectedDrink?: CaffeineDrink | null;
		logDate?: string | null;
	} = $props();

	function close() {
		open = false;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={close}></div>

	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--modal-bg)">
		<div class="px-6 pt-5 pb-5 flex flex-col gap-4">

			<div class="flex justify-center">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>

			<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.caffeine_drink_picker_title}</p>

			<CaffeineDrinkPickerContent
				{drinks}
				{preselectedDrink}
				{logDate}
				showCancel
				oncancel={close}
				onlogged={() => { close(); onlogged(); }}
			/>
		</div>
	</div>
{/if}
