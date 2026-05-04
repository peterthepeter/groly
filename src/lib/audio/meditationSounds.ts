export type MeditationSound = {
	filename: string;
	labelDe: string;
	labelEn: string;
};

export const MEDITATION_SOUNDS: MeditationSound[] = [
	{ filename: 'zen-tone-deep.mp3', labelDe: 'Zen-Ton tief',   labelEn: 'Zen Tone Deep' },
	{ filename: 'zen-tone-mid.mp3',  labelDe: 'Zen-Ton mittel', labelEn: 'Zen Tone Mid' },
	{ filename: 'zen-tone-high.mp3', labelDe: 'Zen-Ton hoch',   labelEn: 'Zen Tone High' },
	{ filename: 'tone-mid-high.mp3', labelDe: 'Heller Ton',     labelEn: 'Bright Tone' },
	{ filename: 'auk-zen-gong.mp3',  labelDe: 'Zen-Gong',       labelEn: 'Zen Gong' }
];

export const DEFAULT_MEDITATION_SOUND = 'zen-tone-mid.mp3';
