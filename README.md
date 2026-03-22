# Groly

Mobile-first PWA Einkaufslisten-App für den Eigenbetrieb. Designed für kleine Teams/Familien (~10 User), läuft als Docker-Container auf einem Heimserver.

## Features

- **Offline-fähig** – Listen und Items werden lokal gecacht (IndexedDB). Abhaken, bearbeiten und löschen funktioniert auch ohne Internet. Änderungen werden automatisch synchronisiert, sobald die Verbindung wieder besteht.
- **Kategorie-Sortierung** – Items werden automatisch nach Kategorie erkannt und können in individueller Reihenfolge angezeigt werden (z.B. nach Supermarkt-Layout).
- **Multi-User** – Admin-Benutzer kann weitere User anlegen und Passwörter zurücksetzen.
- **PWA** – Installierbar auf iOS und Android, funktioniert wie eine native App.
- **Light & Dark Mode** – Automatisch per System-Einstellung.
- **i18n** – Deutsch und Englisch.

## Tech Stack

- **Framework:** SvelteKit (TypeScript, Svelte 5 Runes)
- **Datenbank:** SQLite via better-sqlite3 + Drizzle ORM
- **Auth:** Custom (scrypt + Sessions)
- **Offline:** Dexie.js (IndexedDB) + Sync-Queue
- **PWA:** vite-plugin-pwa
- **CSS:** Tailwind CSS v4
- **Deployment:** Docker (Node.js Adapter)

## Docker Deployment

```yaml
image: ghcr.io/peterthepeter/groly:latest
ports:
  - "3000:3000"
volumes:
  - /mnt/user/appdata/groly:/app/data
environment:
  - ADMIN_USERNAME=dein-username
  - ADMIN_PASSWORD=sicheres-passwort
  - ORIGIN=https://deine-domain.de
  - NODE_ENV=production
```

Das Volume `/app/data` enthält die SQLite-Datenbank. Beim ersten Start wird automatisch ein Admin-User angelegt.

> **Wichtig:** Die App funktioniert nur korrekt über HTTPS. HTTP-Zugriff (z.B. über lokale IP) unterstützt keine Session-Cookies im Production-Modus und keine Service Worker.

## Entwicklung

```sh
npm install
npm run dev
```

## Lizenz

Privates Projekt – kein offizieller Support.
