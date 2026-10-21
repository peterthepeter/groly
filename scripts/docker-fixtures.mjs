// These functions run inside the image under test, using that image's SQLite driver.
export async function seedUpgradeFixture() {
	const { default: Database } = await import('better-sqlite3');
	const { scryptSync, createHash } = await import('node:crypto');
	const { mkdirSync, writeFileSync } = await import('node:fs');
	const db = new Database('/app/data/groly.db');
	db.pragma('foreign_keys = ON');
	const ms = Date.now(), seconds = Math.floor(ms / 1000);
	const date = new Date(ms).toISOString().slice(0, 10);
	/** @param {string} table @param {Record<string, string | number | null>} row */
	const insert = (table, row) => {
		const keys = Object.keys(row);
		db.prepare(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(key => row[key]));
	};
	const password = `fixture-salt:${scryptSync('Groly-upgrade-test-2026!', 'fixture-salt', 64).toString('hex')}`;
	db.transaction(() => {
		for (const [id, lang] of [['upgrade-owner', 'de'], ['upgrade-member', 'en']]) {
			insert('users', { id, username: id, password_hash: password, role: 'user', must_change_password: 0, settings: JSON.stringify({ lang, timeZone: 'Europe/Moscow', showSupplementTracker: true, waterTrackerEnabled: true, caffeineTrackerEnabled: true, meditationTrackerEnabled: true, moodTrackerEnabled: true, nutritionTrackerEnabled: true }), settings_revision: 7, created_at: seconds, updated_at: seconds });
		}
		insert('user_invites', { id: 'upgrade-legacy-invite', user_id: 'upgrade-member', token_hash: createHash('sha256').update('upgrade-legacy-token').digest('hex'), type: 'invite', created_at: seconds, expires_at: seconds + 86400 * 7 });
		insert('sessions', { id: 'upgrade-existing-session', user_id: 'upgrade-owner', expires_at: seconds + 86400 * 30, created_at: seconds });
		insert('lists', { id: 'upgrade-list', owner_id: 'upgrade-owner', name: 'Familie 🥦', description: 'Preserve Unicode and relations', created_at: seconds, updated_at: seconds });
		insert('list_members', { list_id: 'upgrade-list', user_id: 'upgrade-member', permission: 'write', status: 'accepted', notifications_enabled: 0 });
		insert('items', { id: 'upgrade-item', list_id: 'upgrade-list', name: 'Hafermilch', quantity_info: '2 × 1 l', category_override: 'dairy', created_by: 'upgrade-member', created_at: seconds, updated_at: seconds });
		insert('favorites', { user_id: 'upgrade-owner', name: 'Äpfel', quantity_info: '500 g', created_at: seconds });
		insert('category_preferences', { user_id: 'upgrade-owner', normalized_name: 'hafermilch', category_override: 'dairy', updated_at: ms });
		insert('item_history', { user_id: 'upgrade-owner', name: 'Hafermilch', use_count: 5, last_used_at: seconds });
		insert('recipes', { id: 'upgrade-recipe', user_id: 'upgrade-owner', title: 'Gemüsepfanne 🥦', image_url: '/uploads/upgrade-test.png', servings: 3, created_at: ms, updated_at: ms });
		insert('recipe_ingredients', { id: 'upgrade-ingredient', recipe_id: 'upgrade-recipe', amount: '1.5', unit: 'kg', name: 'Gemüse', sort_order: 0 });
		insert('recipe_steps', { id: 'upgrade-step', recipe_id: 'upgrade-recipe', step_number: 1, text: 'Gemüse anbraten.' });
		insert('recipe_tags', { recipe_id: 'upgrade-recipe', tag: 'Familie' });
		insert('recipe_shares', { id: 'upgrade-share', sender_id: 'upgrade-owner', receiver_id: 'upgrade-member', recipe_id: 'upgrade-recipe', status: 'pending', created_at: ms });
		insert('meal_plan_entries', { id: 'upgrade-plan', user_id: 'upgrade-owner', date, recipe_id: 'upgrade-recipe', servings: 2, note: 'Keep stored calendar dates unchanged', created_at: ms, updated_at: ms });
		insert('supplements', { id: 'upgrade-supplement', user_id: 'upgrade-owner', name: 'Magnesium', unit: 'capsules', stock_quantity: 42, default_amount: 2, created_at: ms, updated_at: ms });
		insert('supplement_logs', { id: 'upgrade-supplement-log', user_id: 'upgrade-owner', supplement_id: 'upgrade-supplement', amount: 2, logged_at: ms, created_at: ms, note: 'Abends ✓', client_log_id: 'upgrade-supplement-client', stock_deducted: 2 });
		insert('supplement_reminder_schedules', { id: 'upgrade-schedule', supplement_id: 'upgrade-supplement', days: '[1,3,5]', time: '20:00', active: 0, created_at: ms });
		insert('water_logs', { id: 'upgrade-water-log', user_id: 'upgrade-owner', amount_ml: 250, logged_at: ms, client_log_id: 'upgrade-water-client', created_at: ms });
		insert('caffeine_logs', { id: 'upgrade-caffeine-log', user_id: 'upgrade-owner', drink_name: 'Kaffee', amount_ml: 125, caffeine_mg: 80, logged_at: ms, client_log_id: 'upgrade-caffeine-client', created_at: ms });
		insert('meditation_logs', { id: 'upgrade-meditation-log', user_id: 'upgrade-owner', duration_seconds: 420, logged_at: ms, client_log_id: 'upgrade-meditation-client', created_at: ms });
		insert('mood_logs', { id: 'upgrade-mood-log', user_id: 'upgrade-owner', date, mood: 4, energy: 3, activities: '["exercise"]', note: 'Behalten', gratitude: 'Familie', created_at: ms, updated_at: ms });
		insert('list_notification_prefs', { list_id: 'upgrade-list', user_id: 'upgrade-member', enabled: 0 });
		insert('recipe_ingredient_exclusions', { user_id: 'upgrade-owner', ingredient_id: 'upgrade-ingredient' });
		insert('supplement_nutrients', { id: 'upgrade-nutrient', supplement_id: 'upgrade-supplement', name: 'Magnesium', amount_per_unit: 200, unit: 'mg' });
		insert('supplement_reminder_overrides', { id: 'upgrade-override', user_id: 'upgrade-owner', date, reminder_time: '20:00', done: 1, created_at: ms });
		insert('supplement_catalog', { id: 'upgrade-catalog', name: 'Magnesium', unit: 'capsules', created_by: 'upgrade-owner', created_at: ms, updated_at: ms });
		insert('supplement_catalog_nutrients', { id: 'upgrade-catalog-nutrient', catalog_id: 'upgrade-catalog', name: 'Magnesium', amount_per_unit: 200, unit: 'mg' });
		insert('water_reminder_schedules', { id: 'upgrade-water-reminder', user_id: 'upgrade-owner', days: '[1,3,5]', start_time: '08:00', end_time: '18:00', active: 0, created_at: ms });
		insert('meditation_reminder_schedules', { id: 'upgrade-meditation-reminder', user_id: 'upgrade-owner', time: '07:30', active: 0, created_at: ms });
		insert('mood_reminder_schedules', { id: 'upgrade-mood-reminder', user_id: 'upgrade-owner', days: '[0,1,2,3,4,5,6]', time: '18:00', active: 0, created_at: ms });
		insert('mood_custom_tags', { id: 'upgrade-mood-tag', user_id: 'upgrade-owner', key: 'upgrade-walk', label: 'Spaziergang', category: 'activity', created_at: ms });
		insert('barcode_cache', { barcode: 'upgrade-food', name: 'Haferflocken', kcal_per_100: 370, protein_per_100: 13, last_seen_at: ms });
		insert('meals', { id: 'upgrade-meal', user_id: 'upgrade-owner', name: 'Frühstück', date, time: '08:15', image_url: '/uploads/upgrade-test.png', created_at: ms, updated_at: ms });
		insert('meal_components', { id: 'upgrade-meal-component', meal_id: 'upgrade-meal', product_barcode: 'upgrade-food', display_name: 'Haferflocken', amount: 75, unit: 'g', kcal_per_100: 370, protein_per_100: 13, kcal: 277.5, protein: 9.75 });
		insert('nutrition_favorites', { id: 'upgrade-food-favorite', user_id: 'upgrade-owner', product_barcode: 'upgrade-food', display_name: 'Haferflocken', default_amount: 75, use_count: 4, last_used_at: ms, created_at: ms });
		insert('nutrition_meal_favorites', { id: 'upgrade-meal-favorite', user_id: 'upgrade-owner', display_name: 'Mein Frühstück', image_url: '/uploads/upgrade-test.png', use_count: 3, created_at: ms });
		insert('nutrition_meal_favorite_components', { id: 'upgrade-favorite-component', meal_favorite_id: 'upgrade-meal-favorite', product_barcode: 'upgrade-food', display_name: 'Haferflocken', amount: 75, unit: 'g', kcal_per_100: 370, protein_per_100: 13 });
		insert('recipe_nutrition_components', { id: 'upgrade-recipe-nutrition', recipe_id: 'upgrade-recipe', ingredient_id: 'upgrade-ingredient', custom_name: 'Gemüse', display_name: 'Gemüse', amount: 1500, unit: 'g', kcal_per_100: 35, protein_per_100: 2 });
		insert('nutrition_goals', { user_id: 'upgrade-owner', daily_kcal: 2200, daily_protein: 120, daily_fat: 70, daily_carbs: 275, daily_fiber: 30, updated_at: ms });
		insert('push_subscriptions', { id: 'upgrade-push', user_id: 'upgrade-owner', endpoint: 'https://example.invalid/never-send', auth: 'fixture', p256dh: 'fixture', created_at: seconds });
	})();
	mkdirSync('/app/data/uploads', { recursive: true });
	writeFileSync('/app/data/uploads/upgrade-test.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWQAAAAASUVORK5CYII=', 'base64'));
	db.close();
	return { cookie: 'session=upgrade-existing-session', date };
}

