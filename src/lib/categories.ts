export type Category = {
	color: string;
	svgContent: string;
};

import { BRAND_CATEGORIES } from '$lib/brands';

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
			'zitronengras', 'koriander', 'dill', 'rosmarin', 'salbei', 'pak choi', 'mairübe',
			// English
			'apple', 'apples', 'pear', 'pears', 'banana', 'bananas', 'tomato', 'tomatoes', 'lettuce',
			'carrot', 'carrots', 'fruit', 'vegetable', 'vegetables', 'onion', 'onions', 'garlic',
			'lemon', 'lemons', 'cucumber', 'cucumbers', 'bell pepper', 'pepper', 'potato', 'potatoes',
			'berry', 'berries', 'strawberry', 'strawberries', 'blueberry', 'blueberries',
			'raspberry', 'raspberries', 'mandarin', 'grapes', 'broccoli', 'spinach', 'celery',
			'zucchini', 'courgette', 'avocado', 'mushroom', 'mushrooms', 'cauliflower',
			'red cabbage', 'iceberg', 'arugula', 'rocket', 'radish', 'ginger', 'parsley',
			'chives', 'basil', 'mint', 'thyme', 'raisins', 'figs', 'plum', 'plums',
			'cherry', 'cherries', 'peach', 'peaches', 'nectarine', 'melon', 'watermelon',
			'pomegranate', 'corn', 'asparagus', 'eggplant', 'aubergine', 'fennel', 'artichoke',
			'papaya', 'sweet potato', 'sweet potatoes', 'spring onion', 'scallion', 'lemongrass',
			'cilantro', 'coriander', 'dill', 'rosemary', 'sage', 'leek', 'turnip', 'kohlrabi',
			'bok choy', 'pak choi', 'lime', 'limes', 'grapefruit', 'dates', 'coconut'
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
			'toastbrot', 'sandwichbrot', 'focaccia', 'fladenbrot', 'knödelbrot',
			// English
			'bread', 'roll', 'rolls', 'cake', 'flour', 'baking', 'waffle', 'waffles',
			'cookie', 'cookies', 'cracker', 'crackers', 'yeast', 'baking powder', 'oats', 'oatmeal',
			'muesli', 'granola', 'breadcrumbs', 'flatbread', 'sourdough', 'rye bread',
			'whole grain', 'whole wheat', 'buckwheat', 'rice flour', 'cornstarch', 'semolina',
			'sandwich bread', 'pretzel', 'pretzels', 'crispbread'
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
			'eierlikör', 'eierpfannkuchen',
			// English
			'milk', 'cheese', 'yogurt', 'yoghurt', 'cream', 'egg', 'eggs', 'dairy',
			'cream cheese', 'sour cream', 'condensed milk', 'buttermilk', 'whipped cream',
			'cottage cheese', 'gruyere', 'cheddar', 'halloumi', 'burrata', 'greek yogurt',
			'heavy cream', 'double cream', 'single cream', 'clotted cream', 'skyr',
			'lactose free', 'lactose-free', 'emmental', 'swiss cheese'
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
			'lende', 'rumpsteak', 'entrecôte', 'roastbeef', 'tafelspitz', 'gulasch', 'geschnetzeltes',
			// English
			'meat', 'chicken', 'beef', 'pork', 'sausage', 'sausages', 'fish', 'salmon', 'tuna',
			'ground beef', 'minced meat', 'mince', 'turkey', 'lamb', 'veal', 'bacon', 'ham',
			'trout', 'herring', 'shrimp', 'prawns', 'mussels', 'squid', 'cod', 'tilapia',
			'crab', 'poultry', 'chicken breast', 'chicken thigh', 'chicken wings', 'turkey breast',
			'lamb chops', 'smoked salmon', 'anchovies', 'sardines', 'duck', 'duck breast',
			'rabbit', 'pork belly', 'pork chop', 'ribs', 'meatball', 'meatballs', 'hot dog',
			'pepperoni', 'pastrami', 'prosciutto', 'pancetta', 'lardons', 'roast beef',
			'sirloin', 'ribeye', 'tenderloin', 'fillet', 'sea bass', 'sea bream', 'scallops'
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
			'reismilch', 'kokosmilch', 'oatly', 'alpro', 'brause', 'zitronenwasser', 'cold brew',
			// English
			'water', 'juice', 'beer', 'wine', 'coffee', 'tea', 'lemonade', 'drink', 'drinks',
			'mineral water', 'sparkling water', 'orange juice', 'apple juice', 'smoothie',
			'energy drink', 'latte', 'cappuccino', 'espresso', 'cocoa', 'hot chocolate',
			'prosecco', 'champagne', 'whiskey', 'whisky', 'rum', 'vodka', 'gin', 'cocktail',
			'syrup', 'kombucha', 'matcha', 'iced coffee', 'oat milk', 'almond milk',
			'soy milk', 'rice milk', 'coconut milk', 'cold brew', 'lemonade', 'squash',
			'cider', 'hard cider', 'soda', 'tonic water', 'ginger beer', 'iced tea'
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
			'fischburger', 'frühlingsrollen', 'samosas', 'dim sum', 'gyoza', 'edamame',
			// English
			'frozen', 'ice cream', 'pizza', 'french fries', 'fries', 'chips frozen',
			'fish fingers', 'fish sticks', 'chicken nuggets', 'spring rolls', 'edamame',
			'gyoza', 'hash browns', 'frozen vegetables', 'frozen fish', 'frozen pizza',
			'frozen peas', 'frozen spinach', 'sorbet', 'gelato', 'popsicle', 'ice lolly'
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
			'energieriegel', 'proteinriegel', 'datteln', 'trockenfrüchte', 'fruchtgummi',
			// English
			'chocolate', 'candy', 'sweet', 'sweets', 'gummy bears', 'gummies', 'snack', 'snacks',
			'nuts', 'peanuts', 'almonds', 'cashews', 'walnuts', 'pistachios', 'macadamia',
			'pecan', 'brazil nut', 'hazelnut', 'mixed nuts', 'trail mix',
			'caramel', 'lollipop', 'licorice', 'liquorice', 'dark chocolate', 'milk chocolate',
			'tortilla chips', 'nachos', 'popcorn', 'pretzels', 'rice cakes',
			'granola bar', 'cereal bar', 'protein bar', 'energy bar', 'dried fruit',
			'fruit gummies', 'jelly beans', 'toffee', 'fudge', 'marshmallow', 'nougat',
			'peanut butter', 'nutella', 'hazelnut spread'
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
			'mückenspray', 'papiertücher', 'feuchttücher', 'windeln', 'babytücher',
			// English
			'dish soap', 'washing up liquid', 'detergent', 'laundry detergent', 'toilet paper',
			'toilet roll', 'loo roll', 'soap', 'shampoo', 'toothpaste', 'trash bags', 'bin bags',
			'garbage bags', 'sponge', 'cleaner', 'fabric softener', 'dishwasher tablets',
			'dishwasher pods', 'shower gel', 'body wash', 'deodorant', 'razor', 'razors',
			'condoms', 'tampons', 'pads', 'sanitary pads', 'cotton swabs', 'cotton buds',
			'plaster', 'bandage', 'tape', 'foil', 'aluminium foil', 'aluminum foil',
			'cling film', 'plastic wrap', 'baking paper', 'parchment paper', 'kitchen roll',
			'paper towels', 'tissues', 'wet wipes', 'baby wipes', 'nappies', 'diapers',
			'broom', 'mop', 'candle', 'candles', 'batteries', 'light bulb', 'light bulbs',
			'hand soap', 'liquid soap', 'body lotion', 'lotion', 'sunscreen', 'sun cream',
			'toothbrush', 'mouthwash', 'conditioner', 'hair spray', 'hair gel', 'dry shampoo',
			'antiperspirant', 'insect repellent', 'bug spray', 'household', 'cleaning'
		],
		category: {
			color: '#A78BFA',
			svgContent: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`
		}
	},
	{
		key: 'nudeln',
		keywords: [
			'nudeln', 'pasta', 'spaghetti', 'penne', 'rigatoni', 'fusilli', 'farfalle', 'tagliatelle',
			'lasagne', 'lasagna', 'gnocchi', 'tortellini', 'ravioli', 'linguine', 'fettuccine',
			'reis', 'jasminreis', 'basmati', 'risottoreis', 'vollkornnudeln', 'dinkelnnudeln',
			'suppennudeln', 'bandnudeln', 'makkaroni', 'spirelli', 'conchiglie', 'orecchiette',
			'polenta', 'couscous', 'bulgur', 'quinoa', 'amaranth', 'hirse', 'buchweizen',
			'reisnudeln', 'glasnudeln', 'udon', 'soba', 'ramen',
			// English
			'noodles', 'rice', 'basmati rice', 'jasmine rice', 'risotto rice', 'brown rice',
			'whole wheat pasta', 'macaroni', 'vermicelli', 'orzo', 'couscous', 'bulgur',
			'quinoa', 'millet', 'buckwheat', 'rice noodles', 'glass noodles', 'egg noodles'
		],
		category: {
			color: '#F97316',
			svgContent: `<path d="M3 13h18"/><path d="M3 13a9 9 0 0 0 18 0"/><path d="M9 6.5v3"/><path d="M12 5v4"/><path d="M15 6.5v3"/>`
		}
	},
	{
		key: 'konserven',
		keywords: [
			'dose', 'konserve', 'ketchup', 'senf', 'mayonnaise', 'mayo', 'soße', 'sauce',
			'tomatenmark', 'passata', 'tomaten dose', 'tomaten passiert', 'dosentomaten',
			'aufstrich', 'hummus', 'pesto', 'ajvar', 'tapenade', 'remoulade',
			'miracel whip', 'miracle whip', 'hengstenberg', 'gürkchen', 'kapern',
			'oliven', 'mais dose', 'bohnen dose', 'kidneybohnen', 'kichererbsen',
			'linsen', 'erbsen dose', 'sardinen dose', 'thunfisch dose',
			// English
			'can', 'canned', 'tin', 'tinned', 'ketchup', 'mustard', 'mayonnaise',
			'tomato paste', 'tomato sauce', 'passata', 'tinned tomatoes', 'canned tomatoes',
			'jam', 'marmalade', 'spread', 'pesto', 'olives', 'capers',
			'canned beans', 'kidney beans', 'chickpeas', 'lentils', 'canned corn',
			'canned fish', 'canned tuna', 'canned sardines'
		],
		category: {
			color: '#78716C',
			svgContent: `<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v10c0 1.66 3.58 3 8 3s8-1.34 8-3V7"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>`
		}
	},
	{
		key: 'gewuerze',
		keywords: [
			'öl', 'olivenöl', 'sonnenblumenöl', 'rapsöl', 'kokosöl', 'sesamöl', 'leinöl',
			'essig', 'apfelessig', 'balsamico', 'weinessig', 'weißweinessig', 'rotweinessig',
			'salz', 'meersalz', 'himalayasalz', 'jodsalz', 'pfeffer', 'pfefferkörner',
			'gewürz', 'gewürze', 'gewürzmischung', 'kräuter', 'kräutermischung',
			'curry', 'currypulver', 'paprikapulver', 'zimt', 'vanille', 'vanillezucker',
			'vanilleschote', 'muskat', 'muskatnuss', 'oregano', 'basilikum getrocknet',
			'thymian getrocknet', 'rosmarin getrocknet', 'lorbeer', 'lorbeerblatt',
			'kreuzkümmel', 'kümmel', 'fenchelsamen', 'anis', 'kardamom', 'kurkuma',
			'ingwerpulver', 'chilipulver', 'chiliflocken', 'cayennepfeffer', 'paprikaschrot',
			'knoblauchpulver', 'zwiebelpulver', 'petersilie getrocknet', 'schnittlauch getrocknet',
			'zucker', 'brauner zucker', 'rohrzucker', 'puderzucker', 'traubenzucker',
			'honig', 'ahornsirup', 'agavendicksaft', 'agavensirup', 'stevia',
			'sojasauce', 'worcester', 'worcestersauce', 'tabasco', 'sambal', 'sriracha',
			'fischsauce', 'austernsoße', 'hoisin', 'teriyaki', 'tahini',
			'brühe', 'suppenwürfel', 'gemüsebrühe', 'hühnerbrühe', 'rinderbrühe', 'fond',
			'backpulver', 'natron', 'hefe', 'trockenhefe',
			// English
			'oil', 'olive oil', 'sunflower oil', 'rapeseed oil', 'coconut oil', 'sesame oil',
			'vinegar', 'apple cider vinegar', 'balsamic vinegar', 'white wine vinegar',
			'salt', 'sea salt', 'himalayan salt', 'pepper', 'peppercorns',
			'spice', 'spices', 'herb', 'herbs', 'seasoning', 'mixed herbs',
			'curry powder', 'cinnamon', 'vanilla', 'vanilla sugar', 'vanilla extract',
			'nutmeg', 'oregano', 'basil dried', 'thyme dried', 'rosemary dried', 'bay leaf',
			'cumin', 'fennel seeds', 'anise', 'cardamom', 'turmeric', 'ginger powder',
			'chili powder', 'chili flakes', 'cayenne pepper', 'paprika powder', 'garlic powder',
			'onion powder', 'sugar', 'brown sugar', 'cane sugar', 'icing sugar', 'powdered sugar',
			'honey', 'maple syrup', 'agave syrup', 'agave nectar', 'stevia',
			'soy sauce', 'worcestershire sauce', 'hot sauce', 'sriracha', 'fish sauce',
			'oyster sauce', 'hoisin sauce', 'teriyaki sauce', 'tahini',
			'stock', 'stock cube', 'broth', 'vegetable stock', 'chicken stock', 'beef stock',
			'baking powder', 'baking soda', 'bicarbonate of soda', 'yeast', 'dried yeast'
		],
		category: {
			color: '#D97706',
			svgContent: `<path d="M8 2h8"/><path d="M9 2v2"/><path d="M15 2v2"/><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M6 10h12"/>`
		}
	}
];

