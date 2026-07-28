import type { VisualGroup } from '$lib/itemVisualGroups';

export type ResolverSource =
	| 'override'
	| 'phrase'
	| 'headword'
	| 'compound'
	| 'word'
	| 'hint'
	| 'brand'
	| 'fallback';

export type ResolverConfidence = 'high' | 'medium' | 'low';

export type ItemResolution = {
	conceptId: string;
	categoryKey: string;
	visualGroup?: VisualGroup;
	source: ResolverSource;
	confidence: ResolverConfidence;
};

export type ResolverCategory = {
	key: string;
	keywords: string[];
};

type ConceptRule = {
	id: string;
	categoryKey: string;
	visualGroup?: VisualGroup;
	modifier?: boolean;
	phrases?: string[];
	headwords?: string[];
	compoundSuffixes?: string[];
	words?: string[];
};

type CompiledRule = Omit<ConceptRule, 'phrases' | 'headwords' | 'compoundSuffixes' | 'words'> & {
	phrases: string[];
	headwords: string[];
	compoundSuffixes: string[];
	words: string[];
};

type RuleMatch = {
	rule: CompiledRule;
	matched: string;
	source: Exclude<ResolverSource, 'override' | 'hint' | 'brand' | 'fallback'>;
	tokenIndex: number;
};

