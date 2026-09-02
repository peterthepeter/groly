export type MoodLevel = { value: 1 | 2 | 3 | 4 | 5; emoji: string; labelKey: string; color: string; bgColor: string };
export const MOOD_LEVELS: MoodLevel[] = [
	{ value: 1, emoji: '😞', labelKey: 'mood_very_bad', color: '#E57373', bgColor: 'rgba(229,115,115,0.15)' },
	{ value: 2, emoji: '😕', labelKey: 'mood_bad', color: '#E89150', bgColor: 'rgba(232,145,80,0.15)' },
	{ value: 3, emoji: '😐', labelKey: 'mood_okay', color: '#C8956C', bgColor: 'rgba(200,149,108,0.15)' },
	{ value: 4, emoji: '😊', labelKey: 'mood_good', color: '#9F7AEA', bgColor: 'rgba(159,122,234,0.15)' },
	{ value: 5, emoji: '😄', labelKey: 'mood_great', color: '#F472B6', bgColor: 'rgba(244,114,182,0.15)' }
];
export const ENERGY_LEVELS = [
	{ value: 1, labelKey: 'mood_energy_very_low' }, { value: 2, labelKey: 'mood_energy_low' },
	{ value: 3, labelKey: 'mood_energy_medium' }, { value: 4, labelKey: 'mood_energy_high' },
	{ value: 5, labelKey: 'mood_energy_very_high' }
] as const;
export function getMoodLevel(value: number): MoodLevel { return MOOD_LEVELS.find(m => m.value === value) ?? MOOD_LEVELS[2]; }

export type MoodTagKind = 'feeling' | 'body' | 'behavior' | 'context' | 'event';
export type ActivityTag = { key: string; labelKey: string; icon: string; category: string; kind: MoodTagKind; analyticsGroup: string };
export type ActivityCategory = { key: string; labelKey: string; tags: ActivityTag[] };
const tag = (key: string, icon: string, category: string, kind: MoodTagKind, analyticsGroup: string): ActivityTag => ({ key, labelKey: `act_${key}`, icon, category, kind, analyticsGroup });

// Stable keys make old data and future evaluations comparable even when the UI grouping evolves.
export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
	{ key: 'emotions', labelKey: 'mood_cat_emotions', tags: [
		tag('excited','zap','emotions','feeling','pleasant_active'), tag('happy','smile','emotions','feeling','pleasant_active'), tag('proud','award','emotions','feeling','pleasant_active'), tag('hopeful','sprout','emotions','feeling','pleasant_active'),
		tag('grateful','heart','emotions','feeling','pleasant_calm'), tag('relaxed','sun','emotions','feeling','pleasant_calm'), tag('anxious','alert-circle','emotions','feeling','unpleasant_active'), tag('angry','flame','emotions','feeling','unpleasant_active'),
		tag('stressed','gauge','emotions','feeling','unpleasant_active'), tag('annoyed','circle-minus','emotions','feeling','unpleasant_active'), tag('sad','frown','emotions','feeling','unpleasant_calm'), tag('lonely','cloud-rain','emotions','feeling','unpleasant_calm'),
		tag('depressed','cloud','emotions','feeling','unpleasant_calm'), tag('bored','meh','emotions','feeling','unpleasant_calm')
	] },
	{ key: 'body', labelKey: 'mood_cat_body', tags: [
		tag('good_sleep','moon','body','body','sleep'), tag('bad_sleep','cloud-moon','body','body','sleep'), tag('tired','battery-low','body','body','energy'), tag('healthy_eating','salad','body','behavior','nutrition'),
		tag('meditation','flower-2','body','behavior','meditation'), tag('caffeine','coffee','body','behavior','caffeine'), tag('supplements','pill','body','behavior','supplements'), tag('doctor_visit','stethoscope','body','event','healthcare'), tag('sick','thermometer','body','body','illness')
	] },
	{ key: 'movement', labelKey: 'mood_cat_movement', tags: [
		tag('sport_general','trophy','movement','behavior','movement'), tag('running','person-standing','movement','behavior','movement'), tag('walk','footprints','movement','behavior','movement'), tag('cycling','bike','movement','behavior','movement'),
		tag('climbing','mountain-snow','movement','behavior','movement'), tag('bouldering','mountain','movement','behavior','movement'), tag('yoga','flower-2','movement','behavior','movement'), tag('swimming','waves','movement','behavior','movement'),
		tag('gym','dumbbell','movement','behavior','movement'), tag('hiking','map','movement','behavior','movement'), tag('stretching','activity','movement','behavior','movement'), tag('team_sport','users','movement','behavior','movement'), tag('dancing','music','movement','behavior','movement')
	] },
	{ key: 'social', labelKey: 'mood_cat_social', tags: [
		tag('friends','users','social','context','social'), tag('family','home','social','context','social'), tag('date','heart','social','context','social'), tag('party','party-popper','social','event','social'),
		tag('connection','heart','social','feeling','social_quality'), tag('good_conversation','users','social','event','social_quality'), tag('conflict','flame','social','event','social_quality'), tag('alone_time','coffee','social','context','alone_time')
	] },
	{ key: 'leisure', labelKey: 'mood_cat_leisure', tags: [
		tag('outdoor','leaf','leisure','behavior','nature'), tag('reading','book-open','leisure','behavior','leisure'), tag('music','music','leisure','behavior','leisure'), tag('gaming','gamepad-2','leisure','behavior','leisure'),
		tag('movie','film','leisure','behavior','leisure'), tag('tv','tv','leisure','behavior','leisure'), tag('drawing','palette','leisure','behavior','creative'), tag('painting','paintbrush','leisure','behavior','creative'),
		tag('cooking','chef-hat','leisure','behavior','leisure'), tag('photography','camera','leisure','behavior','creative'), tag('gardening','shovel','leisure','behavior','nature'), tag('dining_out','utensils','leisure','event','leisure'),
		tag('concert','ticket','leisure','event','leisure'), tag('diy','hammer','leisure','behavior','creative')
	] },
	{ key: 'daily', labelKey: 'mood_cat_daily', tags: [
		tag('work_normal','briefcase','daily','context','work'), tag('end_on_time','circle-check','daily','event','work'), tag('overtime','alarm-clock','daily','event','work'), tag('pressured','timer','daily','feeling','workload'),
		tag('work_from_home','house','daily','context','work'), tag('vacation','plane','daily','context','time_off'), tag('sick_day','bed','daily','event','time_off'), tag('weekend','sofa','daily','context','time_off')
	] },
	{ key: 'weather', labelKey: 'mood_cat_weather', tags: [
		tag('sunny','sun','weather','context','weather'), tag('rainy','cloud-rain','weather','context','weather'), tag('cloudy','cloud','weather','context','weather'), tag('hot','thermometer-sun','weather','context','weather'), tag('snow','snowflake','weather','context','weather')
	] }
];
export const RETIRED_MOOD_TAGS: ActivityTag[] = [tag('shopping','shopping-bag','leisure','event','shopping'), tag('calm','moon','emotions','feeling','pleasant_calm')];
export function getAllPredefinedTagKeys(): string[] { return ACTIVITY_CATEGORIES.flatMap(c => c.tags.map(t => t.key)); }
export function findTag(key: string): ActivityTag | undefined { return ACTIVITY_CATEGORIES.flatMap(c => c.tags).find(t => t.key === key) ?? RETIRED_MOOD_TAGS.find(t => t.key === key); }
