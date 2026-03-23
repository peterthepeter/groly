export type Category = {
	color: string;
	svgContent: string;
};

type CategoryDef = {
	key: string;
	keywords: string[];
	category: Category;
};

const DEFAULT_KEY = 'default';

const DEFAULT: Category = {
	color: '#F59E0B',
	svgContent: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`
};

export const CATEGORIES: CategoryDef[] = [
	{
		key: 'obst',
		keywords: [
			'apfel', 'äpfel', 'birne', 'birnen', 'banane', 'bananen', 'tomate', 'tomaten', 'salat', 'karotte', 'karotten',
			'obst', 'gemüse', 'zwiebel', 'knoblauch', 'zitrone', 'gurke', 'gurken', 'paprika',
			'kartoffel', 'kartoffeln', 'beere', 'beeren', 'erdbeere', 'erdbeeren', 'heidelbeere',
			'himbeere', 'orange', 'orangen', 'mandarine', 'kiwi', 'mango', 'ananas', 'trauben',
			'brokkoli', 'spinat', 'möhre', 'möhren', 'sellerie', 'lauch', 'zucchini', 'avocado',
			'pilze', 'champignon', 'kohlrabi', 'blumenkohl', 'rotkohl', 'weißkohl', 'eisberg',
			'rucola', 'feldsalat', 'radieschen', 'rettich', 'ingwer', 'petersilie', 'schnittlauch',
			'basilikum', 'minze', 'thymian', 'rosinen', 'datteln', 'feigen', 'pflaume', 'kirsche',
			'pfirsich', 'nektarine', 'melone', 'wassermelone', 'granatapfel',
			'mais', 'spargel', 'aubergine', 'fenchel', 'artischocke', 'papaya', 'süßkartoffel',
			'kopfsalat', 'rote bete', 'pastinake', 'staudensellerie', 'frühlingszwiebel',
			'zitronengras', 'koriander', 'dill', 'rosmarin', 'salbei', 'pak choi', 'mairübe'
		],
		category: {
			color: 'var(--color-primary)',
			svgContent: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`
		}
	},
	{
		key: 'backwaren',
		keywords: [
			'brot', 'brötchen', 'toast', 'kuchen', 'mehl', 'backen', 'croissant', 'baguette',
			'ciabatta', 'vollkornbrot', 'mischbrot', 'weißbrot', 'laugenstange', 'brezel',
			'muffin', 'donut', 'waffel', 'kekse', 'zwieback', 'knäckebrot', 'tortilla', 'wrap',
			'pita', 'naan', 'bagel', 'brioche', 'hefe', 'backpulver', 'vanillezucker',
			'dinkel', 'roggen', 'pumpernickel', 'laugenbrezel', 'semmel', 'weckle', 'kaiserbrötchen',
			'paniermehl', 'speisestärke', 'grieß', 'haferflocken', 'müsli', 'cornflakes', 'granola',
			'dinkelmehl', 'roggenmehl', 'weizenmehl', 'buchweizenmehl', 'reismehl',
			'toastbrot', 'sandwichbrot', 'focaccia', 'fladenbrot', 'knödelbrot'
		],
		category: {
			color: '#D97706',
			svgContent: `<g transform="translate(12,12) scale(1.1) translate(-12,-12)"><path d="M3 11a5 5 0 0 1 10 0v9H3v-9z"/><path d="M13 11a5 5 0 0 1 8 0v9h-8v-9z"/></g>`
		}
	},
	{
		key: 'milch',
		keywords: [
			'milch', 'käse', 'joghurt', 'butter', 'quark', 'sahne', 'ei', 'eier', 'mozzarella',
			'parmesan', 'gouda', 'emmentaler', 'brie', 'camembert', 'ricotta', 'frischkäse',
			'schmand', 'crème fraîche', 'kondensmilch', 'buttermilch', 'kefir', 'skyr',
			'schlagsahne', 'mascarpone', 'gruyere', 'feta', 'hüttenkäse',
			'sauerrahm', 'schmelzkäse', 'pizzakäse', 'reibekäse', 'magerquark', 'rahmjoghurt',
			'vollmilch', 'laktosefrei', 'obers', 'topfen', 'cheddar', 'manchego', 'pecorino',
			'gorgonzola', 'roquefort', 'halloumi', 'burrata', 'stracciatella', 'ricottasalata',
			'naturjoghurt', 'fruchtjoghurt', 'griechischer joghurt', 'sahnejoghurt',
			'eierlikör', 'eierpfannkuchen'
		],
		category: {
			color: '#60A5FA',
			svgContent: `<path d="M8 2h8l2 5v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7l2-5z"/><line x1="6" y1="10" x2="18" y2="10"/>`
		}
	},
	{
		key: 'fleisch',
		keywords: [
			'fleisch', 'huhn', 'hähnchen', 'hühnchen', 'rind', 'rindfleisch', 'schwein', 'schweinefleisch',
			'wurst', 'würstchen', 'fisch', 'lachs', 'thunfisch', 'schnitzel', 'hack', 'hackfleisch',
			'steak', 'filet', 'pute', 'truthahn', 'lamm', 'kalb', 'kalbfleisch', 'speck', 'schinken',
			'salami', 'chorizo', 'mortadella', 'leberwurst', 'blutwurst', 'bratwurst', 'currywurst',
			'frikadelle', 'burger', 'mett', 'forelle', 'hering', 'garnelen', 'shrimps', 'muscheln',
			'tintenfisch', 'kabeljau', 'scholle', 'tilapia', 'seelachs', 'crevetten', 'krabben',
			'gyros', 'döner', 'geflügel', 'hähnchenbrust', 'hähnchenkeule', 'putenbrust', 'putenbrustfilet',
			'rinderbraten', 'schweinebauch', 'schweinenacken', 'schweinefilet', 'lammkeule', 'lammkotelett',
			'wildlachs', 'räucherlachs', 'dorade', 'wolfsbarsch', 'jakobsmuscheln', 'sardinen',
			'anchovis', 'leberkäse', 'fleischwurst', 'weißwurst', 'bockwurst', 'wiener',
			'hähnchenflügel', 'entenbrust', 'gänsebrust', 'wildschwein', 'rehrücken', 'kaninchen',
			'lende', 'rumpsteak', 'entrecôte', 'roastbeef', 'tafelspitz', 'gulasch', 'geschnetzeltes'
		],
		category: {
			color: '#EF4444',
			svgContent: `<g transform="translate(12,12) scale(1.32) translate(-12,-12)"><path d="M5 10c.5-4 3.5-6.5 7-6.5S19 6 19.5 10c.5 4-2.5 10-7.5 10S4.5 14 5 10z"/><path d="M10 10.5c1-2 4-2.5 5-1"/><path d="M9.5 13.5c1.5-.5 4 0 5 1"/></g>`
		}
	},
	{
		key: 'getraenke',
		keywords: [
			'wasser', 'saft', 'cola', 'bier', 'wein', 'kaffee', 'tee', 'limonade', 'getränk',
			'getränke', 'mineralwasser', 'sprudel', 'fanta', 'sprite', 'pepsi', 'eistee',
			'orangensaft', 'apfelsaft', 'multivitamin', 'smoothie', 'energie', 'energy drink',
			'latte', 'cappuccino', 'espresso', 'kakao', 'malzbier', 'radler', 'sekt', 'prosecco',
			'champagner', 'schnaps', 'whisky', 'rum', 'vodka', 'gin', 'cocktail', 'sirup',
			'kombucha', 'almdudler', 'bionade', 'matcha', 'eiskaffee', 'frappuccino',
			'apfelschorle', 'weinschorle', 'bananenmilch', 'hafermilch', 'mandelmilch', 'sojamilch',
			'reismilch', 'kokosmilch', 'oatly', 'alpro', 'brause', 'zitronenwasser', 'cold brew'
		],
		category: {
			color: '#06B6D4',
			svgContent: `<path d="M5 3h14l-2 18H7L5 3z"/><path d="M5 8h14"/>`
		}
	},
	{
		key: 'tiefkuehl',
		keywords: [
			'tiefkühl', 'gefroren', 'tiefgefroren', 'eis', 'eiscreme', 'speiseeis', 'pizza',
			'tk ', ' tk', 'tiefkühlpizza', 'tiefkühlgemüse', 'tiefkühlfisch',
			'schlemmerfilet', 'pommes', 'hash browns', 'fischstäbchen', 'belegtes baguette',
			'tk-pizza', 'tk-gemüse', 'tk-fisch', 'tiefkühlerbsen', 'tiefkühlspinat',
			'eintopf tiefkühl', 'frischkost tiefkühl', 'mozzarella sticks', 'chicken nuggets',
			'fischburger', 'frühlingsrollen', 'samosas', 'dim sum', 'gyoza', 'edamame'
		],
		category: {
			color: '#93C5FD',
			svgContent: `<line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>`
		}
	},
	{
		key: 'snacks',
		keywords: [
			'schokolade', 'chips', 'keks', 'kekse', 'süß', 'süßes', 'gummibär', 'gummibärchen',
			'snack', 'nuss', 'nüsse', 'erdnuss', 'erdnüsse', 'mandeln', 'cashews', 'walnuss',
			'bonbon', 'riegel', 'mars', 'snickers', 'twix', 'kitkat', 'oreo', 'nutella',
			'popcorn', 'salzstangen', 'cracker', 'studentenfutter', 'müsliriegel', 'praline',
			'weingummi', 'lakritze', 'dominosteine', 'lebkuchen', 'marzipan', 'zartbitter',
			'vollmilchschokolade', 'nussschokolade', 'tortilla chips', 'nachos', 'pralinen',
			'karamell', 'lollipop', 'lutscher', 'brause', 'haribo', 'trolli', 'nimm 2',
			'ritter sport', 'milka', 'lindt', 'ferrero', 'raffaello', 'bounty', 'lion',
			'pistazien', 'macadamia', 'pekannuss', 'paranuss', 'kokosnuss', 'sesamriegel',
			'energieriegel', 'proteinriegel', 'datteln', 'trockenfrüchte', 'fruchtgummi'
		],
		category: {
			color: '#F472B6',
			svgContent: `<rect x="2" y="7" width="20" height="10" rx="1.5"/><line x1="8" y1="7" x2="8" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="2" y1="12" x2="22" y2="12"/>`
		}
	},
	{
		key: 'haushalt',
		keywords: [
			'spülmittel', 'putzmittel', 'waschmittel', 'toilettenpapier', 'seife', 'shampoo',
			'zahnpasta', 'müllbeutel', 'schwamm', 'reiniger', 'weichspüler', 'geschirrspüler',
			'tabs', 'duschgel', 'deo', 'deodorant', 'rasierer', 'kondome', 'tampons', 'binden',
			'wattestäbchen', 'watte', 'pflaster', 'klebeband', 'folie', 'backpapier', 'haushalt',
			'einweghandschuhe', 'küchenrolle', 'papiertaschentuch', 'taschentuch', 'putztuch',
			'lappen', 'besen', 'mop', 'staubsauger', 'kerze', 'batterien', 'glühbirne',
			'geschirrspülmittel', 'waschmaschinentabs', 'alufolie', 'frischhaltefolie',
			'gefrierbeutel', 'badreiniger', 'kalklöser', 'entkalker', 'rohrreiniger',
			'desinfektionsmittel', 'handseife', 'flüssigseife', 'bodylotion', 'creme',
			'sonnencreme', 'zahnbürste', 'mundwasser', 'zahnstocher', 'rasierschaum',
			'nassrasierer', 'wattepads', 'haargummi', 'haarspray', 'haargel', 'conditioner',
			'spülung', 'mundspülung', 'deo roll-on', 'antitranspirant', 'insektenschutz',
			'mückenspray', 'papiertücher', 'feuchttücher', 'windeln', 'babytücher'
		],
		category: {
			color: '#A78BFA',
			svgContent: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`
		}
	}
];

// Default sort order (index 0 = bottom of grid, index last = top of grid)
export const DEFAULT_CATEGORY_ORDER = ['obst', 'backwaren', 'milch', 'fleisch', 'getraenke', 'tiefkuehl', 'snacks', 'haushalt', 'default'];

export const CATEGORY_LABELS: Record<string, { de: string; en: string }> = {
	obst:      { de: 'Obst & Gemüse',  en: 'Fruit & Veg' },
	backwaren: { de: 'Backwaren',       en: 'Bakery' },
	milch:     { de: 'Milch & Käse',   en: 'Dairy' },
	fleisch:   { de: 'Fleisch & Fisch', en: 'Meat & Fish' },
	getraenke: { de: 'Getränke',        en: 'Drinks' },
	tiefkuehl: { de: 'Tiefkühlkost',   en: 'Frozen' },
	snacks:    { de: 'Snacks & Süßes', en: 'Snacks' },
	haushalt:  { de: 'Haushalt',        en: 'Household' },
	default:   { de: 'Alles andere',    en: 'Everything else' },
};

const categoryByKey = new Map(CATEGORIES.map(c => [c.key, c.category]));

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function matchesKeyword(name: string, keyword: string): boolean {
	if (new RegExp('(^|\\s)' + escapeRegex(keyword), 'i').test(name)) return true;
	if (keyword.length >= 5 && name.includes(keyword)) return true;
	return false;
}

export function getCategoryForItem(name: string, override?: string | null): Category {
	if (override) return categoryByKey.get(override) ?? DEFAULT;
	const lower = name.toLowerCase();
	for (const { keywords, category } of CATEGORIES) {
		if (keywords.some(k => matchesKeyword(lower, k))) {
			return category;
		}
	}
	return DEFAULT;
}

export function getCategoryKey(name: string, override?: string | null): string {
	if (override && CATEGORIES.some(c => c.key === override)) return override;
	const lower = name.toLowerCase();
	for (const { key, keywords } of CATEGORIES) {
		if (keywords.some(k => matchesKeyword(lower, k))) {
			return key;
		}
	}
	return DEFAULT_KEY;
}

export function getCategoryByKey(key: string): Category {
	return categoryByKey.get(key) ?? DEFAULT;
}
