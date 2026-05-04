const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(filename: string): HTMLAudioElement {
	let audio = audioCache.get(filename);
	if (!audio) {
		audio = new Audio(`/sounds/meditation/${filename}`);
		audio.preload = 'auto';
		audioCache.set(filename, audio);
	}
	return audio;
}

export async function playMeditationSound(filename: string, volumePercent: number) {
	if (typeof window === 'undefined') return;
	try {
		const audio = getAudio(filename);
		audio.volume = Math.max(0, Math.min(1, volumePercent / 100));
		audio.currentTime = 0;
		await audio.play();
	} catch { /* autoplay may be blocked; ignore */ }
}

export function stopAllMeditationSounds() {
	for (const audio of audioCache.values()) {
		try { audio.pause(); audio.currentTime = 0; } catch {}
	}
}

export function preloadMeditationSounds(filenames: string[]) {
	if (typeof window === 'undefined') return;
	for (const f of filenames) getAudio(f);
}
