# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run check        # Type-check (svelte-check + tsc)
npm run check:watch  # Type-check in watch mode
npm run preview      # Preview production build
```

No test suite exists in this project.

After schema changes, create a new Drizzle migration:
```bash
npx drizzle-kit generate
```
Migrations run automatically on server startup via `src/hooks.server.ts`.

## Architecture

**Groly** is a mobile-first PWA grocery list app for self-hosting, targeting families and small businesses (SvelteKit + SQLite, scales to ~50 users). Published on GitHub.

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5 (Runes), TypeScript, Tailwind CSS v4 |
| Backend | SvelteKit server routes (Node.js adapter) |
| Database | SQLite + Drizzle ORM |
| Auth | Custom scrypt sessions (30-day expiry) |
| Real-time | Server-Sent Events (SSE) per list |
| Offline | Dexie.js (IndexedDB) + mutation queue |
| PWA | vite-plugin-pwa + Workbox |
| i18n | Paraglide-sveltekit (de + en) |

### Key architectural patterns

**Offline-first sync** (`src/lib/sync/`): All writes go through an optimistic update + IndexedDB mutation queue. `manager.ts` drains the queue, retrying on network errors and removing on 404/409/403.

**Real-time** (`src/lib/server/listEvents.ts`): In-memory pub/sub. API routes emit events; SSE endpoint at `/api/lists/[id]/events` streams them to clients with 25-second keepalive pings.

**Server hooks** (`src/hooks.server.ts`): Runs DB migrations and admin bootstrap on startup. Validates sessions on every request. Enforces redirects: unauthenticated → `/login`, `mustChangePassword` → `/einstellungen`.

**Admin bootstrap**: On first start, `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars create the first admin user. The `mustChangePassword` flag forces a password change on first login.

### Route structure
- `src/routes/` — pages: `/`, `/login`, `/einstellungen`, `/einstellungen/users`, `/listen/[id]`
- `src/routes/api/` — REST endpoints + SSE
- `src/lib/components/` — Svelte UI components
- `src/lib/server/` — server-only modules (DB, auth, events)
- `src/lib/sync/` — offline sync logic
- `drizzle/` — SQL migrations (auto-applied on startup)

### Database tables
`users`, `sessions`, `lists`, `items`, `listMembers` — defined in `src/lib/server/db/schema.ts`.

### Automatic database cleanup

`src/hooks.server.ts` runs cleanup daily via `setInterval` (triggered on first request after startup):

| Table | Cleanup rule |
|-------|-------------|
| `sessions` | Expired sessions deleted (expiry > 30 days after login) |
| `items` | Checked items deleted after 60 days (`checkedAt`) |
| `item_history` | Suggestions unused for 6+ months deleted |
| `barcode_cache` | Entries not seen for 6+ months deleted |
| `push_subscriptions` | Stale endpoints removed on failed push (HTTP 410/404) |

Active data (`lists`, unchecked `items`, `recipes`, `listMembers`) is only removed by user action. For a typical self-hosted instance (~50 users) this is not a concern — the database stays well under 100 MB indefinitely.

## Deployment

Docker image built via GitHub Actions (`.github/workflows/docker.yml`) and pushed to GHCR. Multi-arch (amd64 + arm64).

Required env vars at runtime:
- `DATABASE_URL` — path to SQLite file (e.g. `/app/data/groly.db`)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — only needed on first run
- `ORIGIN` — for HTTPS cookie validation in production

## Release checklist (vor jedem Push/Release)

**PFLICHT vor jedem `git push`:** Claude muss den User fragen:
1. „Welche Versionsnummer soll die neue Version bekommen?" (SemVer, z.B. `1.2.0`)
2. „Was soll im Changelog stehen?" (de + en, als Stichpunkte)

Danach diese zwei Dateien aktualisieren:
- **`src/lib/changelog.ts`** — neuen Eintrag oben einfügen (de + en)
- **`package.json`** — `"version"` auf die neue Versionsnummer setzen

Erst dann darf gepusht werden.

## Feature development

**PFLICHT:** Vor dem Beginn jeder Feature-Implementierung warten, bis der User explizit "Go" gibt. Niemals eigenständig mit dem Bauen anfangen, auch wenn das Konzept bereits vollständig besprochen wurde.

**Neue Features müssen immer:**
- Zweisprachig sein (de + en) — alle i18n-Keys in beiden Sprachdateien pflegen
- In der Bedienungsanleitung (`InfoModal`) dokumentiert werden — neue Funktionen unter dem passenden Abschnitt eintragen

## UI conventions

- **Mobile-first**: Bottom navigation, touch-optimized components.
- **Input font-size**: Always ≥ 16px to prevent iOS auto-zoom (enforced globally in `app.css`).
- **Tailwind v4**: No config file — uses CSS-based configuration.
- **Icons**: List icons defined in `src/lib/listIcons.ts`.
- **Badge icons in ListCard**: Always use `stroke="var(--color-primary)"`, `width="17" height="17"`, `p-1.5 -mr-1` wrapper — no `opacity` attribute. All badge icons must look identical.
- **Categories**: Auto-categorization in `src/lib/categories.ts`; users can override per item.
- Use the `frontend-design` skill for any UI/design changes.


