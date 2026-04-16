export function watchVisualViewportBottomOffset(setBottomOffset: (offset: number) => void): () => void {
	if (typeof window === 'undefined') return () => {};

	const visualViewport = window.visualViewport;
	if (!visualViewport) {
		setBottomOffset(0);
		return () => {};
	}

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const update = () => {
		setBottomOffset(Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop));
	};

	const debouncedUpdate = () => {
		// Immediate update for snappy response
		update();
		// Delayed re-check to catch password manager toolbars that appear after the initial keyboard resize
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(update, 150);
	};

	visualViewport.addEventListener('resize', debouncedUpdate);
	visualViewport.addEventListener('scroll', debouncedUpdate);
	update();

	return () => {
		visualViewport.removeEventListener('resize', debouncedUpdate);
		visualViewport.removeEventListener('scroll', debouncedUpdate);
		if (debounceTimer) clearTimeout(debounceTimer);
	};
}
