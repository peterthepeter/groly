#!/usr/bin/env node
// Seeds 30 days of realistic dummy data for the admin user.
// Run: node scripts/seed-dev-data.mjs

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.DATABASE_URL ?? './data/groly.db';
const USERNAME = process.argv[2] ?? 'admin';

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const user = db.prepare('SELECT id FROM users WHERE username = ?').get(USERNAME);
if (!user) { console.error(`User '${USERNAME}' not found`); process.exit(1); }
const userId = user.id;

const supps = db.prepare('SELECT id, name FROM supplements WHERE user_id = ?').all(userId);
if (supps.length === 0) { console.error('User has no supplements'); process.exit(1); }
console.log(`User '${USERNAME}' has ${supps.length} supplements:`, supps.map(s => s.name).join(', '));

const findSupp = (name) => supps.find(s => s.name.toLowerCase().includes(name.toLowerCase()));

// Plan per supplement (key: substring match against supp.name, value: pattern)
// pattern: 'daily' | 'weekend' | 'occasional' | {fromDayBack, toDayBack}
const plan = [
	{ match: 'All Night', pattern: 'daily', missChance: 0.1, amount: 2 },        // daily, ~10% miss
	{ match: 'Mulit', pattern: 'daily', missChance: 0.05, amount: 1 },           // daily, ~5% miss
	{ match: 'Gut Pro', pattern: { fromDayBack: 23, toDayBack: 16 }, amount: 1 },// only days 23-16 back (a ~7-day window)
	{ match: 'NAC', pattern: 'weekend', missChance: 0.1, amount: 1 }             // Sat/Sun only
];

