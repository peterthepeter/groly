export const VISUAL_GROUPS = [
	'fruit',
	'vegetable',
	'fish',
	'tea',
	'coffee',
	'alcohol',
	'egg',
	'nuts',
	'tube',
	'spread',
	'cleaner-spray',
	'paper-goods',
	'liquid-care'
] as const;

export type VisualGroup = (typeof VISUAL_GROUPS)[number];

// Verbindliche Auswahl aus dem Freigabe-Board für Groly 0.9.0:
// A: Obst, Gemüse, Fisch, Tee, Kaffee, Alkohol, Ei, Nüsse, Glas/Aufstrich
// B: Tube, Reinigerspray, Papierwaren, flüssige Körperpflege
export const VISUAL_GROUP_ICONS: Record<VisualGroup, string> = {
	fruit: `<path d="M12 6.5V3a1 1 0 0 1 1-1"/><path d="M18.2 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.5A6 6 0 0 0 2 11a15 15 0 0 0 3.8 10 3 3 0 0 0 3.6.6 5.5 5.5 0 0 1 5.2 0 3 3 0 0 0 3.6-.6Z"/>`,
	vegetable: `<path d="M2.3 21.7s9.8-3.5 12.7-6.4A4.5 4.5 0 0 0 8.6 9C5.8 11.8 2.3 21.7 2.3 21.7Z"/><path d="m8.6 14-2-2"/><path d="m12 15.8-2.2-2.2"/><path d="M15 9c1-3 3-5 6-5-1 3-3 5-6 5Z"/><path d="M15 9c-2-2-2-5-1-7 2 2 3 4 1 7Z"/>`,
	fish: `<path d="M6.5 12c2-4 5.5-6 9-6 3 0 5 2 6.5 6-1.5 4-3.5 6-6.5 6-3.5 0-7-2-9-6Z"/><path d="M6.5 9C5 7 3 6 1.5 6c0 2 1 4 2.5 6-1.5 2-2.5 4-2.5 6 1.5 0 3.5-1 5-3"/><circle cx="18" cy="11" r=".7" fill="currentColor" stroke="none"/>`,
	tea: `<path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a3 3 0 0 1 0 6H17"/><path d="M9 3c-1 1-1 2 0 3"/><path d="M13 2c-1 1.5-1 3 0 4"/><path d="M7 9v4"/><path d="M6 13h2"/>`,
	coffee: `<path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a3 3 0 0 1 0 6H17"/><path d="M8 3c-1 1-1 2 0 3"/><path d="M12 2c-1 1.5-1 3 0 4"/><path d="M16 3c-1 1-1 2 0 3"/>`,
	alcohol: `<path d="M6 3h12l-1 7a5 5 0 0 1-10 0L6 3Z"/><path d="M7 8h10"/><path d="M12 15v6"/><path d="M8 21h8"/>`,
	egg: `<path d="M12 22c6 0 8-4 7-9C18 7 15 2 12 2S6 7 5 13c-1 5 1 9 7 9Z"/>`,
	nuts: `<path d="M12 3.5C9.4 3.5 8 5.4 8 7c0 1 .5 1.8 1 2.4-.9.8-1.6 2-1.6 3.6 0 2.5 2 4.5 4.6 4.5s4.6-2 4.6-4.5c0-1.6-.7-2.8-1.6-3.6.5-.6 1-1.4 1-2.4 0-1.6-1.4-3.5-4-3.5Z"/><path d="M9.2 7.2h5.6"/><path d="M8.7 12.2h6.6"/><path d="M9.3 14.9h5.4"/>`,
	tube: `<path d="m8 3 10 4-5 12-10-4L8 3Z"/><path d="m3 15 10 4-1 3-10-4 1-3Z"/><path d="m9 8 5 2"/><path d="m8 11 4 1.5"/>`,
	spread: `<path d="M7 3h10v3H7V3Z"/><path d="M6 6h12v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6Z"/><rect x="8" y="10" width="8" height="6" rx="1"/>`,
	'cleaner-spray': `<path d="M8 8h8l2 4v9H6v-9l2-4Z"/><path d="M10 8V5h7"/><path d="M17 5v2"/><path d="M19 3v4"/><path d="M21 4v2"/><path d="m10 15 1 1 3-3"/>`,
	'paper-goods': `<path d="M5 4h10a4 4 0 0 1 4 4v12H9V8a4 4 0 0 0-4-4Z"/><ellipse cx="5" cy="8" rx="4" ry="4"/><ellipse cx="5" cy="8" rx="1.5" ry="1.5"/><path d="M9 16h10"/>`,
	'liquid-care': `<path d="M8 3h8v4l2 3v11H6V10l2-3V3Z"/><path d="M8 7h8"/><path d="M9 13c2-2 4-2 6 0"/><path d="M9 16h6"/>`
};
