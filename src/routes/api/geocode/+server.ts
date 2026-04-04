import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const q = event.url.searchParams.get('q');
	const lat = event.url.searchParams.get('lat');
	const lng = event.url.searchParams.get('lng');

	try {
		// Reverse geocoding
		if (lat && lng) {
			const params = new URLSearchParams({ lat, lon: lng, format: 'json' });
			const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
				headers: { 'User-Agent': 'Groly/1.0 (self-hosted grocery app)' }
			});
			if (!res.ok) throw new Error('Nominatim error');
			return json(await res.json());
		}

		// Forward geocoding
		if (!q?.trim()) return json({ error: 'Query required' }, { status: 400 });
		const params = new URLSearchParams({ q: q.trim(), format: 'json', limit: '5', addressdetails: '1' });
		const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
			headers: { 'User-Agent': 'Groly/1.0 (self-hosted grocery app)' }
		});
		if (!res.ok) throw new Error('Nominatim error');
		return json(await res.json());
	} catch {
		return json({ error: 'Geocoding failed' }, { status: 502 });
	}
};
