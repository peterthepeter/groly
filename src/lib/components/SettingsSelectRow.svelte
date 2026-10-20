<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	let { label, value, options, onchange, icon, preview, optionPreview, footer, keepOpenOnSelect = false, compact = false }: {
		label: string;
		value: string;
		options: { value: string; label: string }[];
		onchange: (value: string) => void;
		icon?: Snippet;
		preview?: Snippet;
		optionPreview?: Snippet<[string]>;
		footer?: Snippet;
		keepOpenOnSelect?: boolean;
		compact?: boolean;
	} = $props();
	const id = $props.id();
	let trigger: HTMLButtonElement;
	let menu: HTMLDivElement;
	let open = $state(false);
	let keyboardOpened = false;
	const selectedLabel = $derived(options.find(option => option.value === value)?.label ?? value);

	function positionMenu() {
		if (!menu?.matches(':popover-open')) return;
		const bounds = trigger.getBoundingClientRect();
		const viewport = window.visualViewport;
		const left = viewport?.offsetLeft ?? 0;
		const top = viewport?.offsetTop ?? 0;
		const width = viewport?.width ?? window.innerWidth;
		const height = viewport?.height ?? window.innerHeight;
		const menuWidth = menu.offsetWidth;
		const menuHeight = menu.offsetHeight;
		const below = bounds.bottom + 6;
		const preferredTop = below + menuHeight <= top + height - 12 ? below : bounds.top - menuHeight - 6;
		menu.style.left = `${Math.max(left + 12, Math.min(bounds.right - menuWidth, left + width - menuWidth - 12))}px`;
		menu.style.top = `${Math.max(top + 12, Math.min(preferredTop, top + height - menuHeight - 12))}px`;
	}
	function focusOption(last = false) {
		const buttons = menu.querySelectorAll<HTMLButtonElement>('[data-setting-option]');
		const selected = menu.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
		(last ? buttons[buttons.length - 1] : selected ?? buttons[0])?.focus({ preventScroll: true });
	}
	function showMenu(keyboard = false, last = false) {
		keyboardOpened = keyboard;
		menu.showPopover();
		positionMenu();
		const selected = menu.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
		if (selected) menu.scrollTop = Math.max(0, selected.offsetTop - menu.clientHeight / 2);
		if (keyboard) void tick().then(() => focusOption(last));
	}
	function closeMenu() {
		menu.hidePopover();
		if (keyboardOpened) trigger.focus({ preventScroll: true });
	}
	function selectValue(next: string) {
		onchange(next);
		if (!keepOpenOnSelect) closeMenu();
	}
	function onTriggerKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			showMenu(true, event.key === 'ArrowUp');
		}
	}
	function onMenuKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const buttons = [...menu.querySelectorAll<HTMLButtonElement>('[data-setting-option]')];
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (index < 0) return;
		event.preventDefault();
		const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
			: (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
		buttons[target]?.focus({ preventScroll: true });
	}
	$effect(() => {
		if (!open) return;
		const observer = new ResizeObserver(positionMenu);
		observer.observe(menu);
		const onScroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.contains(event.target)) closeMenu(); };
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', positionMenu);
		window.visualViewport?.addEventListener('resize', positionMenu);
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', positionMenu);
			window.visualViewport?.removeEventListener('resize', positionMenu);
		};
	});
</script>

<button
	type="button"
	class="settings-select-row"
	class:compact
	bind:this={trigger}
	aria-label={`${label}: ${selectedLabel}`}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls={id}
	onclick={(event) => { if (open) closeMenu(); else showMenu(event.detail === 0); }}
	onkeydown={onTriggerKeyDown}
>
	<span class="settings-select-label">
		{#if icon}<span class="settings-select-icon" aria-hidden="true">{@render icon()}</span>{/if}
		<span>{label}</span>
	</span>
	<span class="settings-select-value">
		{#if preview}<span class="settings-select-preview" aria-hidden="true">{@render preview()}</span>{/if}
		<span>{selectedLabel}</span>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
	</span>
</button>

<div id={id} bind:this={menu} class="settings-select-menu" popover="auto" role="dialog" aria-label={label} tabindex="-1" ontoggle={(event) => { open = event.newState === 'open'; }} onkeydown={onMenuKeyDown}>
	<div role="group" aria-label={label} class="settings-select-options">
		{#each options as option (option.value)}
			<button type="button" data-setting-option aria-pressed={option.value === value} onclick={() => selectValue(option.value)}>
				{#if optionPreview}<span class="settings-select-option-preview" aria-hidden="true">{@render optionPreview(option.value)}</span>{/if}
				<span class="settings-select-option-label">{option.label}</span>
				<span class="settings-select-check" aria-hidden="true">
					{#if option.value === value}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6" /></svg>{/if}
				</span>
			</button>
		{/each}
	</div>
	{#if footer}<div class="settings-select-footer">{@render footer()}</div>{/if}
</div>

<style>
	.settings-select-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 8px 20px; text-align: left; color: var(--color-on-surface); }
	.settings-select-row.compact { width: auto; padding: 8px; }
	.compact .settings-select-label { display: none; }
	.compact .settings-select-value { max-width: none; }
	.settings-select-label { display: flex; align-items: center; flex: 1; gap: 12px; min-width: 0; font-size: 14px; font-weight: 550; line-height: 1.4; }
	.settings-select-icon { flex: none; color: var(--color-on-surface-variant); }
	.settings-select-value { display: flex; align-items: center; flex: none; gap: 8px; max-width: 54%; font-size: 14px; color: var(--color-on-surface-variant); }
	.settings-select-value > span:last-of-type { min-width: 0; overflow-wrap: anywhere; }
	.settings-select-preview, .settings-select-option-preview { display: flex; align-items: center; flex: none; }
	.settings-select-row:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.settings-select-row:active { background: var(--bubble-interactive-bg); }
	.settings-select-menu { position: fixed; inset: auto; margin: 0; width: max-content; max-width: min(320px, calc(100vw - 24px)); max-height: min(360px, calc(100dvh - 24px)); padding: 5px; overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--bubble-container-border); border-radius: 14px; background: var(--modal-bg); color: var(--color-on-surface); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.24); }
	.settings-select-options button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 9px; text-align: left; font-size: 14px; font-weight: 500; }
	.settings-select-option-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
	.settings-select-check { display: flex; align-items: center; flex: none; width: 18px; height: 18px; }
	.settings-select-options button[aria-pressed="true"] { color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
	.settings-select-options button:active { background: var(--bubble-interactive-bg); }
	.settings-select-options button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
	.settings-select-footer { margin-top: 5px; padding: 8px 7px 3px; border-top: 1px solid var(--bubble-container-border); }
</style>
