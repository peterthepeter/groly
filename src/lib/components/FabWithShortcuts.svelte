<script lang="ts">
	import { goto } from '$app/navigation';
	import { shortcuts, shortcutMenu } from '$lib/shortcuts.svelte';

	let { onTap, label = 'Hinzufügen' }: { onTap: () => void; label?: string } = $props();

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = false;
	let suppressNextClick = false; // blocks synthesized click after a long-press touchend

	function startPress() {
		longFired = false;
		pressTimer = setTimeout(() => {
			longFired = true;
			pressTimer = null;
			if (shortcuts.list.length > 0) shortcutMenu.show();
		}, 500);
	}

	function cancelPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}

	// ── Touch handlers (iOS) ─────────────────────────────────────────────────
	// e.preventDefault() on touchstart is the ONLY reliable way to stop iOS
	// from showing the magnifying-glass loupe. It also prevents the browser
	// from synthesising a click event afterwards, so we fire onTap() manually
	// from touchend when it was a short press.

	function handleTouchStart(e: TouchEvent) {
		e.preventDefault();
		startPress();
	}

	function handleTouchMove() {
		cancelPress();
	}

	function handleTouchEnd(e: TouchEvent) {
		cancelPress();
		if (longFired) {
			longFired = false;
			suppressNextClick = true; // some browsers still synthesize a click after touchend
			// touchstart was on the FAB, so touchend always fires here — even when
			// the finger moved to a shortcut button. Use elementFromPoint to find
			// which element is under the finger, then navigate directly.
			// We do NOT use btn.click() because a programmatic click is not a real
			// user gesture — some browsers treat goto() inside it as a popup attempt.
			const touch = e.changedTouches[0];
			if (touch) {
				const el = document.elementFromPoint(touch.clientX, touch.clientY);
				const btn = el?.closest?.('[data-shortcut-id]') as HTMLElement | null;
				if (btn) {
					const id = btn.getAttribute('data-shortcut-id');
					const sc = shortcuts.list.find(s => s.id === id);
					if (sc) {
						shortcutMenu.hide();
						const params = sc.action !== 'go' ? `?action=${sc.action}` : '';
						// iOS keyboard bridge: focus synchronously here (user gesture context)
						// so iOS keeps the keyboard alive across navigation; AddItemBar.onMount
						// will transfer focus to the real input.
						if (sc.action === 'add') {
							(document.getElementById('ios-keyboard-bridge') as HTMLInputElement | null)?.focus();
						}
						goto(`/listen/${sc.listId}${params}`);
						return;
					}
				}
			}
			// Released over empty space → just close menu, do nothing else
			shortcutMenu.hide();
			return;
		}
		onTap();
	}

	function handleTouchCancel() {
		cancelPress();
		longFired = false;
	}

	// ── Mouse / pointer handlers (desktop) ───────────────────────────────────
	// On touch devices the browser fires both touch events AND pointer events.
	// We guard with pointerType so the pointer path only runs for real mice/pens.

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		startPress();
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		cancelPress();
	}

	function handlePointerCancel(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		cancelPress();
		longFired = false;
	}

	// click only fires for mouse (not after touchstart.preventDefault on iOS/Android),
	// but some browsers synthesize it anyway — suppressNextClick guards against that.
	function handleClick() {
		if (suppressNextClick) { suppressNextClick = false; return; }
		if (longFired) { longFired = false; return; }
		onTap();
	}
</script>

<button
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	ontouchcancel={handleTouchCancel}
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
	onclick={handleClick}
	oncontextmenu={(e) => e.preventDefault()}
	class="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform select-none"
	style="background-color: var(--color-primary); -webkit-touch-callout: none; touch-action: manipulation"
	aria-label={label}
>
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round">
		<line x1="12" y1="5" x2="12" y2="19"/>
		<line x1="5" y1="12" x2="19" y2="12"/>
	</svg>
</button>
