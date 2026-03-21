import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		VitePWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			manifest: {
				name: 'Groly',
				short_name: 'Groly',
				description: 'Einkaufslisten App',
				theme_color: '#0a0f0e',
				background_color: '#0a0f0e',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^\/api\//,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }
						}
					}
				]
			}
		})
	]
});
