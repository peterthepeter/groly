let isOnline = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);
let pendingCount = $state(0);
let isServerReachable = $state(true);

async function pingServer() {
	try {
		const res = await fetch('/api/ping', { method: 'GET', cache: 'no-store' });
		isServerReachable = res.ok;
	} catch {
		isServerReachable = false;
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		isOnline = true;
		void pingServer();
	});
	window.addEventListener('offline', () => {
		isOnline = false;
		isServerReachable = true; // reset — server state is irrelevant when device is offline
	});

	// Poll every 30s when online
	setInterval(() => {
		if (isOnline) void pingServer();
	}, 30_000);

	// Initial check
	if (isOnline) void pingServer();
}

export const networkStore = {
	get online() {
		return isOnline;
	},
	get serverReachable() {
		return isServerReachable;
	},
	get pendingCount() {
		return pendingCount;
	},
	setPending(count: number) {
		pendingCount = count;
	},
	setServerReachable(val: boolean) {
		isServerReachable = val;
	}
};