const CONCEPT_RULES: ConceptRule[] = [
	// Vollständige Produkt- und Verpackungsformen. Diese Stufe gewinnt immer.
	{
		id: 'tomato-paste', categoryKey: 'konserven', visualGroup: 'tube',
		phrases: ['tomatenmark', 'tomato paste', 'tomato puree tube', 'tomatenmark tube']
	},
	{
		id: 'toothpaste', categoryKey: 'koerperpflege', visualGroup: 'tube',
		phrases: ['zahnpasta', 'zahncreme', 'toothpaste', 'tooth paste', 'dental cream']
	},
	{
		id: 'canned-product', categoryKey: 'konserven',
		phrases: ['thunfischdose', 'thunfisch dose', 'canned tuna', 'tinned tuna', 'sardinen dose', 'canned sardines', 'tinned sardines', 'mais dose', 'bohnen dose', 'erbsen dose', 'canned beans', 'canned corn', 'canned fish', 'tinned fish'],
		headwords: ['dose', 'konserve', 'can', 'tin'],
		compoundSuffixes: ['dose', 'konserve'],
		words: ['canned', 'tinned']
	},
	{
		id: 'nutella-spread', categoryKey: 'snacks', visualGroup: 'spread',
		phrases: ['nutella', 'hazelnut spread', 'nuss nougat creme', 'nuss-nougat-creme']
	},
	{
		id: 'spread', categoryKey: 'konserven', visualGroup: 'spread',
		phrases: ['brotaufstrich', 'fruit spread', 'peanut butter', 'erdnussbutter', 'almond butter', 'mandelbutter', 'nut butter', 'hazelnut butter', 'mandelmus', 'cashewmus', 'nussmus', 'pflaumenmus', 'apfelmus'],
		headwords: ['marmelade', 'konfituere', 'gelee', 'aufstrich', 'pesto', 'hummus', 'ajvar', 'tapenade'],
		compoundSuffixes: ['marmelade', 'konfituere', 'aufstrich']
	},
	{
		id: 'household-cleaner', categoryKey: 'haushalt', visualGroup: 'cleaner-spray',
		phrases: ['badreiniger', 'glasreiniger', 'allzweckreiniger', 'kuechenreiniger', 'ofenreiniger', 'rohrreiniger', 'desinfektionsreiniger', 'cleaning spray', 'surface spray', 'bathroom cleaner', 'glass cleaner', 'all purpose cleaner', 'multi surface cleaner'],
		headwords: ['reiniger', 'putzmittel', 'cleaner'],
		compoundSuffixes: ['reiniger']
	},
	{
		id: 'paper-goods', categoryKey: 'haushalt', visualGroup: 'paper-goods',
		phrases: ['toilettenpapier', 'toilet paper', 'toilet roll', 'loo roll', 'kuechenrolle', 'kitchen roll', 'paper towels', 'papiertuecher', 'papiertaschentuch', 'taschentuecher', 'paper tissues'],
		headwords: ['kuechenrolle', 'toilettenpapier', 'taschentuecher', 'tissues'],
		compoundSuffixes: ['papier', 'kuechenrolle']
	},
	{
		id: 'liquid-personal-care', categoryKey: 'koerperpflege', visualGroup: 'liquid-care',
		phrases: ['duschgel', 'shower gel', 'body wash', 'handseife', 'fluessigseife', 'liquid soap', 'hand soap', 'bodylotion', 'body lotion', 'mizellenwasser', 'micellar water', 'reinigungsmilch', 'cleansing milk'],
		headwords: ['shampoo', 'conditioner', 'seife', 'soap', 'mundwasser', 'mouthwash'],
		compoundSuffixes: ['shampoo', 'duschgel', 'seife']
	},
	{
		id: 'tea', categoryKey: 'getraenke', visualGroup: 'tea',
		phrases: ['iced tea', 'ice tea', 'herbal tea', 'green tea', 'black tea', 'fruit tea', 'chai tea'],
		headwords: ['tee', 'tea', 'matcha', 'chai'],
		compoundSuffixes: ['tee']
	},
	{
		id: 'coffee', categoryKey: 'getraenke', visualGroup: 'coffee',
		phrases: ['cold brew', 'iced coffee', 'filter coffee', 'instant coffee', 'latte macchiato'],
		headwords: ['kaffee', 'coffee', 'espresso', 'cappuccino', 'latte', 'frappuccino'],
		compoundSuffixes: ['kaffee']
	},
	{
		id: 'sparkling-wine', categoryKey: 'getraenke', visualGroup: 'sparkling-wine',
		phrases: ['sparkling wine'],
		headwords: ['sekt', 'prosecco', 'champagner', 'champagne'],
		compoundSuffixes: ['sekt']
	},
	{
		id: 'wine', categoryKey: 'getraenke', visualGroup: 'wine',
		phrases: ['red wine', 'white wine', 'rose wine', 'gluehwein', 'rotwein', 'weisswein', 'apfelwein', 'weinschorle'],
		headwords: ['wein', 'wine']
	},
	{
		id: 'beer', categoryKey: 'getraenke', visualGroup: 'beer',
		headwords: ['bier', 'beer', 'radler'],
		compoundSuffixes: ['bier']
	},
	{
		id: 'spirits', categoryKey: 'getraenke', visualGroup: 'spirits',
		phrases: ['eierlikoer'],
		headwords: ['schnaps', 'whisky', 'whiskey', 'rum', 'vodka', 'gin', 'likoer'],
		compoundSuffixes: ['schnaps', 'likoer']
	},
	{
		id: 'alcohol', categoryKey: 'getraenke', visualGroup: 'alcohol-neutral',
		phrases: ['hard cider'],
		headwords: ['alkohol', 'alcohol', 'cocktail', 'cider']
	},
	{
		id: 'egg', categoryKey: 'milch', visualGroup: 'egg', modifier: true,
		headwords: ['ei', 'eier', 'egg', 'eggs']
	},
	{
		id: 'nuts', categoryKey: 'snacks', visualGroup: 'nuts', modifier: true,
		phrases: ['mixed nuts', 'trail mix', 'studentenfutter', 'brazil nut', 'brazil nuts'],
		headwords: ['nuss', 'nuesse', 'erdnuss', 'erdnuesse', 'mandel', 'mandeln', 'cashew', 'cashews', 'walnuss', 'walnuesse', 'pistazie', 'pistazien', 'macadamia', 'pekannuss', 'paranuss', 'hazelnut', 'hazelnuts', 'peanut', 'peanuts', 'almond', 'almonds', 'walnut', 'walnuts', 'pistachio', 'pistachios', 'pecan', 'pecans'],
		compoundSuffixes: ['nuss', 'nuesse']
	},
	{
		id: 'dairy-cup', categoryKey: 'milch', visualGroup: 'dairy-cup',
		phrases: ['greek yogurt', 'greek yoghurt', 'strawberry yogurt', 'strawberry yoghurt', 'erdbeer joghurt', 'naturjoghurt', 'fruchtjoghurt', 'rahmjoghurt', 'griechischer joghurt', 'sour cream', 'creme fraiche', 'cottage cheese'],
		headwords: ['quark', 'speisequark', 'magerquark', 'skyr', 'joghurt', 'yogurt', 'yoghurt', 'schmand', 'sauerrahm', 'huettenkaese'],
		compoundSuffixes: ['quark', 'skyr', 'joghurt', 'yogurt', 'yoghurt']
	},
	{
		id: 'liquid-dairy', categoryKey: 'milch', visualGroup: 'milk-container',
		phrases: ['whole milk', 'condensed milk', 'whipped cream', 'whipping cream', 'heavy cream', 'double cream', 'single cream', 'clotted cream'],
		headwords: ['milch', 'milk', 'vollmilch', 'buttermilch', 'buttermilk', 'kondensmilch', 'kaffeemilch', 'kefir', 'sahne', 'schlagsahne', 'obers'],
		compoundSuffixes: ['milch', 'buttermilch', 'sahne']
	},
	{
		id: 'plant-milk', categoryKey: 'getraenke', visualGroup: 'milk-container',
		phrases: ['oat milk', 'almond milk', 'soy milk', 'rice milk', 'coconut milk', 'oatmilk', 'almondmilk', 'soymilk', 'rice milk drink', 'hafermilch', 'mandelmilch', 'sojamilch', 'reismilch', 'kokosmilch']
	},
	{
		id: 'condiment-bottle', categoryKey: 'konserven', visualGroup: 'sauce-bottle',
		phrases: ['bbq sauce', 'barbecue sauce', 'burger sauce', 'cocktail sauce', 'salad dressing', 'salatdressing'],
		headwords: ['ketchup', 'senf', 'mustard', 'mayonnaise', 'mayo', 'remoulade', 'dressing'],
		compoundSuffixes: ['dressing']
	},
	{
		id: 'hot-condiment-bottle', categoryKey: 'gewuerze', visualGroup: 'sauce-bottle',
		phrases: ['hot sauce', 'chili sauce', 'chilli sauce'],
		headwords: ['sriracha', 'tabasco']
	},
	{
		id: 'oil-vinegar-bottle', categoryKey: 'gewuerze', visualGroup: 'oil-bottle',
		phrases: ['olive oil', 'sunflower oil', 'rapeseed oil', 'coconut oil', 'sesame oil', 'linseed oil', 'balsamic vinegar', 'apple cider vinegar', 'white wine vinegar', 'red wine vinegar', 'soy sauce', 'fish sauce', 'oyster sauce', 'worcestershire sauce', 'maple syrup', 'agave syrup', 'agave nectar', 'olivenoel', 'sonnenblumenoel', 'rapsoel', 'kokosoel', 'sesamoel', 'leinoel', 'apfelessig', 'weissweinessig', 'rotweinessig', 'sojasauce', 'fischsauce', 'austernsosse', 'worcestersauce', 'ahornsirup', 'agavensirup', 'agavendicksaft'],
		headwords: ['oel', 'oil', 'essig', 'vinegar', 'balsamico'],
		compoundSuffixes: ['oel', 'essig']
	},
	{
		id: 'snack-bag', categoryKey: 'snacks', visualGroup: 'snack-bag',
		phrases: ['tortilla chips', 'potato chips', 'rice cakes', 'salt sticks'],
		headwords: ['chips', 'crisps', 'nachos', 'popcorn', 'salzstangen', 'cracker', 'crackers', 'reiswaffel', 'reiswaffeln'],
		compoundSuffixes: ['chips']
	},
	{
		id: 'packaged-pretzels', categoryKey: 'backwaren', visualGroup: 'snack-bag',
		headwords: ['pretzel', 'pretzels']
	},
	{
		id: 'breakfast-cereal', categoryKey: 'backwaren', visualGroup: 'cereal-bowl',
		phrases: ['breakfast cereal', 'breakfast cereals', 'corn flakes'],
		headwords: ['muesli', 'granola', 'haferflocken', 'oats', 'oatmeal', 'porridge', 'cornflakes', 'cereal', 'cereals'],
		compoundSuffixes: ['muesli', 'cornflakes']
	},
	{
		id: 'detergent', categoryKey: 'haushalt', visualGroup: 'detergent',
		phrases: ['dish soap', 'washing up liquid', 'laundry detergent', 'liquid detergent', 'washing powder', 'fabric softener', 'dishwasher tablets', 'dishwasher pods', 'rinse aid'],
		headwords: ['spuelmittel', 'geschirrspuelmittel', 'waschmittel', 'fluessigwaschmittel', 'waschpulver', 'weichspueler', 'klarspueler', 'detergent'],
		compoundSuffixes: ['spuelmittel', 'waschmittel', 'weichspueler', 'klarspueler']
	},
	// Zutaten- oder Verarbeitungsphrasen müssen vor ihren Bestandteilen gewinnen.
	{
		id: 'pantry-sauce', categoryKey: 'gewuerze',
		phrases: ['fischsauce', 'fish sauce', 'austernsosse', 'oyster sauce', 'sojasauce', 'soy sauce', 'hot sauce', 'hoisin sauce', 'teriyaki sauce', 'worcestershire sauce', 'worcestersauce', 'apple cider vinegar', 'white wine vinegar', 'red wine vinegar', 'gemuesebruehe', 'huehnerbruehe', 'rinderbruehe', 'vegetable stock', 'chicken stock', 'beef stock', 'agavendicksaft', 'muskatnuss', 'basilikum getrocknet', 'thymian getrocknet', 'rosmarin getrocknet', 'petersilie getrocknet', 'schnittlauch getrocknet', 'basil dried', 'thyme dried', 'rosemary dried']
	},
	{
		id: 'frozen-food', categoryKey: 'tiefkuehl',
		phrases: ['ice cream', 'eiscreme', 'fish fingers', 'fish sticks', 'fischstaebchen', 'chicken nuggets', 'mozzarella sticks', 'frozen fish', 'frozen vegetables', 'frozen pizza', 'frozen peas', 'frozen spinach', 'chips frozen', 'tiefkuehlfisch', 'tiefkuehlgemuese', 'tiefkuehlpizza', 'tk fisch', 'tk gemuese', 'tk pizza', 'schlemmerfilet', 'belegtes baguette', 'french fries', 'hash browns', 'spring rolls'],
		headwords: ['pizza', 'pommes', 'sorbet', 'gelato', 'popsicle'],
		compoundSuffixes: ['pizza'],
		words: ['tiefkuehl', 'tiefgefroren', 'gefroren', 'frozen', 'tk']
	},
	{
		id: 'dairy-product', categoryKey: 'milch',
		phrases: ['cream cheese', 'sour cream', 'condensed milk', 'whipped cream', 'cottage cheese', 'greek yogurt', 'heavy cream', 'double cream', 'single cream', 'clotted cream', 'creme fraiche', 'strawberry yogurt', 'strawberry yoghurt', 'erdbeer joghurt', 'eierpfannkuchen'],
		headwords: ['milch', 'milk', 'kaese', 'cheese', 'joghurt', 'yogurt', 'yoghurt', 'butter', 'quark', 'sahne', 'cream', 'mozzarella', 'parmesan', 'gouda', 'emmentaler', 'brie', 'camembert', 'ricotta', 'feta', 'skyr', 'kefir', 'halloumi', 'burrata'],
		compoundSuffixes: ['milch', 'kaese', 'joghurt', 'quark', 'butter', 'sahne']
	},
	{
		id: 'fish-seafood', categoryKey: 'fleisch', visualGroup: 'fish',
		phrases: ['sea bass', 'sea bream', 'smoked salmon', 'raeucherlachs', 'wildlachs', 'jakobsmuscheln'],
		headwords: ['fisch', 'fish', 'lachs', 'salmon', 'thunfisch', 'tuna', 'forelle', 'trout', 'hering', 'herring', 'garnele', 'garnelen', 'shrimp', 'shrimps', 'prawns', 'muscheln', 'mussels', 'tintenfisch', 'squid', 'kabeljau', 'cod', 'scholle', 'tilapia', 'seelachs', 'crevetten', 'krabben', 'crab', 'dorade', 'wolfsbarsch', 'sardinen', 'sardines', 'anchovis', 'anchovies', 'scallops'],
		compoundSuffixes: ['fisch', 'lachs']
	},
	{
		id: 'meat-product', categoryKey: 'fleisch',
		phrases: ['ground beef', 'minced meat', 'chicken breast', 'chicken thigh', 'chicken wings', 'turkey breast', 'lamb chops', 'pork belly', 'pork chop', 'hot dog', 'roast beef', 'plant based meat', 'vegan meat', 'veggie burger', 'veggie sausage', 'vegan sausage', 'vegan chicken', 'leberkaese', 'wildschwein'],
		headwords: ['fleisch', 'meat', 'huhn', 'haehnchen', 'huehnchen', 'chicken', 'rind', 'beef', 'schwein', 'pork', 'wurst', 'wuerstchen', 'sausage', 'sausages', 'schnitzel', 'hack', 'hackfleisch', 'steak', 'filet', 'pute', 'turkey', 'lamm', 'lamb', 'kalb', 'veal', 'speck', 'bacon', 'schinken', 'ham', 'salami', 'chorizo', 'frikadelle', 'mett', 'gyros', 'doener', 'gefluegel', 'poultry', 'tofu', 'tempeh', 'seitan', 'quorn'],
		compoundSuffixes: ['fleisch', 'wurst', 'wuerstchen', 'schnitzel', 'steak', 'filet', 'schinken', 'speck']
	},
	{
		id: 'juice-drink', categoryKey: 'getraenke',
		phrases: ['energy drink', 'hot chocolate', 'mineral water', 'sparkling water', 'tonic water', 'ginger beer', 'oat milk', 'almond milk', 'soy milk', 'rice milk', 'coconut milk', 'hafermilch', 'mandelmilch', 'sojamilch', 'reismilch', 'kokosmilch', 'bananenmilch'],
		headwords: ['wasser', 'water', 'saft', 'juice', 'cola', 'limonade', 'lemonade', 'getraenk', 'getraenke', 'drink', 'drinks', 'sprudel', 'smoothie', 'kakao', 'cocoa', 'sirup', 'syrup', 'kombucha', 'soda', 'squash'],
		compoundSuffixes: ['wasser', 'saft', 'schorle', 'limonade']
	},
	{
		id: 'snack-sweet', categoryKey: 'snacks',
		phrases: ['milk chocolate', 'dark chocolate', 'tortilla chips', 'granola bar', 'cereal bar', 'protein bar', 'energy bar', 'rice cakes', 'gummy bears', 'fruit gummies', 'jelly beans', 'lebkuchen'],
		headwords: ['schokolade', 'chocolate', 'chips', 'keks', 'kekse', 'cookie', 'cookies', 'candy', 'sweet', 'sweets', 'snack', 'snacks', 'bonbon', 'riegel', 'popcorn', 'cracker', 'crackers', 'praline', 'pralinen', 'lakritze', 'licorice', 'liquorice', 'karamell', 'caramel', 'lollipop', 'nachos', 'marshmallow', 'nougat', 'toffee', 'fudge'],
		compoundSuffixes: ['schokolade', 'riegel', 'keks']
	},
	{
		id: 'bakery-product', categoryKey: 'backwaren',
		phrases: ['rice flour', 'whole wheat', 'whole grain', 'sandwich bread', 'rye bread', 'baking powder', 'kekse', 'cookie', 'cookies'],
		headwords: ['brot', 'bread', 'broetchen', 'roll', 'rolls', 'toast', 'kuchen', 'cake', 'mehl', 'flour', 'croissant', 'baguette', 'ciabatta', 'brezel', 'pretzel', 'pretzels', 'muffin', 'donut', 'waffel', 'waffle', 'waffles', 'zwieback', 'knaeckebrot', 'crispbread', 'tortilla', 'wrap', 'pita', 'naan', 'bagel', 'brioche', 'hefe', 'yeast', 'paniermehl', 'breadcrumbs', 'haferflocken', 'oats', 'oatmeal', 'muesli', 'granola'],
		compoundSuffixes: ['brot', 'broetchen', 'mehl', 'kuchen', 'waffel']
	},
	{
		id: 'pasta-rice', categoryKey: 'nudeln',
		phrases: ['basmati rice', 'jasmine rice', 'risotto rice', 'brown rice', 'whole wheat pasta', 'rice noodles', 'glass noodles', 'egg noodles'],
		headwords: ['nudeln', 'noodles', 'pasta', 'spaghetti', 'penne', 'rigatoni', 'fusilli', 'farfalle', 'tagliatelle', 'lasagne', 'lasagna', 'gnocchi', 'tortellini', 'ravioli', 'linguine', 'fettuccine', 'reis', 'rice', 'basmati', 'couscous', 'bulgur', 'quinoa', 'hirse', 'millet', 'udon', 'soba', 'ramen', 'macaroni', 'vermicelli', 'orzo'],
		compoundSuffixes: ['nudeln', 'reis', 'pasta']
	},
	{
		id: 'canned-sauce', categoryKey: 'konserven',
		phrases: ['tomato sauce', 'tomaten passiert', 'tinned tomatoes', 'canned tomatoes', 'instant soup', 'canned soup', 'ready meal', 'ready sauce'],
		headwords: ['ketchup', 'senf', 'mustard', 'mayonnaise', 'mayo', 'sosse', 'sauce', 'passata', 'oliven', 'olives', 'kapern', 'capers', 'linsen', 'lentils', 'kichererbsen', 'chickpeas', 'suppe', 'soup'],
		compoundSuffixes: ['sosse', 'sauce', 'suppe']
	},
	{
		id: 'pantry-staple', categoryKey: 'gewuerze',
		phrases: ['olive oil', 'sunflower oil', 'rapeseed oil', 'coconut oil', 'sesame oil', 'balsamic vinegar', 'sea salt', 'curry powder', 'vanilla extract', 'bay leaf', 'fennel seeds', 'ginger powder', 'chili powder', 'chili flakes', 'cayenne pepper', 'paprika powder', 'garlic powder', 'onion powder', 'brown sugar', 'cane sugar', 'icing sugar', 'powdered sugar', 'maple syrup', 'agave syrup', 'agave nectar', 'stock cube'],
		headwords: ['oel', 'oil', 'essig', 'vinegar', 'salz', 'salt', 'pfeffer', 'pepper', 'gewuerz', 'gewuerze', 'spice', 'spices', 'seasoning', 'curry', 'zimt', 'cinnamon', 'vanille', 'vanilla', 'muskat', 'nutmeg', 'oregano', 'kuemmel', 'cumin', 'anis', 'anise', 'kardamom', 'cardamom', 'kurkuma', 'turmeric', 'zucker', 'sugar', 'honig', 'honey', 'stevia', 'bruehe', 'broth', 'stock', 'fond'],
		compoundSuffixes: ['oel', 'essig', 'salz', 'pfeffer', 'gewuerz', 'zucker', 'bruehe']
	},
	{
		id: 'personal-care', categoryKey: 'koerperpflege',
		phrases: ['cotton swabs', 'cotton buds', 'sanitary pads', 'body scrub', 'face cream', 'facial cream', 'sun cream', 'dry shampoo', 'insect repellent', 'bug spray', 'hair spray', 'hair gel', 'nail polish', 'lip balm', 'lip gloss', 'face mask', 'facial mask', 'make up remover', 'personal care', 'deo roll on', 'gesichtswasser', 'bb cream', 'cc cream'],
		headwords: ['deo', 'deodorant', 'rasierer', 'razor', 'razors', 'kondome', 'condoms', 'tampons', 'binden', 'pads', 'pflaster', 'bandage', 'creme', 'lotion', 'sonnencreme', 'sunscreen', 'zahnbuerste', 'toothbrush', 'haarspray', 'haargel', 'makeup', 'parfuem', 'perfume', 'serum'],
		compoundSuffixes: ['creme', 'lotion', 'deo']
	},
	{
		id: 'household-product', categoryKey: 'haushalt',
		phrases: ['dish soap', 'washing up liquid', 'laundry detergent', 'fabric softener', 'dishwasher tablets', 'dishwasher pods', 'trash bags', 'bin bags', 'garbage bags', 'aluminium foil', 'aluminum foil', 'cling film', 'plastic wrap', 'baking paper', 'parchment paper', 'wet wipes', 'baby wipes', 'light bulb', 'light bulbs', 'gluehbirne'],
		headwords: ['spuelmittel', 'waschmittel', 'detergent', 'muellbeutel', 'schwamm', 'sponge', 'weichspueler', 'tabs', 'klebeband', 'tape', 'folie', 'foil', 'backpapier', 'putztuch', 'lappen', 'besen', 'broom', 'mop', 'kerze', 'candle', 'candles', 'batterien', 'batteries', 'windeln', 'nappies', 'diapers'],
		compoundSuffixes: ['spuelmittel', 'waschmittel', 'muellbeutel', 'folie', 'papier']
	},
	{
		id: 'apple', categoryKey: 'obst', visualGroup: 'apple', modifier: true,
		headwords: ['apfel', 'aepfel', 'apple', 'apples'],
		compoundSuffixes: ['apfel']
	},
	{
		id: 'banana', categoryKey: 'obst', visualGroup: 'banana', modifier: true,
		headwords: ['banane', 'bananen', 'banana', 'bananas'],
		compoundSuffixes: ['banane']
	},
	{
		id: 'pear', categoryKey: 'obst', visualGroup: 'pear', modifier: true,
		headwords: ['birne', 'birnen', 'pear', 'pears'],
		compoundSuffixes: ['birne']
	},
	{
		id: 'orange', categoryKey: 'obst', visualGroup: 'orange', modifier: true,
		headwords: ['orange', 'orangen']
	},
	{
		id: 'lemon', categoryKey: 'obst', visualGroup: 'lemon', modifier: true,
		headwords: ['zitrone', 'zitronen', 'lemon', 'lemons'],
		compoundSuffixes: ['zitrone']
	},
	{
		id: 'strawberry', categoryKey: 'obst', visualGroup: 'strawberry', modifier: true,
		headwords: ['erdbeere', 'erdbeeren', 'strawberry', 'strawberries']
	},
	{
		id: 'grapes', categoryKey: 'obst', visualGroup: 'grapes', modifier: true,
		headwords: ['traube', 'trauben', 'weintraube', 'weintrauben', 'grape', 'grapes']
	},
	{
		id: 'fruit', categoryKey: 'obst', modifier: true,
		phrases: ['passion fruit', 'dragon fruit'],
		headwords: ['beere', 'beeren', 'berry', 'berries', 'heidelbeere', 'blueberry', 'blueberries', 'himbeere', 'raspberry', 'raspberries', 'mandarine', 'mandarin', 'kiwi', 'mango', 'ananas', 'pineapple', 'pflaume', 'plum', 'plums', 'kirsche', 'cherry', 'cherries', 'pfirsich', 'peach', 'peaches', 'nektarine', 'nectarine', 'melone', 'melon', 'wassermelone', 'watermelon', 'granatapfel', 'pomegranate', 'papaya', 'lime', 'limes', 'grapefruit'],
		compoundSuffixes: ['beere', 'pflaume', 'kirsche', 'melone']
	},
	{
		id: 'carrot', categoryKey: 'obst', visualGroup: 'carrot', modifier: true,
		headwords: ['karotte', 'karotten', 'carrot', 'carrots', 'moehre', 'moehren']
	},
	{
		id: 'tomato', categoryKey: 'obst', visualGroup: 'tomato', modifier: true,
		headwords: ['tomate', 'tomaten', 'tomato', 'tomatoes'],
		compoundSuffixes: ['tomate']
	},
	{
		id: 'bell-pepper', categoryKey: 'obst', visualGroup: 'bell-pepper', modifier: true,
		phrases: ['bell pepper'],
		headwords: ['paprika', 'paprikaschote', 'capsicum']
	},
	{
		id: 'potato', categoryKey: 'obst', visualGroup: 'potato', modifier: true,
		phrases: ['sweet potato', 'sweet potatoes'],
		headwords: ['kartoffel', 'kartoffeln', 'suesskartoffel', 'potato', 'potatoes', 'erdapfel', 'erdaepfel'],
		compoundSuffixes: ['kartoffel']
	},
	{
		id: 'cucumber', categoryKey: 'obst', visualGroup: 'cucumber', modifier: true,
		headwords: ['gurke', 'gurken', 'cucumber', 'cucumbers'],
		compoundSuffixes: ['gurke']
	},
	{
		id: 'onion', categoryKey: 'obst', visualGroup: 'onion', modifier: true,
		headwords: ['zwiebel', 'zwiebeln', 'onion', 'onions'],
		compoundSuffixes: ['zwiebel']
	},
	{
		id: 'broccoli', categoryKey: 'obst', visualGroup: 'broccoli', modifier: true,
		headwords: ['brokkoli', 'broccoli']
	},
	{
		id: 'mushroom', categoryKey: 'obst', visualGroup: 'mushroom', modifier: true,
		headwords: ['pilz', 'pilze', 'mushroom', 'mushrooms', 'champignon', 'champignons']
	},
	{
		id: 'vegetable', categoryKey: 'obst', modifier: true,
		headwords: ['salat', 'lettuce', 'gemuese', 'vegetable', 'vegetables', 'knoblauch', 'garlic', 'spinat', 'spinach', 'sellerie', 'celery', 'lauch', 'leek', 'zucchini', 'courgette', 'avocado', 'kohlrabi', 'blumenkohl', 'cauliflower', 'rotkohl', 'cabbage', 'rucola', 'arugula', 'rocket', 'radieschen', 'radish', 'rettich', 'mais', 'corn', 'spargel', 'asparagus', 'aubergine', 'eggplant', 'fennel', 'artischocke', 'artichoke', 'pastinake', 'turnip', 'bok choy', 'pak choi'],
		compoundSuffixes: ['salat', 'kohl']
	},
	{
		id: 'fresh-herb', categoryKey: 'obst', modifier: true,
		headwords: ['petersilie', 'parsley', 'schnittlauch', 'chives', 'basilikum', 'basil', 'minze', 'mint', 'thymian', 'thyme', 'ingwer', 'ginger', 'koriander', 'cilantro', 'coriander', 'dill', 'rosmarin', 'rosemary', 'salbei', 'sage', 'zitronengras', 'lemongrass']
	}
];

