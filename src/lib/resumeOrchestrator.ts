// Push clicks arrive through the persistent IDB mailbox. Mount, foreground,
// focus/pageshow and the worker's nudge all check it; polling also covers delayed
// writes after iOS suspension. A push target takes priority for that foreground
// visit, while ordinary app openings still check the current location immediately.

import { consumePendingDeeplink, setPendingDeeplink } from '#lib/pendingDeeplink';
import { findGeofenceMatch, resetLocationNavSession } from '#lib/locationNav';
import { drainPendingMutations } from '#lib/sync/manager';
import { refreshActiveUserSettings } from '#lib/userSettings.svelte';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	let navigation = Promise.resolve();
	let mailboxRead: Promise<boolean> | null = null;
	let watching = false;
	let resumeRevision = 0;
	let intentRevision = 0;
	let hasExplicitTarget = false;

	function markExplicitTarget() {
		hasExplicitTarget = true;
		intentRevision++;
	}

	// Serialize navigations instead of discarding a consumed push target when a
	// location navigation is already running. Check location eligibility again
	// when its queued navigation actually starts.
	function navigateTo(url: string, allowed = () => true) {
		const next = navigation.catch(() => {}).then(async () => {
			if (!allowed()) return;
			if (location.pathname + location.search !== url) {
				const { goto } = await import('$app/navigation');
				if (allowed()) await goto(url);
			}
		});
		navigation = next;
		return next;
	}

	function readMailbox(): Promise<boolean> {
		// Foreground and focus often fire together. Share the read and its outcome
		// so another resume cannot start GPS while a push navigation is pending.
		if (mailboxRead) return mailboxRead;
		mailboxRead = (async () => {
			const url = await consumePendingDeeplink();
			if (!url) return false;
			markExplicitTarget();
			try {
				await navigateTo(url);
			} catch {
				// A failed navigation must not permanently consume the notification.
				await setPendingDeeplink(url);
			}
			void drainPendingMutations();
			return true;
		})().finally(() => { mailboxRead = null; });
		return mailboxRead;
	}

	async function watchMailbox() {
		if (watching) return;
		watching = true;
		try {
			const delays = [250, 250, 250, 250, 500, 500, 1000, 1000, 1000, 1000, 1000];
			for (const delay of delays) {
				await new Promise(resolve => setTimeout(resolve, delay));
				if (await readMailbox()) return;
			}
		} finally {
			watching = false;
		}
	}

	async function tryDeeplinkNow(): Promise<boolean> {
		if (await readMailbox()) return true;
		void watchMailbox();
		return false;
	}

	async function handleResume() {
		const resume = ++resumeRevision;
		// Cold notification launches (and explicit shortcuts) already carry their
		// action in the URL, even if the mailbox write has not arrived yet.
		if (new URLSearchParams(location.search).has('action')) markExplicitTarget();
		const intent = intentRevision;
		const mayUseLocation = () => !hasExplicitTarget && resume === resumeRevision && intent === intentRevision;
		if (await tryDeeplinkNow()) return;
		if (mayUseLocation()) {
			const matchId = await findGeofenceMatch();
			if (matchId && mayUseLocation()) {
				await navigateTo(`/listen/${matchId}`, mayUseLocation);
			}
		}
		void refreshActiveUserSettings();
	}

	void handleResume();

	let lastResumeAt = 0;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') {
			// The next normal opening should use GPS again. Invalidate location
			// results from the foreground visit that just ended.
			hasExplicitTarget = false;
			resumeRevision++;
			return;
		}
		const now = Date.now();
		if (now - lastResumeAt < 600) return;
		lastResumeAt = now;
		resetLocationNavSession();
		void handleResume();
	});

	window.addEventListener('focus', () => void tryDeeplinkNow());
	window.addEventListener('pageshow', () => void tryDeeplinkNow());
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
			if (event.data?.type !== 'deeplink-nudge') return;
			// Set intent before reading IDB: focus/visibility can arrive while the
			// read is still pending, or while iOS finishes a delayed mailbox write.
			markExplicitTarget();
			void tryDeeplinkNow();
		});
	}
}
