export type MoodLevel = {
	value: 1 | 2 | 3 | 4 | 5;
	emoji: string;
	labelKey: string;
	color: string;
	bgColor: string;
};

export const MOOD_LEVELS: MoodLevel[] = [
	{ value: 1, emoji: '😞', labelKey: 'mood_very_bad', color: '#F87171', bgColor: 'rgba(248,113,113,0.15)' },
	{ value: 2, emoji: '😕', labelKey: 'mood_bad', color: '#FB923C', bgColor: 'rgba(251,146,60,0.15)' },
	{ value: 3, emoji: '😐', labelKey: 'mood_okay', color: '#FBBF24', bgColor: 'rgba(251,191,36,0.15)' },
	{ value: 4, emoji: '😊', labelKey: 'mood_good', color: '#60A5FA', bgColor: 'rgba(96,165,250,0.15)' },
	{ value: 5, emoji: '😄', labelKey: 'mood_great', color: '#A78BFA', bgColor: 'rgba(167,139,250,0.15)' }
];

export function getMoodLevel(value: number): MoodLevel {
	return MOOD_LEVELS.find(m => m.value === value) ?? MOOD_LEVELS[2];
}

export type ActivityTag = {
	key: string;
	labelKey: string;
	icon: string;
	category: string;
};

export type ActivityCategory = {
	key: string;
	labelKey: string;
	tags: ActivityTag[];
};

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
	{
		key: 'emotions',
		labelKey: 'mood_cat_emotions',
		tags: [
			{ key: 'happy', labelKey: 'act_happy', icon: 'smile', category: 'emotions' },
			{ key: 'relaxed', labelKey: 'act_relaxed', icon: 'sun', category: 'emotions' },
			{ key: 'excited', labelKey: 'act_excited', icon: 'zap', category: 'emotions' },
			{ key: 'grateful', labelKey: 'act_grateful', icon: 'heart', category: 'emotions' },
			{ key: 'proud', labelKey: 'act_proud', icon: 'award', category: 'emotions' },
			{ key: 'calm', labelKey: 'act_calm', icon: 'moon', category: 'emotions' },
			{ key: 'hopeful', labelKey: 'act_hopeful', icon: 'sprout', category: 'emotions' },
			{ key: 'depressed', labelKey: 'act_depressed', icon: 'cloud', category: 'emotions' },
			{ key: 'lonely', labelKey: 'act_lonely', icon: 'cloud-rain', category: 'emotions' },
			{ key: 'anxious', labelKey: 'act_anxious', icon: 'alert-circle', category: 'emotions' },
			{ key: 'sad', labelKey: 'act_sad', icon: 'frown', category: 'emotions' },
			{ key: 'angry', labelKey: 'act_angry', icon: 'flame', category: 'emotions' },
			{ key: 'stressed', labelKey: 'act_stressed', icon: 'gauge', category: 'emotions' },
			{ key: 'tired', labelKey: 'act_tired', icon: 'battery-low', category: 'emotions' },
			{ key: 'bored', labelKey: 'act_bored', icon: 'meh', category: 'emotions' },
			{ key: 'annoyed', labelKey: 'act_annoyed', icon: 'circle-minus', category: 'emotions' },
			{ key: 'pressured', labelKey: 'act_pressured', icon: 'timer', category: 'emotions' }
		]
	},
	{
		key: 'hobbies',
		labelKey: 'mood_cat_hobbies',
		tags: [
			{ key: 'reading', labelKey: 'act_reading', icon: 'book-open', category: 'hobbies' },
			{ key: 'music', labelKey: 'act_music', icon: 'music', category: 'hobbies' },
			{ key: 'gaming', labelKey: 'act_gaming', icon: 'gamepad-2', category: 'hobbies' },
			{ key: 'movie', labelKey: 'act_movie', icon: 'film', category: 'hobbies' },
			{ key: 'tv', labelKey: 'act_tv', icon: 'tv', category: 'hobbies' },
			{ key: 'drawing', labelKey: 'act_drawing', icon: 'palette', category: 'hobbies' },
			{ key: 'painting', labelKey: 'act_painting', icon: 'paintbrush', category: 'hobbies' },
			{ key: 'cooking', labelKey: 'act_cooking', icon: 'chef-hat', category: 'hobbies' },
			{ key: 'photography', labelKey: 'act_photography', icon: 'camera', category: 'hobbies' },
			{ key: 'gardening', labelKey: 'act_gardening', icon: 'shovel', category: 'hobbies' },
			{ key: 'dining_out', labelKey: 'act_dining_out', icon: 'utensils', category: 'hobbies' },
			{ key: 'shopping', labelKey: 'act_shopping', icon: 'shopping-bag', category: 'hobbies' },
			{ key: 'concert', labelKey: 'act_concert', icon: 'ticket', category: 'hobbies' },
			{ key: 'diy', labelKey: 'act_diy', icon: 'hammer', category: 'hobbies' }
		]
	},
	{
		key: 'sport',
		labelKey: 'mood_cat_sport',
		tags: [
			{ key: 'sport_general', labelKey: 'act_sport_general', icon: 'trophy', category: 'sport' },
			{ key: 'running', labelKey: 'act_running', icon: 'person-standing', category: 'sport' },
			{ key: 'walk', labelKey: 'act_walk', icon: 'footprints', category: 'sport' },
			{ key: 'cycling', labelKey: 'act_cycling', icon: 'bike', category: 'sport' },
			{ key: 'climbing', labelKey: 'act_climbing', icon: 'mountain-snow', category: 'sport' },
			{ key: 'bouldering', labelKey: 'act_bouldering', icon: 'mountain', category: 'sport' },
			{ key: 'yoga', labelKey: 'act_yoga', icon: 'flower-2', category: 'sport' },
			{ key: 'swimming', labelKey: 'act_swimming', icon: 'waves', category: 'sport' },
			{ key: 'gym', labelKey: 'act_gym', icon: 'dumbbell', category: 'sport' },
			{ key: 'hiking', labelKey: 'act_hiking', icon: 'map', category: 'sport' },
			{ key: 'stretching', labelKey: 'act_stretching', icon: 'activity', category: 'sport' }
		]
	},
	{
		key: 'social',
		labelKey: 'mood_cat_social',
		tags: [
			{ key: 'friends', labelKey: 'act_friends', icon: 'users', category: 'social' },
			{ key: 'family', labelKey: 'act_family', icon: 'home', category: 'social' },
			{ key: 'date', labelKey: 'act_date', icon: 'heart', category: 'social' },
			{ key: 'party', labelKey: 'act_party', icon: 'party-popper', category: 'social' },
			{ key: 'alone_time', labelKey: 'act_alone_time', icon: 'coffee', category: 'social' }
		]
	},
	{
		key: 'health',
		labelKey: 'mood_cat_health',
		tags: [
			{ key: 'good_sleep', labelKey: 'act_good_sleep', icon: 'moon', category: 'health' },
			{ key: 'bad_sleep', labelKey: 'act_bad_sleep', icon: 'cloud-moon', category: 'health' },
			{ key: 'healthy_eating', labelKey: 'act_healthy_eating', icon: 'salad', category: 'health' },
			{ key: 'meditation', labelKey: 'act_meditation', icon: 'flower-2', category: 'health' },
			{ key: 'caffeine', labelKey: 'act_caffeine', icon: 'coffee', category: 'health' },
			{ key: 'supplements', labelKey: 'act_supplements', icon: 'pill', category: 'health' },
			{ key: 'doctor_visit', labelKey: 'act_doctor_visit', icon: 'stethoscope', category: 'health' },
			{ key: 'sick', labelKey: 'act_sick', icon: 'thermometer', category: 'health' },
			{ key: 'outdoor', labelKey: 'act_outdoor', icon: 'leaf', category: 'health' }
		]
	},
	{
		key: 'work',
		labelKey: 'mood_cat_work',
		tags: [
			{ key: 'work_normal', labelKey: 'act_work_normal', icon: 'briefcase', category: 'work' },
			{ key: 'end_on_time', labelKey: 'act_end_on_time', icon: 'circle-check', category: 'work' },
			{ key: 'overtime', labelKey: 'act_overtime', icon: 'alarm-clock', category: 'work' },
			{ key: 'work_from_home', labelKey: 'act_work_from_home', icon: 'house', category: 'work' },
			{ key: 'vacation', labelKey: 'act_vacation', icon: 'plane', category: 'work' },
			{ key: 'sick_day', labelKey: 'act_sick_day', icon: 'bed', category: 'work' },
			{ key: 'weekend', labelKey: 'act_weekend', icon: 'sofa', category: 'work' }
		]
	},
	{
		key: 'weather',
		labelKey: 'mood_cat_weather',
		tags: [
			{ key: 'sunny', labelKey: 'act_sunny', icon: 'sun', category: 'weather' },
			{ key: 'rainy', labelKey: 'act_rainy', icon: 'cloud-rain', category: 'weather' },
			{ key: 'cloudy', labelKey: 'act_cloudy', icon: 'cloud', category: 'weather' },
			{ key: 'hot', labelKey: 'act_hot', icon: 'thermometer-sun', category: 'weather' },
			{ key: 'snow', labelKey: 'act_snow', icon: 'snowflake', category: 'weather' }
		]
	}
];

export function getAllPredefinedTagKeys(): string[] {
	return ACTIVITY_CATEGORIES.flatMap(c => c.tags.map(t => t.key));
}

export function findTag(key: string): ActivityTag | undefined {
	for (const cat of ACTIVITY_CATEGORIES) {
		const tag = cat.tags.find(t => t.key === key);
		if (tag) return tag;
	}
	return undefined;
}
