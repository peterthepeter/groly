# Groly

Mobile-first PWA grocery list app for self-hosting. Designed for small teams and families, runs as a Docker container on a home server. Ready for **Unraid** and any other Docker-based home server setup.

## Features

- **Shared lists** – Share lists with other users; changes sync in real time via Server-Sent Events.
- **Offline-first** – Add, check off, edit, and delete items without internet. Changes sync automatically when back online.
- **Barcode scan** – Scan product barcodes with your camera to add items directly to your list (iOS and Android).
- **Push notifications** – Get notified when someone adds an item to a shared list, and when a new app version is available. Works on iOS (16.4+) and Android.
- **Recipes** – Create and manage recipes, scale servings, and add ingredients directly to a shopping list. Import recipes from popular recipe websites by URL.
- **Category sorting** – Items are auto-categorized and displayed in a custom order matching your supermarket layout. Configurable globally and per list.
- **Swipe to peek** – Swipe left or right on any item tile whose name is truncated to reveal the full name in an overlay, without accidentally checking it off.
- **In-app changelog** – A "What's New" modal appears after each update and is always accessible from the menu.
- **Multi-user** – Admin creates users, resets passwords, and manages sharing invitations.
- **PWA** – Installable on iOS and Android, works like a native app.
- **Light & Dark mode** – Follows system preference automatically.
- **i18n** – German and English.

## Docker Deployment

The image is published to GitHub Container Registry and can be pulled directly:

```
ghcr.io/peterthepeter/groly:latest
```

### Docker Compose

```yaml
services:
  groly:
    image: ghcr.io/peterthepeter/groly:latest
    ports:
      - "3000:3000"
    volumes:
      - /mnt/user/appdata/groly:/app/data
    environment:
      - ADMIN_USERNAME=your-username
      - ADMIN_PASSWORD=secure-password
      - ORIGIN=https://your-domain.com
      - NODE_ENV=production
    restart: unless-stopped
```

### Unraid

Add the container via the Unraid Docker UI or Community Applications:

- **Repository:** `ghcr.io/peterthepeter/groly:latest`
- **Port:** `3000` (WebUI)
- **Path:** `/app/data` → e.g. `/mnt/user/appdata/groly`
- **Variables:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ORIGIN`, `NODE_ENV=production`
- **Push notifications (optional):** additionally set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` — see [Push Notifications](#push-notifications-optional) below

The volume `/app/data` contains the SQLite database. An admin user is created on first start and is prompted to change the password on first login.

> **HTTPS required.** Session cookies, the service worker, and push notifications only work over HTTPS. Accessing via a local IP without HTTPS will not work in production mode.

> **Reverse proxy recommended.** Run Groly behind a reverse proxy (e.g. Nginx Proxy Manager, Traefik, or Caddy) to handle HTTPS termination and domain routing. Optionally add an intrusion detection layer (e.g. CrowdSec) for additional protection.

> **Architecture:** The Docker image is built for `linux/amd64` only.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Path to the SQLite file, e.g. `/app/data/groly.db` |
| `ORIGIN` | Yes | Full URL of your instance, e.g. `https://groly.example.com` |
| `ADMIN_USERNAME` | First run only | Username for the initial admin account |
| `ADMIN_PASSWORD` | First run only | Password for the initial admin account |
| `VAPID_PUBLIC_KEY` | Optional | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key for push notifications |
| `PUBLIC_VAPID_PUBLIC_KEY` | Optional | Same value as `VAPID_PUBLIC_KEY` |
| `VAPID_SUBJECT` | Optional | `https://` URL or `mailto:` address for VAPID |
| `NODE_ENV` | Recommended | Set to `production` |

### Push Notifications (optional)

Generate a VAPID key pair once:

```sh
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
```

Add to your environment:

```yaml
environment:
  - VAPID_PUBLIC_KEY=<publicKey>
  - VAPID_PRIVATE_KEY=<privateKey>
  - PUBLIC_VAPID_PUBLIC_KEY=<same publicKey>
  - VAPID_SUBJECT=https://your-domain.com
```

**Important:**
- `VAPID_PUBLIC_KEY` and `PUBLIC_VAPID_PUBLIC_KEY` must be the **same value**.
- `VAPID_SUBJECT` must be a real `https://` URL or `mailto:` address — a `.local` domain will be rejected by Apple's push service.
- Generate the keys **once** and keep them. If the keys change, all existing subscriptions become invalid and users need to re-subscribe in Settings.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit (TypeScript, Svelte 5 Runes) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | Custom (scrypt + sessions, 30-day expiry) |
| Real-time | Server-Sent Events (SSE) |
| Offline | Dexie.js (IndexedDB) + mutation queue |
| Push | Web Push API + VAPID (web-push) |
| Barcode | @zxing/browser |
| PWA | vite-plugin-pwa + Workbox |
| CSS | Tailwind CSS v4 |
| i18n | Paraglide-SvelteKit |
| Deployment | Docker (Node.js adapter), linux/amd64 |

## Development

```sh
npm install
npm run dev
```

```sh
npm run check        # type-check
npm run build        # production build
npm run preview      # preview production build
```

After schema changes, generate a Drizzle migration:

```sh
npx drizzle-kit generate
```

Migrations run automatically on server startup via `src/hooks.server.ts`.
