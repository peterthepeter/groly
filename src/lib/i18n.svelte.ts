import * as m from '$lib/paraglide/messages';
import { setLanguageTag, type AvailableLanguageTag } from '$lib/paraglide/runtime';
import { browser } from '$app/environment';
import { userSettings, initUserSettings } from '$lib/userSettings.svelte';

let _lang = $state<AvailableLanguageTag>('de');

export function currentLang(): AvailableLanguageTag {
	return _lang;
}

export function setLang(lang: AvailableLanguageTag) {
	setLanguageTag(lang);
	_lang = lang;
	userSettings.lang = lang;
}

export async function initLanguage() {
	if (!browser) return;
	// Load from server (falls back to localStorage cache if offline)
	const serverSettings = await initUserSettings();
	const lang = userSettings.lang;
	setLanguageTag(lang);
	_lang = lang;
	// If no explicit language preference was saved, detect from browser
	if (!serverSettings?.lang) {
		const browserLang = navigator.language.slice(0, 2);
		setLang(browserLang === 'en' ? 'en' : 'de');
	}
}

// Reactive translation proxy — each getter reads _lang, creating a reactive dependency
// in any Svelte 5 reactive context (component render, $derived, $effect)
class TranslationProxy {
	// login
	get login_title() { void _lang; return m.login_title(); }
	get login_subtitle() { void _lang; return m.login_subtitle(); }
	get login_username() { void _lang; return m.login_username(); }
	get login_password() { void _lang; return m.login_password(); }
	get login_button() { void _lang; return m.login_button(); }
	get login_error() { void _lang; return m.login_error(); }
	// nav
	get nav_lists() { void _lang; return m.nav_lists(); }
	get nav_settings() { void _lang; return m.nav_settings(); }
	get nav_logout() { void _lang; return m.nav_logout(); }
	get nav_users() { void _lang; return m.nav_users(); }
	// lists
	get lists_title() { void _lang; return m.lists_title(); }
	get lists_empty() { void _lang; return m.lists_empty(); }
	get lists_add() { void _lang; return m.lists_add(); }
	// list
	get list_name_label() { void _lang; return m.list_name_label(); }
	get list_description_label() { void _lang; return m.list_description_label(); }
	get list_save() { void _lang; return m.list_save(); }
	get list_cancel() { void _lang; return m.list_cancel(); }
	get list_delete() { void _lang; return m.list_delete(); }
	get list_create_title() { void _lang; return m.list_create_title(); }
	get list_edit_title() { void _lang; return m.list_edit_title(); }
	get list_description_placeholder() { void _lang; return m.list_description_placeholder(); }
	// items
	get items_checked_label() { void _lang; return m.items_checked_label(); }
	get items_empty() { void _lang; return m.items_empty(); }
	get items_add() { void _lang; return m.items_add(); }
	// item
	get item_name_label() { void _lang; return m.item_name_label(); }
	get item_quantity_label() { void _lang; return m.item_quantity_label(); }
	get item_quantity_placeholder() { void _lang; return m.item_quantity_placeholder(); }
	get item_save() { void _lang; return m.item_save(); }
	get item_cancel() { void _lang; return m.item_cancel(); }
	get item_delete() { void _lang; return m.item_delete(); }
	get item_edit_title() { void _lang; return m.item_edit_title(); }
	// settings
	get settings_title() { void _lang; return m.settings_title(); }
	get settings_change_password() { void _lang; return m.settings_change_password(); }
	get settings_current_password() { void _lang; return m.settings_current_password(); }
	get settings_new_password() { void _lang; return m.settings_new_password(); }
	get settings_confirm_password() { void _lang; return m.settings_confirm_password(); }
	get settings_save_password() { void _lang; return m.settings_save_password(); }
	get settings_password_success() { void _lang; return m.settings_password_success(); }
	get settings_password_error() { void _lang; return m.settings_password_error(); }
	get settings_passwords_no_match() { void _lang; return m.settings_passwords_no_match(); }
	// admin
	get admin_users_title() { void _lang; return m.admin_users_title(); }
	get admin_add_user() { void _lang; return m.admin_add_user(); }
	get admin_username_label() { void _lang; return m.admin_username_label(); }
	get admin_password_label() { void _lang; return m.admin_password_label(); }
	get admin_role_label() { void _lang; return m.admin_role_label(); }
	get admin_role_user() { void _lang; return m.admin_role_user(); }
	get admin_role_admin() { void _lang; return m.admin_role_admin(); }
	get admin_user_created() { void _lang; return m.admin_user_created(); }
	get admin_edit_user() { void _lang; return m.admin_edit_user(); }
	get admin_delete_user() { void _lang; return m.admin_delete_user(); }
	get admin_new_password_label() { void _lang; return m.admin_new_password_label(); }
	get admin_password_changed() { void _lang; return m.admin_password_changed(); }
	get admin_confirm_delete_user() { void _lang; return m.admin_confirm_delete_user(); }
	get admin_cannot_delete_self() { void _lang; return m.admin_cannot_delete_self(); }
	get admin_cannot_delete_last_admin() { void _lang; return m.admin_cannot_delete_last_admin(); }
	get admin_cannot_delete_bootstrap() { void _lang; return m.admin_cannot_delete_bootstrap(); }
	// sync
	get sync_offline() { void _lang; return m.sync_offline(); }
	get sync_syncing() { void _lang; return m.sync_syncing(); }
	// misc
	get close() { void _lang; return m.close(); }
	get add() { void _lang; return m.add(); }
	get create() { void _lang; return m.create(); }
	get edit() { void _lang; return m.edit(); }
	get menu_open() { void _lang; return m.menu_open(); }
	get language() { void _lang; return m.language(); }
	get language_de() { void _lang; return m.language_de(); }
	get language_en() { void _lang; return m.language_en(); }
	get must_change_password() { void _lang; return m.must_change_password(); }
	get confirm_delete_list() { void _lang; return m.confirm_delete_list(); }
	get confirm_delete_item() { void _lang; return m.confirm_delete_item(); }
}

export const t = new TranslationProxy();

// Parametric helpers with inline plural logic (Paraglide doesn't support ICU plural syntax)
export function lists_active(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} active ${count === 1 ? 'list' : 'lists'}`;
	return `${count} aktive ${count === 1 ? 'Liste' : 'Listen'}`;
}
export function list_items_open(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} ${count === 1 ? 'item' : 'items'}`;
	return `${count} ${count === 1 ? 'Element' : 'Elemente'}`;
}
export function items_checked_count(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} completed ${count === 1 ? 'item' : 'items'}`;
	return `${count} erledigte ${count === 1 ? 'Element' : 'Elemente'}`;
}
export function sync_pending(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} pending sync`;
	return `${count} Sync offen`;
}
