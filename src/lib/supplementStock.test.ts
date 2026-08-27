import { describe, expect, it } from 'vitest';
import {
	deductSupplementStock,
	recalculateSupplementStock,
	restoreSupplementStock
} from './supplementStock';

describe('supplement stock arithmetic', () => {
	it('deducts the logged amount and clamps at zero', () => {
		expect(deductSupplementStock(50, 1)).toEqual({ stockQuantity: 49, stockDeducted: 1 });
		expect(deductSupplementStock(2, 5)).toEqual({ stockQuantity: 0, stockDeducted: 2 });
		expect(deductSupplementStock(null, 1)).toEqual({ stockQuantity: null, stockDeducted: null });
	});

	it('recalculates an edited log without losing stock at the zero boundary', () => {
		const increased = recalculateSupplementStock(49, 1, 1, 100);
		expect(increased).toEqual({ stockQuantity: 0, stockDeducted: 50 });

		const reducedAgain = recalculateSupplementStock(
			increased.stockQuantity,
			100,
			increased.stockDeducted,
			1
		);
		expect(reducedAgain).toEqual({ stockQuantity: 49, stockDeducted: 1 });
	});

	it('restores only the quantity that was actually deducted', () => {
		expect(restoreSupplementStock(0, 5, 2)).toBe(2);
		expect(restoreSupplementStock(49, 1, 1)).toBe(50);
		expect(restoreSupplementStock(null, 1, null)).toBeNull();
	});
});
