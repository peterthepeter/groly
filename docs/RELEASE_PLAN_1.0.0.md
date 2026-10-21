# Groly 1.0.0 – Release- und Upgrade-Plan

Stand: 21. Oktober 2026. Vorbereitung lokal auf `codex/groly-1.0`.
**Version und Changelogs bestätigt; App-PDF-Punkt auf Nutzerwunsch entfernt.**
Screenshots und Favoritenbearbeitung sind ebenfalls bestätigt. Kein erneuter
lokaler Upgrade-Lauf wegen der Favoritenänderung: bestehende Ergebnisse verwenden.

## Umfang

Stable **1.0.0** fasst alle Änderungen seit **0.9.10** zusammen: die komplette
Beta-Reihe einschließlich der zurückgezogenen ersten Beta, die veröffentlichte
**1.0.0-beta.8** und den vollständigen noch unveröffentlichten lokalen Diff.

Zusätzliche lokale Änderungen gehören vollständig dazu:

- Listensortierung A→Z, Z→A, zuletzt geändert und manuell. Bisheriges Sortier-Icon
  ohne Hintergrund, einheitliche Zeilen beim Verschieben, gespeicherte manuelle
  Reihenfolge und konsistente Änderungszeitpunkte.
- Optionale Einkaufslistenansicht mit gemeinsamer Fläche, Trennlinien,
  Kategorie-Icons, Mengen rechts und umbrechenden Namen. Erledigte Artikel
  verwenden dieselben Zeilen in ihrer einklappbaren Gruppe.
- Favoriten folgen der gewählten Kachel-/Listenansicht. Vorhandene Artikel und
  erfolgreiches Hinzufügen bleiben erkennbar. Entfernen verlangt eine klare
  Bestätigung mit Abbrechen und Entfernen nebeneinander.
- Deutsche und englische Beschriftungen sowie Bedienungsanleitung.
- Langer 1.0-Changelog mit eigenem Einleitungsabsatz, scrollbar und mit jederzeit
  erreichbarer Bestätigung.

Diese lokalen Änderungen brauchen keine zusätzliche Migration. Gegenüber
0.9.10 kommt nur Migration 0050 (`user_invites.token_value`) hinzu.

## Bilder und Icons

- README verwendet das vorhandene schwarze SVG, das Unraid-Template das schwarze PNG.
- Alle **23** bestehenden Screenshot-Dateien ersetzen, einschließlich der neun
  eingeklappten Motive. README-Anordnung beibehalten.
- Englisch, dunkles Theme, einheitlich 420 × 912 CSS-Pixel, ausschließlich Demodaten.
- **Korrektur vom Nutzer: Einkaufsliste und Einkaufsfavoriten in der
  Standardansicht mit Kacheln aufnehmen. Die optionale Listenansicht nicht für
  diese Standardmotive aktivieren.**
- Erst den endgültigen lokalen Funktionsstand aufnehmen. Bilder vor Freigabe
  vollständig zeigen: [Galerie aller 23 Motive](screenshots/index.html), jedes
  Motiv einzeln vergrößerbar. **Alle 23 Screenshots sind vom Nutzer freigegeben.** Dies ersetzt keine
  Freigabe der Changelogs oder Veröffentlichung.

## Changelogs und Freigabe

Vorgesehener Auftakt:

> Groly 1.0 ist da! Nach vielen Ideen, Umbauten und Tests.

> Groly 1.0 is here! After many ideas, redesigns, and tests.

App Deutsch/Englisch: Änderungen bündeln, alle Beta-Einträge durch einen Stable-
Eintrag ersetzen. Entwurf: [App-Texte](releases/1.0.0-app-draft.json).
Technische GitHub-Notizen ausschließlich Englisch:
[1.0.0.md](releases/1.0.0.md). Image-Verkleinerung am endgültigen lokalen
Kandidaten messen; historische Werte nicht ungeprüft übernehmen.