/** @param {Record<string, string[]>} originalColumns */
export async function snapshotUpgradeData(originalColumns = {}, databasePath = '/app/data/groly.db', uploadDirectory = '/app/data/uploads') {
	const { default: Database } = await import('better-sqlite3');
	const { createHash } = await import('node:crypto');
	const { existsSync, readdirSync, readFileSync } = await import('node:fs');
	const db = new Database(databasePath, { readonly: true });
	/** @param {string | Uint8Array} value */
	const hash = value => createHash('sha256').update(value).digest('hex');
	/** @typedef {{cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number}} Column */
	/** @type {Record<string, {count: number; sha256: string; schema: string; columns: Column[]; originalColumnsSha256?: string; addedColumnsAreNull?: boolean}>} */
	const tables = {};
	const inventory = /** @type {Array<{name: string; sql: string}>} */ (db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all());
	for (const { name, sql } of inventory) {
		const rows = /** @type {Array<Record<string, unknown>>} */ (db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all())
			.filter(row => name !== 'app_meta' || !['last_push_version', 'last_successful_start_version', 'upgrade_backup_in_progress'].includes(String(row.key)));
		const columns = /** @type {Column[]} */ (db.prepare(`PRAGMA table_info("${name.replaceAll('"', '""')}")`).all());
		tables[name] = { count: rows.length, sha256: hash(rows.map(row => JSON.stringify(row)).sort().join('\n')), schema: sql, columns };
		if (originalColumns[name]) {
			const keys = originalColumns[name];
			tables[name].originalColumnsSha256 = hash(rows.map(row => JSON.stringify(Object.fromEntries(keys.map(key => [key, row[key]])))).sort().join('\n'));
			tables[name].addedColumnsAreNull = columns.filter(column => !keys.includes(column.name)).every(column => rows.every(row => row[column.name] === null));
		}
	}
	/** @type {Record<string, string>} */
	const images = {};
	/** @param {string} directory @param {string} [prefix] */
	function walk(directory, prefix = '') {
		if (!existsSync(directory)) return;
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) walk(`${directory}/${entry.name}`, `${prefix}${entry.name}/`);
			else images[prefix + entry.name] = hash(readFileSync(`${directory}/${entry.name}`));
		}
	}
	walk(uploadDirectory);
	const foreignKeys = /** @type {unknown[]} */ (db.pragma('foreign_key_check')).map(row => JSON.stringify(row)).sort();
	const integrity = db.pragma('integrity_check', { simple: true });
	const migrations = db.prepare('SELECT * FROM __drizzle_migrations ORDER BY id').all();
	db.close();
	return { tables, images, foreignKeys, integrity, migrations };
}
