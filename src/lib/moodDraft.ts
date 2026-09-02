export type MoodDraft = {
	mood: number | null;
	energy: number | null;
	activities: string[];
	note: string;
	gratitude: string;
	updatedAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'groly_mood_draft';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function key(userId: string, date: string): string {
	return `${PREFIX}:${encodeURIComponent(userId)}:${date}`;
}

function isMoodDraft(value: unknown): value is MoodDraft {
	if (!value || typeof value !== 'object') return false;
	const draft = value as Record<string, unknown>;
	return (
		(draft.mood === null || (typeof draft.mood === 'number' && draft.mood >= 1 && draft.mood <= 5)) &&
		(draft.energy === undefined || draft.energy === null || (typeof draft.energy === 'number' && draft.energy >= 1 && draft.energy <= 5)) &&
		Array.isArray(draft.activities) &&
		draft.activities.every(activity => typeof activity === 'string') &&
		typeof draft.note === 'string' &&
		typeof draft.gratitude === 'string' &&
		typeof draft.updatedAt === 'number'
	);
}

export function loadMoodDraft(
	storage: StorageLike,
	userId: string,
	date: string,
	now = Date.now()
): MoodDraft | null {
	const storageKey = key(userId, date);
	try {
		const raw = storage.getItem(storageKey);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!isMoodDraft(parsed) || now - parsed.updatedAt > MAX_AGE_MS) {
			storage.removeItem(storageKey);
			return null;
		}
		return { ...parsed, energy: parsed.energy ?? null };
	} catch {
		try { storage.removeItem(storageKey); } catch {}
		return null;
	}
}

export function saveMoodDraft(
	storage: StorageLike,
	userId: string,
	date: string,
	draft: Omit<MoodDraft, 'updatedAt'>,
	now = Date.now()
): void {
	try { storage.setItem(key(userId, date), JSON.stringify({ ...draft, updatedAt: now })); } catch {}
}

export function clearMoodDraft(storage: StorageLike, userId: string, date: string): void {
	try { storage.removeItem(key(userId, date)); } catch {}
}
