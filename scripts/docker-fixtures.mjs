// These functions run inside the image under test, using that image's SQLite driver.
export async function seedUpgradeFixture() {
	const { default: Database } = await import('better-sqlite3');
	const { scryptSync } = await import('node:crypto');
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
		insert('push_subscriptions', { id: 'upgrade-push', user_id: 'upgrade-owner', endpoint: 'https://example.invalid/never-send', auth: 'fixture', p256dh: 'fixture', created_at: seconds });
	})();
	mkdirSync('/app/data/uploads', { recursive: true });
	writeFileSync('/app/data/uploads/upgrade-test.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWQAAAAASUVORK5CYII=', 'base64'));
	db.close();
	return { cookie: 'session=upgrade-existing-session', date };
}

export async function snapshotUpgradeData() {
	const { default: Database } = await import('better-sqlite3');
	const { createHash } = await import('node:crypto');
	const { existsSync, readdirSync, readFileSync } = await import('node:fs');
	const db = new Database('/app/data/groly.db', { readonly: true });
	/** @param {string | Uint8Array} value */
	const hash = value => createHash('sha256').update(value).digest('hex');
	/** @type {Record<string, { count: number; sha256: string; schema: string }>} */
	const tables = {};
	const inventory = /** @type {Array<{name: string; sql: string}>} */ (db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all());
	for (const { name, sql } of inventory) {
		const rows = /** @type {Array<Record<string, unknown>>} */ (db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all())
			.filter(row => name !== 'app_meta' || !['last_push_version', 'last_successful_start_version', 'upgrade_backup_in_progress'].includes(String(row.key)));
		tables[name] = { count: rows.length, sha256: hash(rows.map(row => JSON.stringify(row)).sort().join('\n')), schema: sql };
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
	walk('/app/data/uploads');
	const foreignKeys = /** @type {unknown[]} */ (db.pragma('foreign_key_check')).map(row => JSON.stringify(row)).sort();
	const integrity = db.pragma('integrity_check', { simple: true });
	db.close();
	return { tables, images, foreignKeys, integrity };
}
