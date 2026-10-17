import { initSync } from '#lib/sync/manager';
import { getApiUserId } from '#lib/apiTimeout';

export async function setServiceWorkerAccount(userId: string | null): Promise<void> {
	if (!('serviceWorker' in navigator)) return;
	try {
		const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))]);
		if (!registration) return;
		const worker = navigator.serviceWorker.controller ?? registration.active;
		if (!worker || getApiUserId() !== userId) return;
		await new Promise<void>(resolve => {
			const channel = new MessageChannel();
			const finish = () => { clearTimeout(timer); channel.port1.close(); resolve(); };
			const timer = setTimeout(finish, 3000);
			channel.port1.onmessage = finish;
			worker.postMessage({ type: 'SET_ACCOUNT', userId }, [channel.port2]);
		});
	} catch { /* A disabled service worker must not prevent login/logout. */ }
}

export async function syncDevicePush(userId: string): Promise<void> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		if (!subscription || getApiUserId() !== userId) return;
		const value = subscription.toJSON();
		await fetch('/api/push/subscribe', {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Groly-User': userId },
			body: JSON.stringify({ endpoint: value.endpoint, keys: value.keys })
		});
	} catch { /* Retry on the next account mount or when push settings open. */ }
}

export async function logoutDevice(): Promise<void> {
	let endpoint: string | undefined;
	if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
		try {
			const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => setTimeout(() => resolve(null), 1000))]);
			const subscription = registration?.pushManager
				? await Promise.race([registration.pushManager.getSubscription(), new Promise<null>(resolve => setTimeout(() => resolve(null), 1000))])
				: null;
			endpoint = subscription?.endpoint;
			const notifications = registration?.getNotifications
				? await Promise.race([registration.getNotifications(), new Promise<Notification[]>(resolve => setTimeout(() => resolve([]), 1000))])
				: [];
			for (const notification of notifications) notification.close();
		} catch { /* The HTTP-only device cookie also identifies the subscription. */ }
	}
	const response = await fetch('/api/auth/logout', {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint })
	});
	if (!response.ok) throw new Error('Logout failed');
	initSync(null);
	await setServiceWorkerAccount(null);
}
