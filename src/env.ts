import { defineEnvVars } from '@sveltejs/kit/env';

// Runtime values: the same image must work with each operator's existing keys.
export const variables = defineEnvVars({
	VAPID_PUBLIC_KEY: { schema: value => value ?? '' },
	VAPID_PRIVATE_KEY: { schema: value => value ?? '' },
	VAPID_SUBJECT: { schema: value => value || 'mailto:admin@groly.local' },
	PUBLIC_VAPID_PUBLIC_KEY: { public: true, schema: value => value ?? '' }
});
