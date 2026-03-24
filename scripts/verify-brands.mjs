/**
 * Verify specific brand names against Open Food Facts DACH data.
 * One targeted search per brand, 3s delay between calls.
 *
 * Usage: node scripts/verify-brands.mjs
 */

const DELAY_MS = 3000;
const BASE = 'https://world.openfoodfacts.net';

// Brands to verify + our best guess for category
const CANDIDATES = [
  { name: 'almigurt',       guess: 'milch' },
  { name: 'bärenmarke',     guess: 'milch' },
  { name: 'lurpak',         guess: 'milch' },
  { name: 'babybel',        guess: 'milch' },
  { name: 'valio',          guess: 'milch' },
  { name: 'vitalis',        guess: 'backwaren' },
  { name: 'oroweat',        guess: 'backwaren' },
  { name: 'lieken',         guess: 'backwaren' },
  { name: 'bonduelle',      guess: 'konserven' },
  { name: 'garden gourmet', guess: 'fleisch' },
  { name: 'beyond meat',    guess: 'fleisch' },
  { name: 'valess',         guess: 'fleisch' },
  { name: 'voelkel',        guess: 'getraenke' },
  { name: 'sinalco',        guess: 'getraenke' },
];

const OFF_CATEGORY_MAP = {
  'en:beverages': 'getraenke', 'en:drinks': 'getraenke', 'en:waters': 'getraenke',
  'en:beers': 'getraenke', 'en:coffees': 'getraenke', 'en:teas': 'getraenke',
  'en:fruit-juices': 'getraenke', 'en:sodas': 'getraenke', 'en:energy-drinks': 'getraenke',
  'en:dairies': 'milch', 'en:dairy': 'milch', 'en:cheeses': 'milch',
  'en:milks': 'milch', 'en:yogurts': 'milch', 'en:butters': 'milch', 'en:creams': 'milch',
  'en:plant-based-foods-and-beverages': 'milch',
  'en:chocolates': 'snacks', 'en:candies': 'snacks', 'en:snacks': 'snacks',
  'en:biscuits-and-cakes': 'snacks', 'en:chips-and-crisps': 'snacks',
  'en:confectioneries': 'snacks', 'en:gummies': 'snacks',
  'en:breads': 'backwaren', 'en:cereals-and-potatoes': 'backwaren',
  'en:breakfast-cereals': 'backwaren',
  'en:pastas': 'nudeln', 'en:rices': 'nudeln', 'en:pasta': 'nudeln',
  'en:meats': 'fleisch', 'en:poultries': 'fleisch', 'en:seafood': 'fleisch',
  'en:fishes': 'fleisch', 'en:sausages': 'fleisch',
  'en:meat-alternatives': 'fleisch', 'en:plant-based-foods': 'fleisch',
  'en:canned-foods': 'konserven', 'en:sauces': 'konserven',
  'en:condiments': 'konserven', 'en:soups': 'konserven',
  'en:vegetables': 'konserven',
  'en:spices': 'gewuerze', 'en:herbs': 'gewuerze',
  'en:frozen-foods': 'tiefkuehl', 'en:ice-creams': 'tiefkuehl',
  'en:fruits': 'obst', 'en:fresh-produce': 'obst',
  'en:hygiene-and-beauty-products': 'haushalt', 'en:cleaning-products': 'haushalt',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkBrand(name, guess) {
  // Search for products with this brand in DE/AT/CH
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const url = `${BASE}/api/v2/search?brands_tags=${encodeURIComponent(slug)}&countries_tags=en:germany,en:austria,en:switzerland&fields=categories_tags&page_size=5&page=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Groly-BrandVerify/1.0 (personal grocery app)' }
  });

  if (!res.ok) {
    console.log(`  ${name}: HTTP ${res.status}`);
    await sleep(DELAY_MS);
    return null;
  }

  const data = await res.json();
  const count = data.count ?? 0;

  if (count === 0) {
    console.log(`  "${name}": 0 Produkte gefunden – möglicherweise anderer OFF-Slug`);
    await sleep(DELAY_MS);
    return { name, count: 0, category: null, guess };
  }

  // Aggregate category tags
  const allTags = (data.products ?? []).flatMap(p => p.categories_tags ?? []);
  const freq = {};
  for (const tag of allTags) freq[tag] = (freq[tag] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  let detectedCategory = null;
  for (const [tag] of sorted) {
    const cat = OFF_CATEGORY_MAP[tag];
    if (cat) { detectedCategory = cat; break; }
  }

  const match = detectedCategory === guess ? '✓' : detectedCategory ? `→ eigentlich '${detectedCategory}'` : '(Kategorie unklar)';
  console.log(`  "${name}": ${count} Produkte | Annahme '${guess}' ${match}`);

  await sleep(DELAY_MS);
  return { name, count, category: detectedCategory ?? guess, guess };
}

async function main() {
  console.log(`Prüfe ${CANDIDATES.length} Marken (${DELAY_MS/1000}s Pause je Call)...\n`);
  const results = [];

  for (const { name, guess } of CANDIDATES) {
    const r = await checkBrand(name, guess);
    if (r) results.push(r);
  }

  console.log('\n\n=== ERGEBNIS – Einträge für brands.ts ===\n');
  for (const { name, count, category, guess } of results) {
    if (count === 0) {
      console.log(`// '${name}': '${guess}',\t// OFF: 0 Treffer – manuell prüfen`);
    } else {
      console.log(`\t'${name}': '${category}',\t// ${count} Produkte in DACH`);
    }
  }
}

main().catch(console.error);
