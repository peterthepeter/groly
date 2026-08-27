export type StockAdjustment = {
	stockQuantity: number | null;
	stockDeducted: number | null;
};

export function deductSupplementStock(
	stockQuantity: number | null,
	amount: number
): StockAdjustment {
	if (stockQuantity == null) return { stockQuantity: null, stockDeducted: null };
	const available = Math.max(0, stockQuantity);
	const stockDeducted = Math.min(available, amount);
	return { stockQuantity: available - stockDeducted, stockDeducted };
}

export function recalculateSupplementStock(
	stockQuantity: number | null,
	previousAmount: number,
	previousStockDeducted: number | null,
	newAmount: number
): StockAdjustment {
	if (stockQuantity == null) return { stockQuantity: null, stockDeducted: null };
	const restored = Math.max(0, stockQuantity) + Math.max(0, previousStockDeducted ?? previousAmount);
	return deductSupplementStock(restored, newAmount);
}

export function restoreSupplementStock(
	stockQuantity: number | null,
	amount: number,
	stockDeducted: number | null
): number | null {
	if (stockQuantity == null) return null;
	return Math.max(0, stockQuantity) + Math.max(0, stockDeducted ?? amount);
}
