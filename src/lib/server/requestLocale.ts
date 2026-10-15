import { AsyncLocalStorage } from 'node:async_hooks';
import { overwriteServerAsyncLocalStorage, type Locale } from '#lib/paraglide/runtime';

// Locale state is request-local; a German request cannot affect English SSR.
const context = new AsyncLocalStorage<{ locale?: Locale; origin?: string; messageCalls?: Set<string> }>();
overwriteServerAsyncLocalStorage(context);

export function withRequestLocale<T>(locale: Locale, origin: string, render: () => T): T {
	return context.run({ locale, origin, messageCalls: new Set() }, render);
}
