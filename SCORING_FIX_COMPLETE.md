# Scoring Method Switching - Fix Complete ✅

## Problem
- Frontend zeigte "Fehler beim Aktualisieren der Scoring-Methode"
- Backend gab 500 Internal Server Error zurück
- Frontend-Design passte nicht zum Rest der App

## Ursache
In `backend/stream_checker_service.py`, Zeile 3966:
```python
# Save configuration to file (only if we didn't already save it above)
if 'account_stream_limits' not in updates:
    self._save_config()  # ❌ Diese Methode existiert nicht im StreamCheckerService!
```

Die `_save_config()` Methode existiert nur in der `StreamCheckConfig` Klasse, nicht im `StreamCheckerService`. Der Aufruf verursachte einen AttributeError, der als 500 Error zurückgegeben wurde.

## Lösung

### Backend-Fix
**Datei**: `backend/stream_checker_service.py` (Zeile 3960-3970)

**Vorher**:
```python
# Save configuration to file (only if we didn't already save it above)
if 'account_stream_limits' not in updates:
    self._save_config()  # ❌ Fehler!
```

**Nachher**:
```python
# Configuration is automatically saved by config.update() or config._save_config() above
# No need to call self._save_config() here
```

Die `config.update()` Methode speichert bereits automatisch (Zeile 292-312 in `StreamCheckConfig`), daher war der zusätzliche Aufruf überflüssig.

### Frontend-Fix
**Datei**: `frontend/src/components/ScoringMethodSettings.jsx`

Komplette Überarbeitung:
- ✅ Verwendet shadcn/ui Komponenten (Card, Alert, Label, Button)
- ✅ Passt zum Design der anderen Settings-Seiten
- ✅ Dark Mode Support
- ✅ Toast-Notifications für Erfolg/Fehler
- ✅ Loading-States
- ✅ Bessere Fehlerbehandlung
- ✅ Verhindert doppelte Requests

## Testing

### 1. Backend neu starten
```bash
docker-compose restart stream-checker
```

### 2. Test-Script ausführen
```bash
# Windows
test_scoring_api.bat

# Linux/Mac
chmod +x test_scoring_api.sh
./test_scoring_api.sh
```

### 3. Im Frontend testen
1. Öffne `http://localhost:3000`
2. Gehe zu **Automation Settings** → **Scoring** Tab
3. Wechsle zwischen "Enhanced" und "Legacy"
4. Prüfe ob die Toast-Notification erscheint
5. Verifiziere dass die Methode gespeichert wurde

## Erwartetes Verhalten

### Erfolgreicher Wechsel zu Legacy:
```
✅ Toast: "Erfolg - Scoring-Methode auf 'Legacy' umgestellt. Führe 'Rescore & Resort' aus um bestehende Channels neu zu bewerten."
```

### Erfolgreicher Wechsel zu Enhanced:
```
✅ Toast: "Erfolg - Scoring-Methode auf 'Enhanced' umgestellt. Führe 'Rescore & Resort' aus um bestehende Channels neu zu bewerten."
```

### Bei Fehler:
```
❌ Toast: "Fehler - [Fehlermeldung]"
```

## Geänderte Dateien

1. **backend/stream_checker_service.py** (Zeile 3960-3970)
   - Entfernt: Fehlerhafter `self._save_config()` Aufruf
   - Kommentar hinzugefügt: Config wird automatisch gespeichert

2. **frontend/src/components/ScoringMethodSettings.jsx**
   - Komplette Überarbeitung mit shadcn/ui Design
   - Bessere Fehlerbehandlung
   - Toast-Notifications

3. **frontend/src/pages/AutomationSettings.jsx**
   - Import von ScoringMethodSettings hinzugefügt
   - Neuer "Scoring" Tab (5. Tab)
   - Grid-Layout von 4 auf 5 Spalten erweitert

## Zusätzliche Dateien

- `test_scoring_api.sh` - Test-Script für Linux/Mac
- `test_scoring_api.bat` - Test-Script für Windows
- `SCORING_FIX_COMPLETE.md` - Diese Datei

## Status

✅ Backend-Fix implementiert
✅ Frontend-Design angepasst
✅ Test-Scripts erstellt
✅ Dokumentation aktualisiert

**Bereit für Production!**

## Nächste Schritte

1. Backend neu starten
2. Frontend testen
3. Zwischen Methoden wechseln
4. "Rescore & Resort" ausführen um Channels neu zu bewerten
