# Groly

Mobile-first PWA grocery list app for self-hosting. Designed for small teams/families (~10 users), runs as a Docker container on a home server.

## Features

- **Offline support** – Lists and items are cached locally (IndexedDB). Checking off, editing and deleting items works without internet. Changes sync automatically once the connection is restored.
- **Category sorting** – Items are automatically assigned a category and can be displayed in a custom order (e.g. matching your supermarket layout).
- **Multi-user** – Admin can create additional users and reset passwords.
- **PWA** – Installable on iOS and Android, works like a native app.
- **Light & Dark mode** – Follows system preference automatically.
- **i18n** – German and English.

## Tech Stack

- **Framework:** SvelteKit (TypeScript, Svelte 5 Runes)
- **Database:** SQLite via better-sqlite3 + Drizzle ORM
- **Auth:** Custom (scrypt + Sessions)
- **Offline:** Dexie.js (IndexedDB) + Sync queue
- **PWA:** vite-plugin-pwa
- **CSS:** Tailwind CSS v4
- **Deployment:** Docker (Node.js adapter)

## Docker Deployment

```yaml
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
```

The volume `/app/data` contains the SQLite database. An admin user is created automatically on first start.

> **Note:** The app only works correctly over HTTPS. HTTP access (e.g. via local IP) does not support session cookies in production mode and no service worker.

## Development

```sh
npm install
npm run dev
```