// Default sort order (index 0 = bottom of grid, index last = top of grid)
export const DEFAULT_CATEGORY_ORDER = ['obst', 'nudeln', 'backwaren', 'milch', 'fleisch', 'konserven', 'gewuerze', 'getraenke', 'tiefkuehl', 'snacks', 'haushalt', 'default'];

export const CATEGORY_LABELS: Record<string, { de: string; en: string }> = {
	obst:      { de: 'Obst & Gemüse',      en: 'Fruit & Veg' },
	nudeln:    { de: 'Nudeln & Reis',      en: 'Pasta & Rice' },
	backwaren: { de: 'Backwaren',           en: 'Bakery' },
	milch:     { de: 'Milch & Käse',       en: 'Dairy' },
	fleisch:   { de: 'Fleisch & Fisch',    en: 'Meat & Fish' },
	konserven: { de: 'Konserven & Saucen', en: 'Canned & Sauces' },
	gewuerze:  { de: 'Gewürze & Zutaten',  en: 'Spices & Pantry' },
	getraenke: { de: 'Getränke',            en: 'Drinks' },
	tiefkuehl: { de: 'Tiefkühlkost',       en: 'Frozen' },
	snacks:    { de: 'Snacks & Süßes',     en: 'Snacks' },
	haushalt:  { de: 'Haushalt',            en: 'Household' },
	default:   { de: 'Alles andere',        en: 'Everything else' },
};

const categoryByKey = new Map(CATEGORIES.map(c => [c.key, c.category]));

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function matchesKeyword(name: string, keyword: string): boolean {
	if (new RegExp('(^|\\s)' + escapeRegex(keyword), 'i').test(name)) return true;
	if (keyword.length >= 5 && name.includes(keyword)) return true;
	return false;
}

function getBrandKey(name: string): string | null {
	const lower = name.toLowerCase().trim();
	// Exact match first
	if (BRAND_CATEGORIES[lower]) return BRAND_CATEGORIES[lower];
	// Check if name starts with a known brand
	for (const brand of Object.keys(BRAND_CATEGORIES)) {
		if (lower.startsWith(brand + ' ') || lower === brand) {
			return BRAND_CATEGORIES[brand];
		}
	}
	return null;
}

export function getCategoryForItem(name: string, override?: string | null): Category {
	if (override) return categoryByKey.get(override) ?? DEFAULT;
	const lower = name.toLowerCase();
	const brandKey = getBrandKey(lower);
	if (brandKey) return categoryByKey.get(brandKey) ?? DEFAULT;
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
	const brandKey = getBrandKey(lower);
	if (brandKey) return brandKey;
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