Version und beide vollständigen Changelogs dem Nutzer vor Release-Commit,
Push, Tag und GitHub-Release zur ausdrücklichen Bestätigung zeigen. Der Modus
**full ist bereits gewählt** und wird nicht erneut abgefragt. Version/Lockfile und Live-Changelog sind nach der Textfreigabe auf 1.0.0
umgestellt; die Beta-Einträge sind durch den bestätigten Stable-Eintrag ersetzt.

## Vereinbarte Vollprüfung

Bestehende Prüfungen verwenden, passende Ergebnisse wiederverwenden und keine
zusätzliche umfangreiche UI-Testsuite aufbauen.

- `latest` vor Veröffentlichung mit unveränderlichem Digest festhalten.
- Direkte Upgrades aus eingefrorenem `latest`, 0.9.10, 0.9.9,
  0.9.8-hotfix.2, Beta 5 und Beta 8 prüfen.
- Gefüllte Ernährungsdaten und Beziehungen einschließen. Tabellen, Zuordnungen,
  Einstellungen, Passwort-Hashes, Sitzungen und Bildprüfsummen vergleichen;
  SQLite-Integrität und Fremdschlüssel sowie bestehende Einladungslinks prüfen.
- Sicherung vor Änderungen, Neustart ohne doppelte Sicherung, Wiederherstellung
  mit Originalimage und sichere Sperre bei Platz-/Schreibrechtsfehlern prüfen.
- Neuinstallation, Unraid-typische Rechte, Runtime-Inhalt, Abhängigkeiten und
  Image-Sicherheit kontrollieren. Installationskopie isoliert prüfen; die
  Originalinstallation weder im Test starten noch verändern.
- Bestehende Chromium-/WebKit-Prüfungen für PWA-Wechsel, bestehende Sitzung und
  ausstehende Offline-Änderungen nutzen. Bestätigten iPhone-PWA-Test übernehmen.
- Die früheren 384 Tests gelten nicht pauschal für spätere UI-Änderungen.
  Ansichtswechsel, lange Namen, Hinzufügen, Abbrechen und bestätigtes Entfernen
  gezielt am neuen Stand prüfen. Gestoppte/fehlgeschlagene Läufe nicht als
  bestanden zählen. Ergebnisse und geprüfte Digests separat dokumentieren.

## Noch vor dem finalen Kandidaten

- Favoritenbearbeitung nach ausdrücklichem Go umgesetzt: Langdruck öffnet den
  vorhandenen Editor für Name, Menge und Kategorie. Abbrechen/Speichern und
  separates Entfernen mit Rückfrage; Änderungen gelten nur für die Vorlage.
  Umbenennen funktioniert offline ohne zusätzliche Migration. Beide Entwürfe
  und die Anleitung sind ergänzt.
- **Nutzer-Funktionstest bestätigt: „Edit geht.“** Keine weiteren Tests für
  diese Änderung starten. Mit Screenshots und Changelogs im Release-Plan
  fortfahren. Der neue lokale AMD64-Release-Kandidat enthält die Favoritenbearbeitung.
  Frühere Prüfergebnisse bleiben den damals geprüften Images zugeordnet. Textfreigabe liegt vor. Vorhandene Upgrade-Ergebnisse wiederverwenden.

## Erst nach Freigabe

1. Version und beide Root-Lockfile-Felder auf 1.0.0 setzen, Beta-App-Einträge
   durch den bestätigten Stable-Eintrag ersetzen, `.github/release.json` auf full.
2. Alle lokalen Änderungen, Icons, Screenshots und bestätigten Texte übernehmen.
   Upgrade-/Restore-Anleitung mit tatsächlichen Ergebnissen abgleichen.
3. Finalen Stand auf main übernehmen; Dateien explizit auswählen, AGENTS.md
   nicht committen. Branch pushen, v1.0.0 taggen und Tag separat pushen.
4. Verpflichtenden GitHub-Release ohne `--prerelease` mit vollständigen englischen
   Notizen erstellen. Bestehenden Docker-Workflow unverändert verwenden.
5. Erst nach bestandener Prüfung den geprüften Digest als `:1.0.0` und `:latest`
   veröffentlichen. `:beta` unverändert lassen.
6. Workflow, Digests, Release-Texte, sämtliche README-Bilder und Unraid-Icon prüfen.