const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0); // noon to avoid TZ surprises
function daysAgo(n) {
	const d = new Date(TODAY);
	d.setDate(d.getDate() - n);
	return d;
}
function isoDate(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ts(d, h, m = 0) {
	const x = new Date(d);
	x.setHours(h, m, Math.floor(Math.random() * 60), 0);
	return x.getTime();
}

const now = Date.now();
const stats = { supplements: 0, caffeine: 0, meditation: 0, water: 0, mood: 0 };

// ---- Supplements ----
const insSuppLog = db.prepare(
	'INSERT OR IGNORE INTO supplement_logs (id, user_id, supplement_id, amount, logged_at, created_at, client_log_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
for (let dayBack = 29; dayBack >= 0; dayBack--) {
	const d = daysAgo(dayBack);
	const weekday = d.getDay(); // 0=Sun, 6=Sat
	const isWeekend = weekday === 0 || weekday === 6;
	for (const item of plan) {
		const supp = findSupp(item.match);
		if (!supp) continue;
		let shouldTake = false;
		if (item.pattern === 'daily') shouldTake = Math.random() > item.missChance;
		else if (item.pattern === 'weekend') shouldTake = isWeekend && Math.random() > item.missChance;
		else if (typeof item.pattern === 'object') {
			shouldTake = dayBack <= item.pattern.fromDayBack && dayBack >= item.pattern.toDayBack;
		}
		if (!shouldTake) continue;
		const hour = 7 + Math.floor(Math.random() * 3); // 7-9 morning
		insSuppLog.run(randomUUID(), userId, supp.id, item.amount, ts(d, hour), now, randomUUID());
		stats.supplements++;
	}
}

// ---- Caffeine ----
const insCaff = db.prepare(
	'INSERT OR IGNORE INTO caffeine_logs (id, user_id, drink_name, amount_ml, caffeine_mg, logged_at, created_at, client_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const drinks = [
	{ name: 'Espresso', ml: 30, mg: 63 },
	{ name: 'Cappuccino', ml: 180, mg: 75 },
	{ name: 'Filter coffee', ml: 250, mg: 95 },
	{ name: 'Black tea', ml: 250, mg: 45 },
	{ name: 'Green tea', ml: 250, mg: 30 }
];
for (let dayBack = 29; dayBack >= 0; dayBack--) {
	const d = daysAgo(dayBack);
	const isWeekend = d.getDay() === 0 || d.getDay() === 6;
	const skipChance = isWeekend ? 0.25 : 0.05;
	if (Math.random() < skipChance) continue;
	// 1-3 drinks per day
	const count = 1 + Math.floor(Math.random() * 3);
	const hours = [7, 10, 14, 16].sort(() => Math.random() - 0.5).slice(0, count);
	for (const h of hours) {
		const drink = drinks[Math.floor(Math.random() * drinks.length)];
		insCaff.run(randomUUID(), userId, drink.name, drink.ml, drink.mg, ts(d, h), now, randomUUID());
		stats.caffeine++;
	}
}

// ---- Meditation: 3-4 sessions/week ----
const insMed = db.prepare(
	'INSERT OR IGNORE INTO meditation_logs (id, user_id, duration_seconds, logged_at, created_at, client_log_id) VALUES (?, ?, ?, ?, ?, ?)'
);
for (let dayBack = 29; dayBack >= 0; dayBack--) {
	const d = daysAgo(dayBack);
	// ~50% probability per day → ~3-4 per week
	if (Math.random() > 0.5) continue;
	const duration = [5, 10, 10, 15, 15, 20][Math.floor(Math.random() * 6)] * 60;
	insMed.run(randomUUID(), userId, duration, ts(d, 7 + Math.floor(Math.random() * 14)), now, randomUUID());
	stats.meditation++;
}

// ---- Water: 4-8 logs per day, ~10% off days ----
const insWater = db.prepare(
	'INSERT OR IGNORE INTO water_logs (id, user_id, amount_ml, logged_at, created_at, client_log_id) VALUES (?, ?, ?, ?, ?, ?)'
);
for (let dayBack = 29; dayBack >= 0; dayBack--) {
	const d = daysAgo(dayBack);
	if (Math.random() < 0.1) continue;
	const count = 4 + Math.floor(Math.random() * 5);
	for (let i = 0; i < count; i++) {
		const amount = [200, 250, 300, 500][Math.floor(Math.random() * 4)];
		insWater.run(randomUUID(), userId, amount, ts(d, 7 + i * 2), now, randomUUID());
		stats.water++;
	}
}

// ---- Mood: most days, with activities + occasional notes ----
const insMood = db.prepare(
	`INSERT OR IGNORE INTO mood_logs (id, user_id, date, mood, activities, note, created_at, updated_at)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const tagPool = ['happy', 'relaxed', 'tired', 'stressed', 'work', 'family', 'sport', 'reading', 'meditation', 'walk', 'friends', 'cooking', 'gaming', 'music', 'rainy', 'sunny'];
const notes = [
	null, null, null, null, // weighted: often no note
	'Guter Tag insgesamt',
	'Wenig geschlafen',
	'Spaziergang am Nachmittag',
	'Treffen mit Freunden',
	'Konzentriert gearbeitet',
	'Müde aber zufrieden'
];
for (let dayBack = 29; dayBack >= 0; dayBack--) {
	const d = daysAgo(dayBack);
	const date = isoDate(d);
	if (Math.random() < 0.15) continue; // ~15% miss
	// Mood with slight upward trend over the month + random noise
	const trendBoost = (29 - dayBack) / 29 * 0.5;
	const base = 3 + trendBoost;
	const noise = (Math.random() - 0.5) * 2.5;
	const mood = Math.max(1, Math.min(5, Math.round(base + noise)));
	// 2-4 tags
	const numTags = 2 + Math.floor(Math.random() * 3);
	const shuffled = [...tagPool].sort(() => Math.random() - 0.5);
	const tags = shuffled.slice(0, numTags);
	const note = notes[Math.floor(Math.random() * notes.length)];
	insMood.run(randomUUID(), userId, date, mood, JSON.stringify(tags), note, now, now);
	stats.mood++;
}

console.log('\nSeeded:');
console.log(`  ${stats.supplements} supplement log(s)`);
console.log(`  ${stats.caffeine} caffeine log(s)`);
console.log(`  ${stats.meditation} meditation session(s)`);
console.log(`  ${stats.water} water log(s)`);
console.log(`  ${stats.mood} mood entr(ies)`);
console.log('\nDone.');
db.close();
