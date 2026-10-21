# Releases: Changelogs und Prüfumfang

## Changelogs vor jedem Push

Für **jeden Docker-Release** (Beta/Stable, Normal/Vollständig) aus den tatsächlichen
Änderungen seit der jeweiligen Vorversion zwei getrennte Changelogs generieren
und dem Nutzer vor dem Push einmal zeigen. Den Nutzer nicht bitten, die Texte
selbst zu schreiben. Bereits genannte Wünsche übernehmen.

### Bestätigung abwarten

Vor Release-Commit, Push, Tag oder GitHub-Release die konkrete Version und die
**vollständigen** vorgesehenen Texte zeigen: App Deutsch + Englisch und GitHub
technisch ausschließlich Englisch. Die Vorschau muss den vorgesehenen Dateien
entsprechen; eine verkürzte Wiedergabe des GitHub-Changelogs reicht nicht.

Dann fragen: **„Sind Version und beide Changelogs so korrekt? Normaler Release
oder vollständige Release-Prüfung?“** Erst fortfahren, wenn der Nutzer die
Version/Changelogs ausdrücklich bestätigt und den Modus ausdrücklich gewählt oder
die Modusauswahl ausdrücklich delegiert hat. Bereits für diesen Release
beantwortete Fragen nicht wiederholen. Spätere inhaltliche Änderungen erneut zur
Bestätigung vorlegen.

„Git push“ allein ersetzt keine noch fehlende Entscheidung. Weder Kritik an
langen Tests noch der gespeicherte Konfigurationswert gilt als Moduswahl.

### Getrennte Texte

- **App:** kurz, knapp, informativ und nutzerorientiert, jeweils Deutsch und
  Englisch. In `src/lib/changelog.ts` speichern; wenige konkrete Stichpunkte,
  keine internen Implementierungs- oder Testberichte.
- **GitHub Release:** separater technischer Changelog, ausschließlich Englisch.
  Betroffene Komponenten, Fehlerursache und geändertes Verhalten knapp benennen;
  relevante Änderungen an Migrationen, Abhängigkeiten oder Release-Prozess
  aufnehmen. In `docs/releases/X.Y.Z.md` speichern, ohne die zweisprachigen
  App-Texte zu kopieren.

Bei Beta → Stable die Änderungen der gesamten Beta-Reihe zusammenfassen; beide
Changelogs müssen den Versionswechsel aus Sicht der bisherigen Stable abdecken.
Die GitHub-Notizen beim Erstellen des Release über eine Datei übergeben:

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --target <release-branch> --notes-file docs/releases/X.Y.Z.md
```

Bei einer Beta zusätzlich `--prerelease` verwenden. Der Modus ändert die
Changelog-Regeln nicht. Die Vorab-Anzeige gehört zur Release-Vorbereitung durch
den Agenten; GitHub Actions übernimmt anschließend Bauen und Veröffentlichen.

## Prüfumfang wählen

Vor einer Veröffentlichung den Nutzer fragen: **„Normaler Release oder vollständige Release-Prüfung?“**
Ist der Modus bereits ausdrücklich genannt, nicht erneut fragen. Die Größe der
Versionsnummer, Beta/Stable und der Prüfumfang sind unabhängige Entscheidungen.

Die Auswahl steht im Release-Commit in [`.github/release.json`](../.github/release.json):

| Auswahl | `verification` | GitHub-Workflow |
| --- | --- | --- |
| Normal / Mini-Release | `standard` | Version und Beta-/Stable-Tags prüfen, Produktionsimage bauen und veröffentlichen |
| Vollständige Release-Prüfung | `full` | Zusätzlich Typprüfung, Unit-/Release-/Abhängigkeitstests, Sicherheitsaudits, Docker-Neuinstallation, direkte Datenbank-Upgrades, Backup/Restore sowie Chromium-/WebKit-/Offline-Tests |

Der Produktionsbuild gehört immer dazu. Im normalen Modus werden die bereits in
der Entwicklung bestandenen Tests nicht pauschal erneut ausgeführt. Eine reine
Versions- oder Changelog-Änderung ist kein Anlass für zusätzliche Volltests.
Neue, noch ungeprüfte Codeänderungen gezielt während der Entwicklung prüfen.

Bei Migrationen oder größeren Änderungen an Datenhaltung, Anmeldung, Offline-Sync
oder Laufzeit den vollständigen Modus empfehlen und den Nutzer entscheiden lassen.
Umfangreiche lokale Docker-/Browser-Release-Prüfungen ebenfalls nur nach Auswahl
des vollständigen Modus oder ausdrücklicher Beauftragung starten. Bereits passende
Prüfergebnisse wiederverwenden; nicht dieselbe Suite ohne Anlass mehrfach starten.

Der gewählte Modus gilt für diesen Release. Vor dem nächsten Release erneut fragen
und die Datei entsprechend setzen; `standard` ist die Ausgangseinstellung.
Fehlende oder ungültige Einstellungen brechen den Workflow ab.

Manuelle GitHub-Läufe bieten dieselbe Auswahl als Eingabe an und veröffentlichen
weiterhin keine öffentlichen Docker-Tags. Veröffentlichungen starten wie bisher
durch einen GitHub Release (`release: published`), für Betas mit `--prerelease`.
Beta-Releases bleiben auf `codex/groly-1.0` und ändern ausschließlich `:beta` und
ihren Versionstag. Stable-Releases ändern ausschließlich `:latest` und ihren
Versionstag.
