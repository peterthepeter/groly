# Upgrading Groly / Groly aktualisieren

## English

### Updating an existing installation

Keep your existing `/app/data` mount, `DATABASE_URL`, `ORIGIN`, port mapping, admin configuration and VAPID keys. Groly 1.0 still accepts the runtime `ORIGIN` variable. Do not recreate the data volume or reset browser storage. Run only one Groly container per data directory.

Before updating, keep an independent backup of your complete data volume. Stop Groly first when making a filesystem copy, so the database, any WAL/SHM files and uploaded images belong to the same point in time. Automatic local backups do not protect against loss of the disk itself.

On first startup of a new version with an existing database, Groly creates a verified SQLite snapshot and copies `uploads` into:

```text
<directory containing DATABASE_URL>/backups/<timestamp>-<target-version>-<unique-id>/
  groly.db             # uses the original database filename
  uploads/             # absent when there are no uploaded files
  manifest.json        # versions, timestamps, sizes and SHA-256 checksums
```

The SQLite backup API includes committed WAL data. Files and directories are flushed before startup continues. Migrations, seeds, cleanup and ordinary requests wait for the verified snapshot. Normal restarts of the same version do not create another backup. Interrupted initialization reuses its verified original snapshot; a database restored to an older version receives a new snapshot on its next upgrade.

Allow space for the database plus all uploaded images and at least 16 MiB of additional headroom **per retained snapshot**, in addition to ordinary database growth. Backups and incomplete `.partial-*` folders are never automatically deleted. Review and remove old copies yourself only after keeping an independent verified backup.

### If startup is blocked

`GET /api/health` returns 503 while startup is pending or has failed, and 200 only when ready. Startup failures are explained in the container logs. Free sufficient space or correct directory ownership/write permissions, then restart. Do not delete the original database to bypass an error. Do not manually create or edit the hidden `.upgrade-*.json` retry markers.

The image and example Compose file allow ten minutes before health-check failures count. Large upload collections may require a longer health-check startup period in your own deployment configuration. A Docker health-check failure alone does not erase data or recreate the volume.

### Restoring the previous version

1. Stop Groly and any other process using this data directory. Record the exact previous image tag or digest.
2. Keep a separate copy of the **current complete data directory**, including WAL/SHM files, before restoring. A rollback to an older snapshot omits writes made after that snapshot; retain the current copy for recovery.
3. Select one completed backup. Check its manifest, every file size/checksum, and the SQLite `PRAGMA integrity_check`. Do not use a `.partial-*` folder. The automated upgrade test exercises restoration from these exact backup files.
4. Move the current database and its `-wal`/`-shm` companions into your separate safety copy. Copy the selected snapshot database to the path in `DATABASE_URL`. Do not leave stale WAL/SHM files beside the restored database.
5. Move the current `uploads` directory into the safety copy, then copy `uploads` from **the same snapshot** into place. If that snapshot contains no uploads, create an empty uploads directory. Do not merge different snapshot generations.
6. Start the matching previous image with the original volume and environment. Check login, lists, recipes, trackers and uploaded images. Retain the newer data copy and all backups until the recovery is verified.

There is no automatic downgrade or automatic overwrite of user data. Beta users can restore their pre-beta snapshot before returning to the previous stable image.

### Existing meal plans

Issue #17 caused local-midnight dates east of UTC to be stored one day early. New plans now use local calendar dates. Old stored dates are deliberately not shifted in bulk: their original device timezone is unknown. Some affected old entries will appear one day earlier; move them to the intended day. Supplement date bounds, caffeine quick logging and PDF filename dates use local dates too.

### Release verification

The release workflow builds a unique candidate, pulls it by immutable digest and verifies fresh installation, direct upgrades from 0.9.10, 0.9.9 and 0.9.8-hotfix.2, restart, backup failures, restore and old-PWA/offline upgrades in Chromium and WebKit. Only the verified digest receives release tags. Manual workflow runs create candidates without changing `latest` or `beta`.

`latest` and `beta` stay separate. A real installed iOS PWA must additionally be checked before stable 1.0 is approved; desktop WebKit is not an installed-iPhone test.

## Deutsch

### Bestehende Installation aktualisieren

Vorhandenen `/app/data`-Mount, `DATABASE_URL`, `ORIGIN`, Port-Zuordnung, Admin-Konfiguration und VAPID-Schlüssel beibehalten. Groly 1.0 unterstützt `ORIGIN` weiterhin zur Laufzeit. Datenvolume und Browserspeicher nicht zurücksetzen. Pro Datenverzeichnis darf nur ein Groly-Container laufen.

Vor dem Update eine unabhängige Kopie des vollständigen Datenvolumes behalten. Groly vor einer Dateisystemkopie stoppen, damit Datenbank, gegebenenfalls WAL-/SHM-Dateien und Bilder zusammenpassen. Lokale automatische Sicherungen schützen nicht vor einem Ausfall des gesamten Datenträgers.

