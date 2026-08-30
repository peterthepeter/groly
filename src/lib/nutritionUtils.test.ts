import { describe, expect, it } from 'vitest';
import {
	calculateNutritionTargets,
	nextNutritionUseCount,
	nutritionBasisSuffix,
	parseOptionalNutritionNumber
} from './nutritionUtils';

describe('calculateNutritionTargets', () => {
	it('calculates a stable Mifflin-St Jeor estimate', () => {
		expect(calculateNutritionTargets({
			sex: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'light'
		})).toEqual({ bmr: 1649, tdee: 2267, protein: 84, fat: 76, carbs: 312, fiber: 30 });
	});

	it('rejects implausible calculator inputs', () => {
		expect(calculateNutritionTargets({
			sex: 'female', age: 9, heightCm: 165, weightKg: 60, activity: 'moderate'
		})).toBeNull();
	});
});

describe('nutrition helpers', () => {
	it('increments usage instead of resetting it', () => {
		expect(nextNutritionUseCount(7)).toBe(8);
		expect(nextNutritionUseCount(null)).toBe(1);
	});

	it('keeps entered zeroes and understands decimal commas', () => {
		expect(parseOptionalNutritionNumber('0')).toBe(0);
		expect(parseOptionalNutritionNumber('3,8')).toBe(3.8);
		expect(parseOptionalNutritionNumber('')).toBeNull();
	});

	it('uses millilitres only for volume-based entries', () => {
		expect(nutritionBasisSuffix('ml')).toBe('ml');
		expect(nutritionBasisSuffix('piece')).toBe('g');
	});
});
