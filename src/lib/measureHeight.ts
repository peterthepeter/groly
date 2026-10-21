import type { Action } from 'svelte/action';

/** Publish layout changes outside ResizeObserver delivery to avoid feedback loops in WebKit. */
export const measureHeight: Action<HTMLElement, (height: number) => void> = (node, onHeight) => {
	let notify = onHeight;
	let frame = 0;
	let previousHeight = -1;

	function publish() {
		const height = node.clientHeight;
		if (height === previousHeight) return;
		previousHeight = height;
		notify(height);
	}

	const observer = new ResizeObserver(() => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(publish);
	});
	observer.observe(node);
	publish();

	return {
		update(onHeight) { notify = onHeight; },
		destroy() {
			observer.disconnect();
			cancelAnimationFrame(frame);
		}
	};
};
