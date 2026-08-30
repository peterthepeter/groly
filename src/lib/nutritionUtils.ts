export type NutritionActivity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type NutritionSex = 'female' | 'male';

export const NUTRITION_ACTIVITY_FACTORS: Record<NutritionActivity, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	'very-active': 1.9
};

export const NUTRITION_PROTEIN_PER_KG: Record<NutritionActivity, number> = {
	sedentary: 0.8,
	light: 1.2,
	moderate: 1.4,
	active: 1.6,
	'very-active': 1.8
};

export type NutritionTargetEstimate = {
	bmr: number;
	tdee: number;
	protein: number;
	fat: number;
	carbs: number;
	fiber: number;
};

export function calculateNutritionTargets(input: {
	sex: NutritionSex;
	age: number;
	heightCm: number;
	weightKg: number;
	activity: NutritionActivity;
}): NutritionTargetEstimate | null {
	const { sex, age, heightCm, weightKg, activity } = input;
	if (!Number.isFinite(age) || age < 10 || age > 120) return null;
	if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) return null;
	if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) return null;

	const bmrRaw = sex === 'male'
		? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
		: 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
	const tdee = Math.round(bmrRaw * NUTRITION_ACTIVITY_FACTORS[activity]);
	const protein = Math.round(weightKg * NUTRITION_PROTEIN_PER_KG[activity]);
	const fat = Math.round((tdee * 0.3) / 9);
	const carbs = Math.max(0, Math.round((tdee - protein * 4 - fat * 9) / 4));

	return { bmr: Math.round(bmrRaw), tdee, protein, fat, carbs, fiber: 30 };
}

export function nextNutritionUseCount(current: number | null | undefined): number {
	return Math.max(0, Number.isFinite(current) ? current ?? 0 : 0) + 1;
}

export function parseOptionalNutritionNumber(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed.replace(',', '.'));
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function nutritionBasisSuffix(unit: 'g' | 'ml' | 'piece'): 'g' | 'ml' {
	return unit === 'ml' ? 'ml' : 'g';
}
