import type { User } from '$lib/db/schema';

declare global {
	namespace App {
		interface Locals {
			user?: User;
		}
	}

	class BarcodeDetector {
		constructor(options?: { formats?: string[] });
		detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
		static getSupportedFormats(): Promise<string[]>;
	}
}

export {};
