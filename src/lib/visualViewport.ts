export function watchVisualViewportBottomOffset(setBottomOffset: (offset: number) => void): () => void {
	if (typeof window === 'undefined') return () => {};

	const visualViewport = window.visualViewport;
	if (!visualViewport) {
		setBottomOffset(0);
		return () => {};
	}

	const update = () => {
		setBottomOffset(Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop));
	};

	visualViewport.addEventListener('resize', update);
	visualViewport.addEventListener('scroll', update);
	update();

	return () => {
		visualViewport.removeEventListener('resize', update);
		visualViewport.removeEventListener('scroll', update);
	};
}
