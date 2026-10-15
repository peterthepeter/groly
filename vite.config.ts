import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

const pwa = VitePWA({
	strategies: 'injectManifest',
	srcDir: 'src/service-worker',
	outDir: '.svelte-kit/output/client',
	filename: 'service-worker.ts',
	injectRegister: false,
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
		scope: '/',
		id: '/',
		icons: [
			{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
			{ src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
		],
		share_target: {
			action: '/rezepte/import',
			method: 'GET',
			params: { url: 'url' }
		}
	},
	injectManifest: {
		globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
	}
});
// SvelteKit owns HTML and the adapter owns final asset metadata. Generate the
// worker once, immediately before adapter copying/compression/hashing.
const pwaPlugins = pwa.map(plugin => {
	delete plugin.transformIndexHtml;
	if (plugin.name === 'vite-plugin-pwa:build') delete plugin.closeBundle;
	return plugin;
});
const nodeAdapter = adapter({ out: 'build' });

export default defineConfig({
	server: {
		// Allow ngrok hostnames so the dev server is reachable from a phone via
		// `ngrok http 5173`. Dev-only — has no effect on the production build.
		allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.trycloudflare.com']
	},
	plugins: [
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide', strategy: ['globalVariable', 'baseLocale'] }),
		tailwindcss(),
		sveltekit({
			adapter: { ...nodeAdapter, async adapt(builder) {
				await pwa.find(plugin => plugin.name === 'vite-plugin-pwa')!.api.generateSW();
				await nodeAdapter.adapt(builder);
			} },
			serviceWorker: { register: false },
			preprocess: vitePreprocess(),
			dynamicCompileOptions: ({ filename }) => filename.includes('node_modules') ? undefined : { runes: true }
		}),
		...pwaPlugins
	]
});