Beim ersten Start einer neuen Version mit bestehender Datenbank erstellt Groly eine geprüfte SQLite-Sicherung und kopiert die hochgeladenen Bilder nach `backups` neben der Datenbank. Der Ordnername enthält Zeitstempel, Zielversion und eine eindeutige Kennung. `manifest.json` enthält Versionen, Dateigrößen und SHA-256-Prüfsummen. Der Datenbankname bleibt gleich; bei einer Standardinstallation ist das `groly.db`.

Die SQLite-Backup-API berücksichtigt bestätigte WAL-Schreibvorgänge. Dateien und Verzeichnisse werden vor dem Fortsetzen auf den Datenträger geschrieben. Migrationen, Startanpassungen, Bereinigung und normale Anfragen warten auf die geprüfte Sicherung. Normale Neustarts erzeugen keine zusätzlichen Kopien. Ein abgebrochener Start verwendet die geprüfte ursprüngliche Sicherung erneut; nach einer Wiederherstellung auf einen älteren Stand wird beim nächsten Upgrade eine neue Sicherung erstellt.

Pro aufbewahrter Sicherung Platz für Datenbank, alle Bilder und mindestens 16 MiB zusätzlichen Spielraum einplanen, zusätzlich zum normalen Datenwachstum. Sicherungen und unvollständige `.partial-*`-Ordner werden niemals automatisch gelöscht. Alte Kopien erst selbst entfernen, nachdem eine unabhängige geprüfte Sicherung vorhanden ist.

### Gesperrter Start

`GET /api/health` meldet 503 während der Initialisierung oder nach einem Fehler und erst bei Bereitschaft 200. Die Ursache steht im Container-Log. Speicher freigeben beziehungsweise Eigentümer und Schreibrechte korrigieren, anschließend neu starten. Die ursprüngliche Datenbank nicht löschen, um die Sperre zu umgehen. Versteckte `.upgrade-*.json`-Marker nicht selbst bearbeiten.

Image und Compose-Beispiel gewähren zehn Minuten Anlaufzeit für den Healthcheck. Bei sehr großen Bildsammlungen kann ein längerer Zeitraum in der eigenen Container-Konfiguration nötig sein. Ein fehlgeschlagener Healthcheck allein löscht keine Daten und legt kein neues Volume an.

### Vorherige Version wiederherstellen

1. Groly und alle anderen Zugriffe auf das Datenverzeichnis stoppen. Vorherigen Image-Tag oder Digest notieren.
2. Zuerst das **aktuelle vollständige Datenverzeichnis** einschließlich WAL-/SHM-Dateien separat sichern. Änderungen nach dem gewählten Sicherungszeitpunkt fehlen im älteren Stand; die aktuelle Kopie für eine spätere Rettung behalten.
3. Eine abgeschlossene Sicherung auswählen. Manifest, sämtliche Dateigrößen/Prüfsummen und `PRAGMA integrity_check` prüfen. Keine `.partial-*`-Ordner verwenden.
4. Aktuelle Datenbank und ihre `-wal`-/`-shm`-Dateien in die separate Sicherheitskopie verschieben. Sicherungsdatenbank an den mit `DATABASE_URL` festgelegten Ort kopieren. Keine alten WAL-/SHM-Dateien neben der wiederhergestellten Datenbank belassen.
5. Aktuellen Upload-Ordner in die Sicherheitskopie verschieben. Bilder aus **derselben Sicherung** nach `uploads` kopieren; ohne gesicherte Bilder einen leeren Ordner anlegen. Verschiedene Sicherungsstände nicht mischen.
6. Passendes vorheriges Image mit ursprünglichem Volume und unveränderten Umgebungsvariablen starten. Anmeldung, Listen, Rezepte, Tracker und Bilder prüfen. Neuere Datenkopie und Sicherungen bis zum erfolgreichen Abschluss behalten.

Es gibt kein automatisches Downgrade und kein automatisches Überschreiben von Nutzerdaten. Vor der Rückkehr von Beta zu vorherigem Stable kann die Vor-Beta-Sicherung wiederhergestellt werden.

### Ältere Essenspläne

Durch Issue #17 wurden Kalendertage östlich von UTC teilweise einen Tag zu früh gespeichert. Neue Pläne verwenden den lokalen Tag. Vorhandene gespeicherte Daten werden nicht pauschal verschoben, weil die damalige Gerätezeitzone unbekannt ist. Betroffene alte Einträge können einen Tag früher erscheinen und müssen auf den gewünschten Tag verschoben werden. Datumsauswahl für Supplements, Koffein-Schnellerfassung und PDF-Dateinamen verwenden ebenfalls lokale Tage.

### Freigabe

Der Workflow prüft das gebaute Image anhand seines unveränderlichen Digests, einschließlich Neuinstallation, direkten Upgrades, Sicherungsfehlern, Neustart, Wiederherstellung und PWA-/Offline-Wechsel in Chromium und WebKit. Erst danach werden Versions- und Kanal-Tags vergeben. Manuelle Workflow-Läufe verändern weder `latest` noch `beta`. Vor Stable 1.0 ist zusätzlich die Prüfung einer tatsächlich installierten iOS-PWA erforderlich.
