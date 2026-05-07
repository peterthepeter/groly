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
	// checked items
	get settings_show_all_checked_section() { void _lang; return m.settings_show_all_checked_section(); }
	get settings_show_all_checked_desc() { void _lang; return m.settings_show_all_checked_desc(); }
	// layout
	get settings_layout_section() { void _lang; return m.settings_layout_section(); }
	get settings_layout_list_view() { void _lang; return m.settings_layout_list_view(); }
	get settings_layout_list_view_desc() { void _lang; return m.settings_layout_list_view_desc(); }
	get listview_hint_text() { void _lang; return m.listview_hint_text(); }
	get listview_hint_action() { void _lang; return m.listview_hint_action(); }
	get location_hint_text() { void _lang; return m.location_hint_text(); }
	get location_hint_action() { void _lang; return m.location_hint_action(); }
	get sort_mode_title() { void _lang; return m.sort_mode_title(); }
	get sort_mode_subtitle() { void _lang; return m.sort_mode_subtitle(); }
	get sort_mode_done() { void _lang; return m.sort_mode_done(); }
	get items_add() { void _lang; return m.items_add(); }
	// item
	get item_name_label() { void _lang; return m.item_name_label(); }
	get item_name_placeholder() { void _lang; return m.item_name_placeholder(); }
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
	get admin_make_admin() { void _lang; return m.admin_make_admin(); }
	get admin_make_user() { void _lang; return m.admin_make_user(); }
	get admin_role_changed() { void _lang; return m.admin_role_changed(); }
	get admin_confirm_delete_user() { void _lang; return m.admin_confirm_delete_user(); }
	get admin_cannot_delete_self() { void _lang; return m.admin_cannot_delete_self(); }
	get admin_cannot_delete_last_admin() { void _lang; return m.admin_cannot_delete_last_admin(); }
	get admin_cannot_delete_bootstrap() { void _lang; return m.admin_cannot_delete_bootstrap(); }
	get admin_copy_credentials() { void _lang; return m.admin_copy_credentials(); }
	get admin_share_msg1() { void _lang; return m.admin_share_msg1(); }
	get admin_share_msg2() { void _lang; return m.admin_share_msg2(); }
	get admin_must_change_hint() { void _lang; return m.admin_must_change_hint(); }
	get admin_copied() { void _lang; return m.admin_copied(); }
	get admin_create_another() { void _lang; return m.admin_create_another(); }
	get admin_page_title() { void _lang; return m.admin_page_title(); }
	get admin_section_users() { void _lang; return m.admin_section_users(); }
	get admin_section_supplements() { void _lang; return m.admin_section_supplements(); }
	get admin_catalog_add() { void _lang; return m.admin_catalog_add(); }
	get admin_catalog_edit_title() { void _lang; return m.admin_catalog_edit_title(); }
	get admin_catalog_new_title() { void _lang; return m.admin_catalog_new_title(); }
	get admin_catalog_delete() { void _lang; return m.admin_catalog_delete(); }
	get admin_catalog_confirm_delete() { void _lang; return m.admin_catalog_confirm_delete(); }
	get admin_catalog_empty() { void _lang; return m.admin_catalog_empty(); }
	get admin_catalog_search_placeholder() { void _lang; return m.admin_catalog_search_placeholder(); }
	get admin_catalog_no_results() { void _lang; return m.admin_catalog_no_results(); }
	get admin_catalog_nutrients_label() { void _lang; return m.admin_catalog_nutrients_label(); }
	get admin_catalog_nutrients_placeholder() { void _lang; return m.admin_catalog_nutrients_placeholder(); }
	get admin_catalog_duplicate_warning() { void _lang; return m.admin_catalog_duplicate_warning(); }
	get admin_catalog_package_size_label() { void _lang; return m.admin_catalog_package_size_label(); }
	get admin_catalog_package_size_placeholder() { void _lang; return m.admin_catalog_package_size_placeholder(); }
	get admin_catalog_saved() { void _lang; return m.admin_catalog_saved(); }
	get admin_catalog_nutrient_count() { void _lang; return m.admin_catalog_nutrient_count(); }
	get admin_nav_label() { void _lang; return m.admin_nav_label(); }
	get supplement_catalog_search_placeholder() { void _lang; return m.supplement_catalog_search_placeholder(); }
	get supplement_catalog_from_catalog() { void _lang; return m.supplement_catalog_from_catalog(); }
	get supplement_catalog_no_results() { void _lang; return m.supplement_catalog_no_results(); }
	get supplement_catalog_applied() { void _lang; return m.supplement_catalog_applied(); }
	get supplement_enter_manually() { void _lang; return m.supplement_enter_manually(); }
	get admin_catalog_header_label() { void _lang; return m.admin_catalog_header_label(); }
	get admin_catalog_brands_label() { void _lang; return m.admin_catalog_brands_label(); }
	get admin_catalog_text_hint() { void _lang; return m.admin_catalog_text_hint(); }
	get admin_catalog_text_placeholder() { void _lang; return m.admin_catalog_text_placeholder(); }
	get admin_catalog_parse_placeholder() { void _lang; return m.admin_catalog_parse_placeholder(); }
	get admin_catalog_parse_button() { void _lang; return m.admin_catalog_parse_button(); }
	get admin_catalog_parse_error() { void _lang; return m.admin_catalog_parse_error(); }
	get admin_catalog_preview_button() { void _lang; return m.admin_catalog_preview_button(); }
	get admin_catalog_import_all() { void _lang; return m.admin_catalog_import_all(); }
	get admin_catalog_back() { void _lang; return m.admin_catalog_back(); }
	get admin_catalog_sample_single() { void _lang; return m.admin_catalog_sample_single(); }
	get admin_catalog_sample_multi() { void _lang; return m.admin_catalog_sample_multi(); }
	get supplement_sort_label() { void _lang; return m.supplement_sort_label(); }
	get supplement_sort_az() { void _lang; return m.supplement_sort_az(); }
	get supplement_sort_za() { void _lang; return m.supplement_sort_za(); }
	get supplement_sort_freq() { void _lang; return m.supplement_sort_freq(); }
	get push_prompt_title() { void _lang; return m.push_prompt_title(); }
	get push_prompt_body() { void _lang; return m.push_prompt_body(); }
	get push_prompt_accept() { void _lang; return m.push_prompt_accept(); }
	get push_prompt_decline() { void _lang; return m.push_prompt_decline(); }
	get install_banner_text() { void _lang; return m.install_banner_text(); }
	get pwa_install_subtitle() { void _lang; return m.pwa_install_subtitle(); }
	// sync
	get sync_offline() { void _lang; return m.sync_offline(); }
	get sync_server_offline() { void _lang; return m.sync_server_offline(); }
	get offline_no_data() { void _lang; return m.offline_no_data(); }
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
	get theme() { void _lang; return m.theme(); }
	get theme_system() { void _lang; return m.theme_system(); }
	get theme_light() { void _lang; return m.theme_light(); }
	get theme_dark() { void _lang; return m.theme_dark(); }
	get must_change_password() { void _lang; return m.must_change_password(); }
	get confirm_delete_list() { void _lang; return m.confirm_delete_list(); }
	get confirm_delete_item() { void _lang; return m.confirm_delete_item(); }
	// recipes
	get nav_recipes() { void _lang; return m.nav_recipes(); }
	get recipes_title() { void _lang; return m.recipes_title(); }
	get recipes_empty() { void _lang; return m.recipes_empty(); }
	get recipes_empty_hint() { void _lang; return m.recipes_empty_hint(); }
	get recipes_search_placeholder() { void _lang; return m.recipes_search_placeholder(); }
	get recipes_no_results() { void _lang; return m.recipes_no_results(); }
	get recipe_add() { void _lang; return m.recipe_add(); }
	get recipe_import_url() { void _lang; return m.recipe_import_url(); }
	get recipe_import_url_hint() { void _lang; return m.recipe_import_url_hint(); }
	get recipe_create_manual() { void _lang; return m.recipe_create_manual(); }
	get recipe_create_manual_hint() { void _lang; return m.recipe_create_manual_hint(); }
	get recipe_import_title() { void _lang; return m.recipe_import_title(); }
	get recipe_import_subtitle() { void _lang; return m.recipe_import_subtitle(); }
	get recipe_import_button() { void _lang; return m.recipe_import_button(); }
	get recipe_import_loading() { void _lang; return m.recipe_import_loading(); }
	get recipe_import_paste() { void _lang; return m.recipe_import_paste(); }
	get recipe_import_supported() { void _lang; return m.recipe_import_supported(); }
	get recipe_import_no_recipe() { void _lang; return m.recipe_import_no_recipe(); }
	get recipe_import_page_load_failed() { void _lang; return m.recipe_import_page_load_failed(); }
	get recipe_import_failed() { void _lang; return m.recipe_import_failed(); }
	get recipe_import_connection_error() { void _lang; return m.recipe_import_connection_error(); }
	get recipe_import_save_failed() { void _lang; return m.recipe_import_save_failed(); }
	get recipe_import_save_network_error() { void _lang; return m.recipe_import_save_network_error(); }
	get recipe_save() { void _lang; return m.recipe_save(); }
	get recipe_save_changes() { void _lang; return m.recipe_save_changes(); }
	get recipe_saving() { void _lang; return m.recipe_saving(); }
	get recipe_new_title() { void _lang; return m.recipe_new_title(); }
	get recipe_edit_title() { void _lang; return m.recipe_edit_title(); }
	get recipe_name_placeholder() { void _lang; return m.recipe_name_placeholder(); }
	get recipe_description_placeholder() { void _lang; return m.recipe_description_placeholder(); }
	get recipe_ingredients() { void _lang; return m.recipe_ingredients(); }
	get recipe_instructions() { void _lang; return m.recipe_instructions(); }
	get recipe_add_ingredient() { void _lang; return m.recipe_add_ingredient(); }
	get recipe_add_step() { void _lang; return m.recipe_add_step(); }
	get recipe_delete() { void _lang; return m.recipe_delete(); }
	get recipe_confirm_delete() { void _lang; return m.recipe_confirm_delete(); }
	get recipe_original_link() { void _lang; return m.recipe_original_link(); }
	get recipe_prep_time() { void _lang; return m.recipe_prep_time(); }
	get recipe_cook_time() { void _lang; return m.recipe_cook_time(); }
	get recipe_add_to_list() { void _lang; return m.recipe_add_to_list(); }
	get recipe_share_title() { void _lang; return m.recipe_share_title(); }
	get recipe_share_sent() { void _lang; return m.recipe_share_sent(); }
	get recipe_share_send() { void _lang; return m.recipe_share_send(); }
	get recipe_to_list_title() { void _lang; return m.recipe_to_list_title(); }
	get recipe_new_list() { void _lang; return m.recipe_new_list(); }
	get recipe_list_search() { void _lang; return m.recipe_list_search(); }
	get recipe_shares_from() { void _lang; return m.recipe_shares_from(); }
	get recipe_accept() { void _lang; return m.recipe_accept(); }
	get recipe_decline() { void _lang; return m.recipe_decline(); }
	get recipe_no_ingredients() { void _lang; return m.recipe_no_ingredients(); }
	get recipe_not_needed() { void _lang; return m.recipe_not_needed(); }
	get recipe_no_steps() { void _lang; return m.recipe_no_steps(); }
	get recipe_minutes() { void _lang; return m.recipe_minutes(); }
	get recipe_prep_min_placeholder() { void _lang; return m.recipe_prep_min_placeholder(); }
	get recipe_cook_min_placeholder() { void _lang; return m.recipe_cook_min_placeholder(); }
	get recipe_step_placeholder() { void _lang; return m.recipe_step_placeholder(); }
	get recipe_amount_placeholder() { void _lang; return m.recipe_amount_placeholder(); }
	get recipe_unit_placeholder() { void _lang; return m.recipe_unit_placeholder(); }
	get recipe_ingredient_placeholder() { void _lang; return m.recipe_ingredient_placeholder(); }
	get recipe_username_placeholder() { void _lang; return m.recipe_username_placeholder(); }
	get recipe_share_error_self() { void _lang; return m.recipe_share_error_self(); }
	get pwa_update_available() { void _lang; return m.pwa_update_available(); }
	get pwa_update_title() { void _lang; return m.pwa_update_title(); }
	get pwa_update_body() { void _lang; return m.pwa_update_body(); }
	get pwa_update_reload() { void _lang; return m.pwa_update_reload(); }
	get pwa_update_later() { void _lang; return m.pwa_update_later(); }
	// barcode
	get barcode_scan() { void _lang; return m.barcode_scan(); }
	get barcode_not_found() { void _lang; return m.barcode_not_found(); }
	get barcode_camera_denied() { void _lang; return m.barcode_camera_denied(); }
	get barcode_added() { void _lang; return m.barcode_added(); }
	get barcode_unsupported() { void _lang; return m.barcode_unsupported(); }
	get barcode_offline() { void _lang; return m.barcode_offline(); }
	// favorites
	get favorites_panel_toggle() { void _lang; return m.favorites_panel_toggle(); }
	get favorites_add()           { void _lang; return m.favorites_add(); }
	get favorites_remove()        { void _lang; return m.favorites_remove(); }
	get favorites_empty()         { void _lang; return m.favorites_empty(); }
	get favorites_indicator()     { void _lang; return m.favorites_indicator(); }
	get favorites_new()           { void _lang; return m.favorites_new(); }
	get settings_favorite_indicator()      { void _lang; return m.settings_favorite_indicator(); }
	get settings_favorite_indicator_desc() { void _lang; return m.settings_favorite_indicator_desc(); }
	// supplements
	get nav_supplements() { void _lang; return m.nav_supplements(); }
	get supplement_title() { void _lang; return m.supplement_title(); }
	get supplement_tab_today() { void _lang; return m.supplement_tab_today(); }
	get supplement_tab_history() { void _lang; return m.supplement_tab_history(); }
	get supplement_add() { void _lang; return m.supplement_add(); }
	get supplement_name_label() { void _lang; return m.supplement_name_label(); }
	get supplement_name_placeholder() { void _lang; return m.supplement_name_placeholder(); }
	get supplement_unit_label() { void _lang; return m.supplement_unit_label(); }
	get supplement_unit_placeholder() { void _lang; return m.supplement_unit_placeholder(); }
	get supplement_unit_pick_title() { void _lang; return m.supplement_unit_pick_title(); }
	get supplement_unit_manual() { void _lang; return m.supplement_unit_manual(); }
	get supplement_brand_label() { void _lang; return m.supplement_brand_label(); }
	get supplement_brand_placeholder() { void _lang; return m.supplement_brand_placeholder(); }
	get supplement_info_label() { void _lang; return m.supplement_info_label(); }
	get supplement_info_placeholder() { void _lang; return m.supplement_info_placeholder(); }
	get supplement_add_to_list() { void _lang; return m.supplement_add_to_list(); }
	get supplement_notes_label() { void _lang; return m.supplement_notes_label(); }
	get supplement_active_label() { void _lang; return m.supplement_active_label(); }
	get supplement_active_desc() { void _lang; return m.supplement_active_desc(); }
	get supplement_nutrients_label() { void _lang; return m.supplement_nutrients_label(); }
	get supplement_nutrient_name() { void _lang; return m.supplement_nutrient_name(); }
	get supplement_nutrients_plural() { void _lang; return m.supplement_nutrients_plural(); }
	get supplement_nutrient_name_placeholder() { void _lang; return m.supplement_nutrient_name_placeholder(); }
	get supplement_nutrient_amount() { void _lang; return m.supplement_nutrient_amount(); }
	get supplement_nutrient_unit() { void _lang; return m.supplement_nutrient_unit(); }
	get supplement_nutrient_unit_placeholder() { void _lang; return m.supplement_nutrient_unit_placeholder(); }
	get supplement_nutrient_add() { void _lang; return m.supplement_nutrient_add(); }
	get supplement_nutrient_remove() { void _lang; return m.supplement_nutrient_remove(); }
	get supplement_log_amount() { void _lang; return m.supplement_log_amount(); }
	get supplement_log_time() { void _lang; return m.supplement_log_time(); }
	get supplement_log_save() { void _lang; return m.supplement_log_save(); }
	get supplement_log_delete() { void _lang; return m.supplement_log_delete(); }
	get supplement_log_note_placeholder() { void _lang; return m.supplement_log_note_placeholder(); }
	get supplement_export_title() { void _lang; return m.supplement_export_title(); }
	get supplement_data_title() { void _lang; return m.supplement_data_title(); }
	get supplement_export_desc() { void _lang; return m.supplement_export_desc(); }
	get supplement_export_btn() { void _lang; return m.supplement_export_btn(); }
	get supplement_export_logs() { void _lang; return m.supplement_export_logs(); }
	get supplement_export_catalog() { void _lang; return m.supplement_export_catalog(); }
	get supplement_import_title() { void _lang; return m.supplement_import_title(); }
	get supplement_import_desc() { void _lang; return m.supplement_import_desc(); }
	get supplement_import_btn() { void _lang; return m.supplement_import_btn(); }
	get supplement_import_skipped() { void _lang; return m.supplement_import_skipped(); }
	get supplement_import_error() { void _lang; return m.supplement_import_error(); }
	get supplement_manage() { void _lang; return m.supplement_manage(); }
	get supplement_empty() { void _lang; return m.supplement_empty(); }
	get supplement_empty_hint() { void _lang; return m.supplement_empty_hint(); }
	get supplement_empty_hint_add() { void _lang; return m.supplement_empty_hint_add(); }
	get supplement_empty_tracker_hint() { void _lang; return m.supplement_empty_tracker_hint(); }
	get supplement_today_empty() { void _lang; return m.supplement_today_empty(); }
	get supplement_today_none_active() { void _lang; return m.supplement_today_none_active(); }
	get supplement_stats_day() { void _lang; return m.supplement_stats_day(); }
	get supplement_stats_week() { void _lang; return m.supplement_stats_week(); }
	get supplement_stats_month() { void _lang; return m.supplement_stats_month(); }
	get supplement_stats_empty() { void _lang; return m.supplement_stats_empty(); }
	get supplement_stats_nutrients() { void _lang; return m.supplement_stats_nutrients(); }
	get supplement_stats_show_less() { void _lang; return _lang === 'en' ? 'Show less' : 'Weniger anzeigen'; }
	get supplement_save() { void _lang; return m.supplement_save(); }
	get supplement_delete() { void _lang; return m.supplement_delete(); }
	get supplement_confirm_delete() { void _lang; return m.supplement_confirm_delete(); }
	get supplement_edit_title() { void _lang; return m.supplement_edit_title(); }
	get supplement_new_title() { void _lang; return m.supplement_new_title(); }
	get supplement_stock_label() { void _lang; return m.supplement_stock_label(); }
	get supplement_stock_placeholder() { void _lang; return m.supplement_stock_placeholder(); }
	get supplement_stock_left() { void _lang; return m.supplement_stock_left(); }
	get supplement_default_amount_label() { void _lang; return m.supplement_default_amount_label(); }
	get supplement_default_amount_desc() { void _lang; return m.supplement_default_amount_desc(); }
	get supplement_taken_today() { void _lang; return m.supplement_taken_today(); }
	get supplement_taken() { void _lang; return m.supplement_taken(); }
	get supplement_log_at() { void _lang; return m.supplement_log_at(); }
	get settings_supplement_section() { void _lang; return m.settings_supplement_section(); }
	get settings_supplement_tab_label() { void _lang; return m.settings_supplement_tab_label(); }
	get settings_supplement_tab_desc() { void _lang; return m.settings_supplement_tab_desc(); }
	get settings_recipes_section() { void _lang; return m.settings_recipes_section(); }
	get settings_recipes_tab_label() { void _lang; return m.settings_recipes_tab_label(); }
	get settings_recipes_tab_desc() { void _lang; return m.settings_recipes_tab_desc(); }
	get disable_hint_supplements() { void _lang; return m.disable_hint_supplements(); }
	get disable_hint_recipes() { void _lang; return m.disable_hint_recipes(); }
	// supplement reminders
	get supplement_reminders_title() { void _lang; return m.supplement_reminders_title(); }
	get supplement_reminders_add() { void _lang; return m.supplement_reminders_add(); }
	get supplement_reminders_empty() { void _lang; return m.supplement_reminders_empty(); }
	get supplement_reminders_save() { void _lang; return m.supplement_reminders_save(); }
	get supplement_reminders_delete() { void _lang; return m.supplement_reminders_delete(); }
	get supplement_reminders_days_label() { void _lang; return m.supplement_reminders_days_label(); }
	get supplement_reminders_time_label() { void _lang; return m.supplement_reminders_time_label(); }
	get supplement_reminders_edit() { void _lang; return m.supplement_reminders_edit(); }
	get supplement_reminders_after_create() { void _lang; return m.supplement_reminders_after_create(); }
	get supplement_reminders_deactivated() { void _lang; return m.supplement_reminders_deactivated(); }
	get supplement_day_mo() { void _lang; return m.supplement_day_mo(); }
	get supplement_day_di() { void _lang; return m.supplement_day_di(); }
	get supplement_day_mi() { void _lang; return m.supplement_day_mi(); }
	get supplement_day_do() { void _lang; return m.supplement_day_do(); }
	get supplement_day_fr() { void _lang; return m.supplement_day_fr(); }
	get supplement_day_sa() { void _lang; return m.supplement_day_sa(); }
	get supplement_day_so() { void _lang; return m.supplement_day_so(); }
	get supplement_log_edit_title() { void _lang; return m.supplement_log_edit_title(); }
	get supplement_log_add_title() { void _lang; return m.supplement_log_add_title(); }
	get supplement_log_date() { void _lang; return m.supplement_log_date(); }
	get supplement_log_select_supplement() { void _lang; return m.supplement_log_select_supplement(); }
	// water tracker
	get water_title() { void _lang; return m.water_title(); }
	get water_toggle_label() { void _lang; return m.water_toggle_label(); }
	get water_goal_label() { void _lang; return m.water_goal_label(); }
	get water_goal_edit() { void _lang; return m.water_goal_edit(); }
	get water_disabled_hint() { void _lang; return m.water_disabled_hint(); }
	get water_custom() { void _lang; return m.water_custom(); }
	get water_custom_placeholder() { void _lang; return m.water_custom_placeholder(); }
	get water_add() { void _lang; return m.water_add(); }
	get water_logged() { void _lang; return m.water_logged(); }
	get water_log_delete() { void _lang; return m.water_log_delete(); }
	get water_error_offline() { void _lang; return m.water_error_offline(); }
	get water_collapse() { void _lang; return m.water_collapse(); }
	get water_expand() { void _lang; return m.water_expand(); }
	get water_presets_label() { void _lang; return m.water_presets_label(); }
	get water_edit_title() { void _lang; return m.water_edit_title(); }
	get water_reminder_from() { void _lang; return m.water_reminder_from(); }
	get water_reminder_until() { void _lang; return m.water_reminder_until(); }
	get water_reminder_interval() { void _lang; return m.water_reminder_interval(); }
	// caffeine tracker
	get caffeine_title() { void _lang; return m.caffeine_title(); }
	get caffeine_toggle_label() { void _lang; return m.caffeine_toggle_label(); }
	get caffeine_limit_label() { void _lang; return m.caffeine_limit_label(); }
	get caffeine_limit_edit() { void _lang; return m.caffeine_limit_edit(); }
	get caffeine_visible_drinks() { void _lang; return m.caffeine_visible_drinks(); }
	get caffeine_disabled_hint() { void _lang; return m.caffeine_disabled_hint(); }
	get caffeine_add() { void _lang; return m.caffeine_add(); }
	get caffeine_logged() { void _lang; return m.caffeine_logged(); }
	get caffeine_log_delete() { void _lang; return m.caffeine_log_delete(); }
	get caffeine_error_offline() { void _lang; return m.caffeine_error_offline(); }
	get caffeine_collapse() { void _lang; return m.caffeine_collapse(); }
	get caffeine_expand() { void _lang; return m.caffeine_expand(); }
	get caffeine_edit_title() { void _lang; return m.caffeine_edit_title(); }
	get caffeine_drink_picker_title() { void _lang; return m.caffeine_drink_picker_title(); }
	get caffeine_custom_amount() { void _lang; return m.caffeine_custom_amount(); }
	get caffeine_mg_preview() { void _lang; return m.caffeine_mg_preview(); }
	get caffeine_admin_drinks_title() { void _lang; return m.caffeine_admin_drinks_title(); }
	get caffeine_drink_name() { void _lang; return m.caffeine_drink_name(); }
	get caffeine_drink_default_ml() { void _lang; return m.caffeine_drink_default_ml(); }
	get caffeine_drink_caffeine_mg() { void _lang; return m.caffeine_drink_caffeine_mg(); }
	get caffeine_today_ml() { void _lang; return m.caffeine_today_ml(); }
	get caffeine_limit_exceeded() { void _lang; return m.caffeine_limit_exceeded(); }
	// meditation tracker
	get meditation_title() { void _lang; return m.meditation_title(); }
	get meditation_toggle_label() { void _lang; return m.meditation_toggle_label(); }
	get meditation_disabled_hint() { void _lang; return m.meditation_disabled_hint(); }
	get meditation_goal_label() { void _lang; return m.meditation_goal_label(); }
	get meditation_default_duration() { void _lang; return m.meditation_default_duration(); }
	get meditation_prep_seconds() { void _lang; return m.meditation_prep_seconds(); }
	get meditation_prep_none() { void _lang; return m.meditation_prep_none(); }
	get meditation_volume() { void _lang; return m.meditation_volume(); }
	get meditation_start_sound() { void _lang; return m.meditation_start_sound(); }
	get meditation_end_sound() { void _lang; return m.meditation_end_sound(); }
	get meditation_edit_title() { void _lang; return m.meditation_edit_title(); }
	get meditation_duration() { void _lang; return m.meditation_duration(); }
	get meditation_log_delete() { void _lang; return m.meditation_log_delete(); }
	get meditation_collapse() { void _lang; return m.meditation_collapse(); }
	get meditation_expand() { void _lang; return m.meditation_expand(); }
	get meditation_prepare() { void _lang; return m.meditation_prepare(); }
	get meditation_session_saved() { void _lang; return m.meditation_session_saved(); }
	get meditation_stop_confirm_title() { void _lang; return m.meditation_stop_confirm_title(); }
	get meditation_stop_confirm_continue() { void _lang; return m.meditation_stop_confirm_continue(); }
	get meditation_stop_confirm_end() { void _lang; return m.meditation_stop_confirm_end(); }
	get meditation_reminder_time() { void _lang; return m.meditation_reminder_time(); }
	get meditation_reminder_only_if_not_meditated() { void _lang; return m.meditation_reminder_only_if_not_meditated(); }
	get meditation_start() { void _lang; return m.meditation_start(); }
	// meal plan
	get meal_plan_tab() { void _lang; return m.meal_plan_tab(); }
	get meal_plan_edit() { void _lang; return m.meal_plan_edit(); }
	get meal_plan_done() { void _lang; return m.meal_plan_done(); }
	get meal_plan_empty_day() { void _lang; return m.meal_plan_empty_day(); }
	get meal_plan_add_title() { void _lang; return m.meal_plan_add_title(); }
	get meal_plan_add_another_title() { void _lang; return m.meal_plan_add_another_title(); }
	get meal_plan_free_text() { void _lang; return m.meal_plan_free_text(); }
	get meal_plan_free_text_placeholder() { void _lang; return m.meal_plan_free_text_placeholder(); }
	get meal_plan_also_on() { void _lang; return m.meal_plan_also_on(); }
	get meal_plan_add_button() { void _lang; return m.meal_plan_add_button(); }
	get meal_plan_remove() { void _lang; return m.meal_plan_remove(); }
	get meal_plan_add_to_list() { void _lang; return m.meal_plan_add_to_list(); }
	get meal_plan_add_week_to_list() { void _lang; return m.meal_plan_add_week_to_list(); }
	get meal_plan_servings() { void _lang; return m.meal_plan_servings(); }
	get meal_plan_no_recipe() { void _lang; return m.meal_plan_no_recipe(); }
	get meal_plan_search_placeholder() { void _lang; return m.meal_plan_search_placeholder(); }
	get meal_plan_no_results() { void _lang; return m.meal_plan_no_results(); }
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
	return `${count} ${count === 1 ? 'Artikel' : 'Artikel'}`;
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
export function reminders_deactivated_for(name: string): string {
	void _lang;
	if (_lang === 'en') return `Reminders for "${name}" have been deactivated`;
	return `Erinnerungen für „${name}" wurden deaktiviert`;
}

export function nutrients_show_more(count: number): string {
	void _lang;
	if (_lang === 'en') return `Show ${count} more`;
	return `${count} weitere anzeigen`;
}

export function today_reminders_label(count: number): string {
	void _lang;
	if (_lang === 'en') return count === 1 ? '1 reminder today' : `${count} reminders today`;
	return count === 1 ? 'heute 1 Erinnerung' : `heute ${count} Erinnerungen`;
}
