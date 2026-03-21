import type { User } from '$lib/db/schema';

declare global {
	namespace App {
		interface Locals {
			user?: User;
		}
	}
}

export {};
