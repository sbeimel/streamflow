# StreamFlow Enhancements - Implementierungsanleitung (Deutsch)

**Version:** 1.0  
**Datum:** 14. Januar 2026  
**Zielgruppe:** Entwicklerteam

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Voraussetzungen](#voraussetzungen)
3. [Installation](#installation)
4. [Patch-Anwendung](#patch-anwendung)
5. [Manuelle Integration](#manuelle-integration)
6. [Konfiguration](#konfiguration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Übersicht

Diese Anleitung beschreibt die Integration von zwei neuen Features in StreamFlow:

1. **Provider-Diversifikation**: Intelligente Verteilung von Streams verschiedener Provider für bessere Redundanz
2. **Fallback-Score Fix**: Korrektur der Score-Berechnung für Streams ohne Bitrate

---

## Voraussetzungen

### System-Anforderungen

- StreamFlow v1.0 oder höher
- Python 3.8+
- Node.js 16+
- React 18+
- Git (für Patch-Anwendung)

### Benötigte Dateien

```
git_pulls/
├── patches/
│   ├── 00_complete_enhancements.patch    # Alle Änderungen
│   ├── 01_provider_diversification.patch # Nur Provider-Diversifikation
│   └── 02_fallback_score_fix.patch       # Nur Fallback-Score Fix
├── CHANGELOG_DE.md                        # Änderungsprotokoll
└── IMPLEMENTATION_GUIDE_DE.md             # Diese Datei
```

---

## Installation

### Option 1: Kompletter Patch (Empfohlen)

Wendet alle Änderungen auf einmal an:

```bash
# 1. Backup erstellen
cp backend/stream_checker_service.py backend/stream_checker_service.py.backup
cp frontend/src/pages/StreamChecker.jsx frontend/src/pages/StreamChecker.jsx.backup

# 2. Patch anwenden
cd /path/to/streamflow
git apply git_pulls/patches/00_complete_enhancements.patch

# 3. Prüfen
git diff
```

### Option 2: Einzelne Patches

Wendet Features einzeln an:

```bash
# Nur Fallback-Score Fix
git apply git_pulls/patches/02_fallback_score_fix.patch

# Nur Provider-Diversifikation
git apply git_pulls/patches/01_provider_diversification.patch
```

### Option 3: Manuelle Integration

Siehe Abschnitt [Manuelle Integration](#manuelle-integration)

---

## Patch-Anwendung

### Schritt 1: Vorbereitung

```bash
# Repository-Status prüfen
git status

# Sicherstellen, dass keine uncommitted changes vorhanden sind
git stash

# Backup erstellen
git branch backup-before-enhancements
```

### Schritt 2: Patch anwenden

```bash
# Trockenlauf (prüft ob Patch anwendbar ist)
git apply --check git_pulls/patches/00_complete_enhancements.patch

# Patch anwenden
git apply git_pulls/patches/00_complete_enhancements.patch

# Oder mit mehr Kontext bei Konflikten
git apply --3way git_pulls/patches/00_complete_enhancements.patch
```

### Schritt 3: Verifizierung

```bash
# Änderungen prüfen
git diff

# Geänderte Dateien anzeigen
git status

# Syntax-Prüfung Backend
cd backend
python -m py_compile stream_checker_service.py

# Syntax-Prüfung Frontend
cd frontend
npm run lint
```

### Schritt 4: Commit

```bash
git add backend/stream_checker_service.py
git add frontend/src/pages/StreamChecker.jsx
git commit -m "feat: Add provider diversification and fallback score fix

- Add provider diversification for better redundancy
- Fix fallback score normalization (40.0 → 0.40)
- Add Stream Ordering UI tab
- Update documentation"
```

---

## Manuelle Integration

Falls die Patches nicht automatisch anwendbar sind:

### Backend-Änderungen

**Datei:** `backend/stream_checker_service.py`

#### 1. Konfiguration hinzufügen (Zeile ~143)

```python
'stream_ordering': {
    'provider_diversification': False,
    'diversification_mode': 'round_robin'
}
```

**Suchen nach:**
```python
'account_stream_limits': {
    'enabled': True,
    'global_limit': 0,
    'account_limits': {}
}
```

**Einfügen nach:**
```python
'account_stream_limits': {
    'enabled': True,
    'global_limit': 0,
    'account_limits': {}
},
'stream_ordering': {
    'provider_diversification': False,
    'diversification_mode': 'round_robin'
}
```

#### 2. Fallback-Score Fix (Zeile ~2731)

**Suchen nach:**
```python
return 40.0  # Medium score
```

**Ersetzen durch:**
```python
return 0.40  # Medium score
```

#### 3. Neue Methode hinzufügen (nach Zeile ~3514)

Fügen Sie die komplette Methode `_apply_provider_diversification()` ein.
Siehe `git_pulls/patches/01_provider_diversification.patch` für den vollständigen Code.

#### 4. Integration in `_check_channel_concurrent()` (Zeile ~2030)

**Suchen nach:**
```python
# Sort by score (highest first)
analyzed_streams.sort(key=lambda x: x.get('score', 0), reverse=True)

# Remove dead streams from the channel
```

**Einfügen zwischen:**
```python
# Sort by score (highest first)
analyzed_streams.sort(key=lambda x: x.get('score', 0), reverse=True)

# Apply provider diversification if enabled
if self.config.get('stream_ordering', {}).get('provider_diversification', False):
    analyzed_streams = self._apply_provider_diversification(analyzed_streams, channel_id)

# Remove dead streams from the channel
```

#### 5. Integration in `_check_channel_sequential()` (Zeile ~2512)

Gleiche Änderung wie in Schritt 4.

#### 6. Integration in `apply_account_limits_to_existing_channels()` (Zeile ~3665)

Gleiche Änderung wie in Schritt 4.

### Frontend-Änderungen

**Datei:** `frontend/src/pages/StreamChecker.jsx`

#### 1. Icon-Import hinzufügen (Zeile ~27)

**Suchen nach:**
```javascript
import {
  ...
  List
} from 'lucide-react'
```

**Ersetzen durch:**
```javascript
import {
  ...
  List,
  Info
} from 'lucide-react'
```

#### 2. TabsList Grid anpassen (Zeile ~554)

**Suchen nach:**
```javascript
<TabsList className="grid w-full grid-cols-5">
```

**Ersetzen durch:**
```javascript
<TabsList className="grid w-full grid-cols-6">
```

#### 3. Tab-Trigger hinzufügen (Zeile ~559)

**Suchen nach:**
```javascript
<TabsTrigger value="account-limits">Account Limits</TabsTrigger>
<TabsTrigger value="dead-streams">Dead Streams</TabsTrigger>
```

**Ersetzen durch:**
```javascript
<TabsTrigger value="account-limits">Account Limits</TabsTrigger>
<TabsTrigger value="stream-ordering">Stream Ordering</TabsTrigger>
<TabsTrigger value="dead-streams">Dead Streams</TabsTrigger>
```

#### 4. Tab-Content hinzufügen (nach Zeile ~983)

Fügen Sie den kompletten `<TabsContent value="stream-ordering">` Block ein.
Siehe `git_pulls/patches/01_provider_diversification.patch` für den vollständigen Code.

---

## Konfiguration

### Backend-Konfiguration

**Datei:** `stream_checker_config.json`

```json
{
  "stream_ordering": {
    "provider_diversification": false,
    "diversification_mode": "round_robin"
  }
}
```

### UI-Konfiguration

1. StreamFlow öffnen
2. Zu "Stream Checker" navigieren
3. Tab "Stream Ordering" öffnen
4. "Enable Provider Diversification" aktivieren
5. Konfiguration speichern

---

## Testing

### Unit-Tests

```bash
# Backend-Tests
cd backend
python -m pytest tests/test_stream_checker_service.py -v

# Frontend-Tests
cd frontend
npm test
```

### Manuelle Tests

#### Test 1: Fallback-Score Fix

```bash
# 1. Stream ohne Bitrate erstellen
# 2. Quality Check durchführen
# 3. Prüfen: Score sollte 0.40 sein (nicht 40.0)
# 4. Sortierung prüfen: Sollte nicht an erster Stelle sein
```

#### Test 2: Provider-Diversifikation

```bash
# 1. Kanal mit Streams von 3 verschiedenen Providern erstellen
# 2. Provider-Diversifikation aktivieren
# 3. Quality Check durchführen
# 4. Stream-Reihenfolge prüfen:
#    - Sollte Provider abwechseln (A, B, C, A, B, C...)
#    - Nicht alle A-Streams zuerst
```

#### Test 3: Apply Account Limits

```bash
# 1. Account-Limits konfigurieren
# 2. Provider-Diversifikation aktivieren
# 3. "Apply Account Limits" Button drücken
# 4. Prüfen: Provider-Diversifikation sollte angewendet werden
```

### Integration-Tests

```bash
# Kompletter Workflow-Test
1. M3U-Playlists aktualisieren
2. Streams matchen
3. Quality Check durchführen (mit Provider-Diversifikation)
4. Account-Limits anwenden
5. Ergebnis prüfen
```

---

## Troubleshooting

### Problem: Patch lässt sich nicht anwenden

**Fehler:**
```
error: patch failed: backend/stream_checker_service.py:2730
error: backend/stream_checker_service.py: patch does not apply
```

**Lösung:**
1. Prüfen Sie die StreamFlow-Version
2. Verwenden Sie `git apply --3way` für automatisches Merging
3. Oder: Manuelle Integration (siehe oben)

### Problem: Syntax-Fehler nach Patch

**Fehler:**
```
SyntaxError: invalid syntax
```

**Lösung:**
1. Prüfen Sie die Einrückung (Python ist einrückungssensitiv)
2. Vergleichen Sie mit Original-Patch
3. Führen Sie `python -m py_compile` aus

### Problem: Frontend baut nicht

**Fehler:**
```
Module not found: Can't resolve 'lucide-react'
```

**Lösung:**
```bash
cd frontend
npm install lucide-react
npm run build
```

### Problem: Provider-Diversifikation funktioniert nicht

**Symptome:**
- Streams werden nicht abwechselnd sortiert
- Alle Streams von einem Provider zuerst

**Lösung:**
1. Prüfen Sie die Konfiguration: `provider_diversification: true`
2. Prüfen Sie die Logs: `Channel X: Applied provider diversification`
3. Prüfen Sie ob mindestens 2 Provider vorhanden sind
4. Prüfen Sie ob Quality Check aktiviert ist

### Problem: Fallback-Score immer noch 40.0

**Lösung:**
1. Prüfen Sie ob Patch korrekt angewendet wurde
2. Suchen Sie nach `return 40.0` in `stream_checker_service.py`
3. Sollte `return 0.40` sein
4. Service neu starten

---

## Kontakt & Support

Bei Fragen oder Problemen:

- **GitHub Issues:** Erstellen Sie ein Issue im Repository
- **Community Forum:** Posten Sie im StreamFlow-Forum
- **Email:** Kontaktieren Sie das Entwicklerteam

---

## Anhang

### Geänderte Dateien

```
backend/stream_checker_service.py
frontend/src/pages/StreamChecker.jsx
```

### Neue Konfigurationsoptionen

```json
{
  "stream_ordering": {
    "provider_diversification": false,
    "diversification_mode": "round_robin"
  }
}
```

### Neue Methoden

- `_apply_provider_diversification(analyzed_streams, channel_id)`

### Geänderte Methoden

- `_calculate_stream_score()` - Fallback-Score Fix
- `_check_channel_concurrent()` - Provider-Diversifikation Integration
- `_check_channel_sequential()` - Provider-Diversifikation Integration
- `apply_account_limits_to_existing_channels()` - Provider-Diversifikation Integration

---

**Ende der Implementierungsanleitung**
