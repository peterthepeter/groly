/**
 * Fetch top DACH brands from Open Food Facts – VERY CONSERVATIVE
 * Max ~8 API calls, 3 second delay between each.
 *
 * Strategy:
 *  1. Fetch brand facets for DE, AT, CH (3 calls)
 *  2. Merge & rank by product count
 *  3. For top unknown brands, fetch one sample product to guess category (max 5 calls)
 *
 * Usage: node scripts/fetch-off-brands.mjs
 */

import { readFileSync } from 'fs';

const DELAY_MS = 3000;
const MAX_CATEGORY_LOOKUPS = 5;

// Existing brands from brands.ts – extract all keys
const brandsFile = readFileSync('src/lib/brands.ts', 'utf-8');
const existingBrands = new Set(
  [...brandsFile.matchAll(/'([^']+)':\s*'[^']+'/g)].map(m => m[1].toLowerCase())
);
console.log(`Existing brands: ${existingBrands.size}`);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithDelay(url, label) {
  console.log(`\n→ Fetching: ${label}`);
  console.log(`  URL: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Groly-BrandResearch/1.0 (personal grocery app, contact via github)' }
  });
  if (!res.ok) {
    console.error(`  ERROR ${res.status}: ${res.statusText}`);
    return null;
  }
  const data = await res.json();
  console.log(`  OK – got response`);
  await sleep(DELAY_MS);
  return data;
}

// OFF category tag → our category key
const OFF_CATEGORY_MAP = {
  'en:beverages': 'getraenke',
  'en:drinks': 'getraenke',
  'en:waters': 'getraenke',
  'en:beers': 'getraenke',
  'en:coffees': 'getraenke',
  'en:teas': 'getraenke',
  'en:fruit-juices': 'getraenke',
  'en:sodas': 'getraenke',
  'en:energy-drinks': 'getraenke',
  'en:dairies': 'milch',
  'en:dairy': 'milch',
  'en:cheeses': 'milch',
  'en:milks': 'milch',
  'en:yogurts': 'milch',
  'en:butters': 'milch',
  'en:creams': 'milch',
  'en:plant-based-foods-and-beverages': 'milch',
  'en:chocolates': 'snacks',
  'en:candies': 'snacks',
  'en:snacks': 'snacks',
  'en:biscuits-and-cakes': 'snacks',
  'en:chips-and-crisps': 'snacks',
  'en:confectioneries': 'snacks',
  'en:gummies': 'snacks',
  'en:breads': 'backwaren',
  'en:cereals-and-potatoes': 'backwaren',
  'en:breakfast-cereals': 'backwaren',
  'en:pastas': 'nudeln',
  'en:rices': 'nudeln',
  'en:pasta': 'nudeln',
  'en:meats': 'fleisch',
  'en:poultries': 'fleisch',
  'en:seafood': 'fleisch',
  'en:fishes': 'fleisch',
  'en:sausages': 'fleisch',
  'en:canned-foods': 'konserven',
  'en:sauces': 'konserven',
  'en:condiments': 'konserven',
  'en:soups': 'konserven',
  'en:spices': 'gewuerze',
  'en:herbs': 'gewuerze',
  'en:frozen-foods': 'tiefkuehl',
  'en:ice-creams': 'tiefkuehl',
  'en:fruits': 'obst',
  'en:vegetables': 'obst',
  'en:fresh-produce': 'obst',
  'en:hygiene-and-beauty-products': 'haushalt',
  'en:beauty-products': 'haushalt',
  'en:cleaning-products': 'haushalt',
  'en:detergents': 'haushalt',
};

function guessCategory(categoriesTags) {
  if (!categoriesTags) return null;
  for (const tag of categoriesTags) {
    const cat = OFF_CATEGORY_MAP[tag];
    if (cat) return cat;
  }
  return null;
}

async function getBrandsForCountry(country, countryTag) {
  // OFF facets API (use .net which is responsive)
  const url = `https://world.openfoodfacts.net/facets/countries/${country}/brands.json?json=1`;
  const data = await fetchWithDelay(url, `Top brands in ${country}`);
  if (!data || !data.tags) return [];

  const brands = data.tags.map(t => ({
    name: t.name?.toLowerCase().trim(),
    count: t.products,
    id: t.id,
  })).filter(b => b.name && b.name.length > 1 && b.count > 10);

  console.log(`  Found ${brands.length} brands with >10 products`);
  return brands;
}

async function getCategoryForBrand(brandId) {
  // Fetch one product for this brand to determine category (.net domain)
  const url = `https://world.openfoodfacts.net/api/v2/search?brands_tags=${encodeURIComponent(brandId)}&fields=categories_tags&page_size=3&page=1`;
  const data = await fetchWithDelay(url, `Category lookup for ${brandId}`);
  if (!data || !data.products || data.products.length === 0) return null;

  // Collect all category tags from top 3 products
  const allTags = data.products.flatMap(p => p.categories_tags || []);
  // Count occurrences
  const counts = {};
  for (const tag of allTags) {
    counts[tag] = (counts[tag] || 0) + 1;
  }
  // Sort by count
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // Find first tag that maps to our categories
  for (const [tag] of sorted) {
    const cat = OFF_CATEGORY_MAP[tag];
    if (cat) return cat;
  }
  return null;
}

async function main() {
  const allBrands = new Map(); // name → {count, id}

  // Step 1: Fetch brand facets for DE, AT, CH (3 calls)
  const countries = [
    { name: 'germany', label: 'DE' },
    { name: 'austria', label: 'AT' },
    { name: 'switzerland', label: 'CH' },
  ];

  for (const { name, label } of countries) {
    const brands = await getBrandsForCountry(name, label);
    for (const b of brands) {
      if (!allBrands.has(b.name)) {
        allBrands.set(b.name, { count: b.count, id: b.id });
      } else {
        // Sum up counts across countries
        allBrands.get(b.name).count += b.count;
      }
    }
  }

  console.log(`\n=== Total unique brands found: ${allBrands.size} ===`);

  // Step 2: Find brands NOT in our existing list, ranked by product count
  const newBrands = [...allBrands.entries()]
    .filter(([name]) => !existingBrands.has(name))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50); // top 50 candidates

  console.log(`\n=== Top 50 NEW brands not in brands.ts ===`);
  newBrands.forEach(([name, {count}], i) => {
    console.log(`  ${i+1}. "${name}" (${count} products)`);
  });

  // Step 3: For top N unknown brands, look up category (max 5 calls)
  console.log(`\n=== Looking up categories for top ${MAX_CATEGORY_LOOKUPS} new brands ===`);
  const results = [];

  for (let i = 0; i < Math.min(MAX_CATEGORY_LOOKUPS, newBrands.length); i++) {
    const [name, {count, id}] = newBrands[i];
    const category = await getCategoryForBrand(id);
    results.push({ name, count, id, category });
    console.log(`  "${name}" → ${category || '(unknown)'}`);
  }

  // Output suggestions
  console.log('\n\n=== SUGGESTED ADDITIONS FOR brands.ts ===\n');
  console.log('// ── Neue Einträge aus Open Food Facts DACH-Daten ──────────────────────');
  for (const { name, count, category } of results) {
    if (category) {
      console.log(`\t'${name}': '${category}',\t// ${count} Produkte in DACH`);
    } else {
      console.log(`\t// '${name}': '???',\t// ${count} Produkte – Kategorie unklar`);
    }
  }

  // Also print top new brands without category lookup
  console.log('\n// ── Weitere häufige DACH-Brands (Kategorie bitte manuell prüfen) ─────');
  for (const [name, {count}] of newBrands.slice(MAX_CATEGORY_LOOKUPS, 30)) {
    console.log(`// \t'${name}': '???',\t// ${count} Produkte`);
  }
}

main().catch(console.error);
