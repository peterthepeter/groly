import { describe, expect, it } from 'vitest';
import { clearMoodDraft, loadMoodDraft, saveMoodDraft } from './moodDraft';

class MemoryStorage {
	private values = new Map<string, string>();

	getItem(key: string) { return this.values.get(key) ?? null; }
	setItem(key: string, value: string) { this.values.set(key, value); }
	removeItem(key: string) { this.values.delete(key); }
}

describe('mood drafts', () => {
	it('restores a draft for the same user and date', () => {
		const storage = new MemoryStorage();
		saveMoodDraft(storage, 'user-a', '2026-08-27', {
			mood: 4,
			activities: ['walking'],
			note: 'Notiz',
			gratitude: 'Dankbar'
		}, 1_000);

		expect(loadMoodDraft(storage, 'user-a', '2026-08-27', 2_000)).toEqual({
			mood: 4,
			activities: ['walking'],
			note: 'Notiz',
			gratitude: 'Dankbar',
			updatedAt: 1_000
		});
	});

	it('keeps drafts separated by user and date', () => {
		const storage = new MemoryStorage();
		saveMoodDraft(storage, 'user-a', '2026-08-27', {
			mood: 3, activities: [], note: '', gratitude: ''
		}, 1_000);

		expect(loadMoodDraft(storage, 'user-b', '2026-08-27', 2_000)).toBeNull();
		expect(loadMoodDraft(storage, 'user-a', '2026-08-26', 2_000)).toBeNull();
	});

	it('clears saved and expired drafts', () => {
		const storage = new MemoryStorage();
		saveMoodDraft(storage, 'user-a', '2026-08-27', {
			mood: null, activities: [], note: 'Entwurf', gratitude: ''
		}, 1_000);
		clearMoodDraft(storage, 'user-a', '2026-08-27');
		expect(loadMoodDraft(storage, 'user-a', '2026-08-27', 2_000)).toBeNull();

		saveMoodDraft(storage, 'user-a', '2026-08-27', {
			mood: 2, activities: [], note: '', gratitude: ''
		}, 1_000);
		expect(loadMoodDraft(storage, 'user-a', '2026-08-27', 8 * 24 * 60 * 60 * 1000)).toBeNull();
	});
});
