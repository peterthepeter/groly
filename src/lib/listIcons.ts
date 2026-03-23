export type ListIconId = 'supermarkt' | 'drogerie' | 'bio' | 'baeckerei' | 'haushalt' | 'online' | 'laden' | 'apotheke';

export interface ListIcon {
	id: ListIconId;
	label: string;
	labelEn: string;
	color: string;
	svgContent: string;
}

export const LIST_ICONS: ListIcon[] = [
	{
		id: 'supermarkt',
		label: 'Supermarkt',
		labelEn: 'Supermarket',
		color: '#2e7d32',
		svgContent: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'
	},
	{
		id: 'drogerie',
		label: 'Drogerie',
		labelEn: 'Drugstore',
		color: '#1565c0',
		svgContent: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'
	},
	{
		id: 'bio',
		label: 'Bio / Natur',
		labelEn: 'Organic',
		color: '#558b2f',
		svgContent: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'
	},
	{
		id: 'baeckerei',
		label: 'Bäckerei',
		labelEn: 'Bakery',
		color: '#e65100',
		svgContent: '<path d="M5 12a7 7 0 0 1 14 0"/><rect x="3" y="12" width="18" height="7" rx="2"/><line x1="3" y1="16" x2="21" y2="16"/>'
	},
	{
		id: 'haushalt',
		label: 'Haushalt',
		labelEn: 'Household',
		color: '#6a1b9a',
		svgContent: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
	},
	{
		id: 'apotheke',
		label: 'Apotheke',
		labelEn: 'Pharmacy',
		color: '#c62828',
		svgContent: '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>'
	},
	{
		id: 'online',
		label: 'Online',
		labelEn: 'Online',
		color: '#00695c',
		svgContent: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'
	},
	{
		id: 'laden',
		label: 'Laden',
		labelEn: 'Store',
		color: '#4e342e',
		svgContent: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
	}
];

export function getListIcon(iconId: string | null | undefined): ListIcon | null {
	if (!iconId) return null;
	return LIST_ICONS.find(i => i.id === iconId) ?? null;
}

export function getListIconLabel(icon: ListIcon, lang: string): string {
	return lang === 'en' ? icon.labelEn : icon.label;
}
