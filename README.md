# Groly

Mobile-first PWA grocery list app for self-hosting. Designed for small teams/families (~10 users), runs as a Docker container on a home server.

## Features

- **Shared lists** – Share lists with other users, changes sync in real-time via Server-Sent Events.
- **Offline support** – All actions (add, check off, edit, delete) work without internet and sync automatically when back online.
- **Push notifications** – Get notified when someone adds an item to a shared list. Works on iOS (16.4+) and Android.
- **Recipes** – Create and manage recipes, scale servings, add ingredients directly to a shopping list.
- **Category sorting** – Items are automatically assigned a category and displayed in a custom order matching your supermarket layout.
- **Multi-user** – Admin creates users, resets passwords, manages sharing invitations.
- **PWA** – Installable on iOS and Android, works like a native app.
- **Light & Dark mode** – Follows system preference automatically.
- **i18n** – German and English.

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

The volume `/app/data` contains the SQLite database. An admin user is created on first start and is prompted to change the password on first login.

> **HTTPS required.** Session cookies, the service worker and push notifications only work over HTTPS. Local IP access without HTTPS will not work in production mode.

### Push Notifications (optional)

To enable push notifications, generate a VAPID key pair once and add it to your environment:

```sh
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
```

```yaml
environment:
  - VAPID_PUBLIC_KEY=<publicKey from above>
  - VAPID_PRIVATE_KEY=<privateKey from above>
  - PUBLIC_VAPID_PUBLIC_KEY=<same publicKey again>
  - VAPID_SUBJECT=https://your-domain.com
```

**Important:**
- `VAPID_PUBLIC_KEY` and `PUBLIC_VAPID_PUBLIC_KEY` must be the **same value**.
- `VAPID_SUBJECT` must be a real `https://` URL or a real `mailto:` address. A `.local` domain will be rejected by Apple's push service.
- Generate the keys **once** and keep them. If the keys change, all existing push subscriptions become invalid and users need to re-subscribe in Settings.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit (TypeScript, Svelte 5 Runes) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | Custom (scrypt + Sessions, 30-day expiry) |
| Real-time | Server-Sent Events (SSE) per list |
| Offline | Dexie.js (IndexedDB) + mutation queue |
| Push | Web Push API + VAPID (web-push) |
| PWA | vite-plugin-pwa + Workbox |
| CSS | Tailwind CSS v4 |
| Deployment | Docker (Node.js adapter), multi-arch (amd64 + arm64) |

## Development

```sh
npm install
npm run dev
```

Type-check:

```sh
npm run check
```

After schema changes, generate a Drizzle migration:

```sh
npx drizzle-kit generate
```

Migrations run automatically on server startup.