export function normalizeItemName(value: string): string {
	return value
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[’‘`´]/g, "'")
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

function normalizeList(values: string[] | undefined): string[] {
	return [...new Set((values ?? []).map(normalizeItemName).filter(Boolean))]
		.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

const COMPILED_RULES: CompiledRule[] = CONCEPT_RULES.map(rule => ({
	...rule,
	phrases: normalizeList(rule.phrases),
	headwords: normalizeList(rule.headwords),
	compoundSuffixes: normalizeList(rule.compoundSuffixes),
	words: normalizeList(rule.words)
}));

const FLAVOR_HEADWORDS = new Set(normalizeList([
	'schokolade', 'chocolate', 'kakao', 'cocoa', 'vanille', 'vanilla', 'zimt', 'cinnamon',
	'karamell', 'caramel', 'honig', 'honey', 'zucker', 'sugar', 'salz', 'salt', 'pfeffer', 'pepper',
	'suess', 'suesses', 'sweet', 'sweets'
]));

function isModifierMatch(match: RuleMatch): boolean {
	if (match.source === 'compound') return false;
	return match.rule.modifier === true || FLAVOR_HEADWORDS.has(match.matched);
}

function containsPhrase(normalized: string, phrase: string): boolean {
	return (` ${normalized} `).includes(` ${phrase} `);
}

function bestPhraseMatch(normalized: string): RuleMatch | null {
	let best: RuleMatch | null = null;
	for (const rule of COMPILED_RULES) {
		for (const phrase of rule.phrases) {
			if (!containsPhrase(normalized, phrase)) continue;
			if (!best || phrase.length > best.matched.length) {
				best = { rule, matched: phrase, source: 'phrase', tokenIndex: -1 };
			}
		}
	}
	return best;
}

function bestHeadwordMatch(tokens: string[]): RuleMatch | null {
	let modifierFallback: RuleMatch | null = null;
	for (let tokenIndex = tokens.length - 1; tokenIndex >= 0; tokenIndex--) {
		const token = tokens[tokenIndex];
		let best: RuleMatch | null = null;
		for (const rule of COMPILED_RULES) {
			for (const headword of rule.headwords) {
				if (token !== headword) continue;
				if (!best || headword.length > best.matched.length) {
					best = { rule, matched: headword, source: 'headword', tokenIndex };
				}
			}
			for (const suffix of rule.compoundSuffixes) {
				if (token === suffix || token.length <= suffix.length || !token.endsWith(suffix)) continue;
				if (!best || suffix.length > best.matched.length) {
					best = { rule, matched: suffix, source: 'compound', tokenIndex };
				}
			}
		}
		if (!best) continue;
		if (!isModifierMatch(best)) return best;
		modifierFallback ??= best;
	}
	return modifierFallback;
}

function bestWordMatch(tokens: string[]): RuleMatch | null {
	let best: RuleMatch | null = null;
	for (let tokenIndex = tokens.length - 1; tokenIndex >= 0; tokenIndex--) {
		for (const rule of COMPILED_RULES) {
			for (const word of rule.words) {
				if (tokens[tokenIndex] !== word) continue;
				if (!best || word.length > best.matched.length) {
					best = { rule, matched: word, source: 'word', tokenIndex };
				}
			}
		}
	}
	return best;
}

function asResolution(match: RuleMatch): ItemResolution {
	return {
		conceptId: match.rule.id,
		categoryKey: match.rule.categoryKey,
		...(match.rule.visualGroup ? { visualGroup: match.rule.visualGroup } : {}),
		source: match.source,
		confidence: match.source === 'word' ? 'medium' : 'high'
	};
}

export function createItemResolver(
	categories: ResolverCategory[],
	brandCategories: Record<string, string>,
	defaultKey = 'default'
): (name: string, override?: string | null) => ItemResolution {
	const validCategoryKeys = new Set([...categories.map(category => category.key), defaultKey]);
	const hints = categories.flatMap((category, categoryIndex) =>
		category.key === defaultKey
			? []
			: category.keywords.map(keyword => ({
				categoryKey: category.key,
				categoryIndex,
				keyword: normalizeItemName(keyword)
			})).filter(hint => hint.keyword.length > 0)
	);
	const brands = Object.entries(brandCategories)
		.map(([brand, categoryKey]) => ({ brand: normalizeItemName(brand), categoryKey }))
		.filter(entry => entry.brand.length > 0 && validCategoryKeys.has(entry.categoryKey))
		.sort((a, b) => b.brand.length - a.brand.length || a.brand.localeCompare(b.brand));

	function bestHint(normalized: string, tokens: string[]): ItemResolution | null {
		let best: (typeof hints)[number] | null = null;
		for (const hint of hints) {
			const matched = hint.keyword.includes(' ')
				? containsPhrase(normalized, hint.keyword)
				: tokens.some(token => token === hint.keyword || (hint.keyword.length >= 5 && token.startsWith(hint.keyword)));
			if (!matched) continue;
			if (
				!best ||
				hint.keyword.length > best.keyword.length ||
				(hint.keyword.length === best.keyword.length && hint.categoryIndex < best.categoryIndex)
			) best = hint;
		}
		return best ? {
			conceptId: `category:${best.categoryKey}`,
			categoryKey: best.categoryKey,
			source: 'hint',
			confidence: 'medium'
		} : null;
	}

	function brandMatch(normalized: string): ItemResolution | null {
		const match = brands.find(entry => normalized === entry.brand || normalized.startsWith(`${entry.brand} `));
		return match ? {
			conceptId: `brand:${match.brand}`,
			categoryKey: match.categoryKey,
			source: 'brand',
			confidence: 'low'
		} : null;
	}

	return (name: string, override?: string | null): ItemResolution => {
		const normalized = normalizeItemName(name);
		const tokens = normalized ? normalized.split(' ') : [];
		const phrase = bestPhraseMatch(normalized);
		const phraseIsModifier = phrase ? isModifierMatch(phrase) : false;
		const headword = !phrase || phraseIsModifier ? bestHeadwordMatch(tokens) : null;
		const structuralMatch = phrase && !phraseIsModifier
			? phrase
			: headword && !isModifierMatch(headword)
				? headword
				: phrase ?? headword;
		const word = structuralMatch ? null : bestWordMatch(tokens);
		const base =
			(structuralMatch ? asResolution(structuralMatch) : null) ??
			(word ? asResolution(word) : null) ??
			bestHint(normalized, tokens) ??
			brandMatch(normalized) ?? {
				conceptId: 'unknown',
				categoryKey: defaultKey,
				source: 'fallback' as const,
				confidence: 'low' as const
			};

		if (!override || !validCategoryKeys.has(override)) return base;
		return { ...base, categoryKey: override, source: 'override', confidence: 'high' };
	};
}
