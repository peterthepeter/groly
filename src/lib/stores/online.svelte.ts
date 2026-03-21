let isOnline = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);
let pendingCount = $state(0);

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => (isOnline = true));
	window.addEventListener('offline', () => (isOnline = false));
}

export const networkStore = {
	get online() {
		return isOnline;
	},
	get pendingCount() {
		return pendingCount;
	},
	setPending(count: number) {
		pendingCount = count;
	}
};
