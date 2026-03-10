# Rescore & Resort - Troubleshooting Guide

## Problem
"Rescore & Resort" Button reagiert nicht oder zeigt keine sichtbare Änderung.

---

## Mögliche Ursachen

### 1. ✅ Stream Checker Service läuft nicht
**Symptom**: Button klickbar, aber keine Aktion

**Prüfen**:
```bash
# Backend-Logs prüfen
docker logs streamflow-stream-checker

# Suche nach:
# "Stream checker service is not running"
```

**Lösung**:
```bash
# Service neu starten
docker-compose restart stream-checker

# Oder in Automation Settings:
# - Mindestens eine Automation aktivieren
# - "Save Settings" klicken
```

**Warum**: Der Rescore-Endpunkt prüft `if not service.running` (Zeile 3202 in web_api.py)

---

### 2. ⚠️ Keine Streams haben stream_stats
**Symptom**: Button funktioniert, aber "0 channels processed"

**Prüfen**:
```bash
# API-Call testen
curl -X POST http://localhost:5000/api/stream-checker/rescore-resort

# Response prüfen:
# "channels_processed": 0  ← Problem!
```

**Ursache**: Rescore verwendet **bestehende** stream_stats, führt keine neuen Quality-Checks durch.

**Lösung**:
1. Zuerst "Check All Channels" ausführen (erstellt stream_stats)
2. Dann "Rescore & Resort" verwenden

**Warum**: Zeile 4089-4095 in stream_checker_service.py:
```python
stream_stats = full_stream.get('stream_stats')
if stream_stats is None:
    stream_stats = {}
```

---

### 3. ⚠️ Scoring-Methode wurde nicht gespeichert
**Symptom**: Rescore läuft, aber Scores ändern sich nicht

**Prüfen**:
```bash
# Config prüfen
curl http://localhost:5000/api/stream-checker/config | jq '.scoring'

# Sollte zeigen:
# {
#   "method": "enhanced",  ← oder "legacy"
#   "weights": { ... }
# }
```

**Lösung**:
1. Backend neu starten: `docker-compose restart stream-checker`
2. Scoring-Methode erneut wählen
3. "Rescore & Resort" ausführen

---

### 4. ⚠️ Browser-Cache
**Symptom**: Button reagiert nicht, keine Console-Errors

**Lösung**:
```
1. Browser-Console öffnen (F12)
2. Network-Tab öffnen
3. "Rescore & Resort" klicken
4. Prüfen ob POST-Request zu /api/stream-checker/rescore-resort erscheint
```

**Falls kein Request**:
- Hard-Reload: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
- Browser-Cache leeren

**Falls Request mit Error**:
- Response-Body prüfen
- Backend-Logs prüfen

---

### 5. ⚠️ Channels haben keine Streams
**Symptom**: "0 channels processed"

**Prüfen**:
```bash
# Channels mit Streams prüfen
curl http://localhost:9191/api/channels | jq '.[] | select(.streams | length > 0) | {id, name, stream_count: (.streams | length)}'
```

**Lösung**:
1. M3U-Playlists aktualisieren
2. Streams zu Channels matchen
3. Dann "Rescore & Resort"

---

## Debugging-Schritte

### Schritt 1: Backend-Logs prüfen
```bash
docker logs -f streamflow-stream-checker | grep -i "rescore"
```

**Erwartete Ausgabe bei Erfolg**:
```
INFO: ================================================================================
INFO: RE-SCORE & RE-SORT ALL CHANNELS (using existing stats)
INFO: ================================================================================
INFO: Processing channel: Channel Name (ID: 123)
INFO: Re-scored 10 channel(s) in 2.5s
```

**Bei Fehler**:
```
WARNING: Cannot re-score channels - service is not running
# → Service starten

WARNING: No channels found
# → Channels erstellen/importieren

DEBUG: Channel XYZ has no streams, skipping
# → Streams zu Channels matchen
```

---

### Schritt 2: API direkt testen
```bash
# Test-Request
curl -X POST http://localhost:5000/api/stream-checker/rescore-resort \
  -H "Content-Type: application/json" \
  | jq '.'
```

**Erfolgreiche Response**:
```json
{
  "message": "Re-score and re-sort completed successfully",
  "status": "completed",
  "stats": {
    "channels_processed": 10,
    "channels_updated": 8,
    "streams_before": 150,
    "streams_after": 145,
    "streams_removed": 5,
    "duration_seconds": 2.5
  }
}
```

**Fehler-Response**:
```json
{
  "error": "Stream checker service is not running"
}
```

---

### Schritt 3: Frontend-Console prüfen
```javascript
// Browser-Console (F12)
// Sollte zeigen:
POST http://localhost:5000/api/stream-checker/rescore-resort 200 OK

// Bei Fehler:
POST http://localhost:5000/api/stream-checker/rescore-resort 400 Bad Request
// → Response-Body prüfen
```

---

## Häufige Szenarien

### Szenario 1: Frische Installation
**Problem**: Keine Streams haben stream_stats

**Lösung**:
1. M3U-Playlists hinzufügen
2. "Update All Playlists" ausführen
3. "Match All Streams" ausführen
4. "Check All Channels" ausführen (erstellt stream_stats)
5. Jetzt "Rescore & Resort" verwenden

---

### Szenario 2: Nach Scoring-Methode Wechsel
**Problem**: Scores ändern sich nicht

**Lösung**:
1. Backend neu starten (lädt neue Config)
2. "Rescore & Resort" ausführen
3. Channels prüfen

---

### Szenario 3: Nach Config-Änderung
**Problem**: Neue Limits/Priorities werden nicht angewendet

**Lösung**:
1. Config speichern
2. "Rescore & Resort" ausführen (wendet neue Config an)
3. Keine Quality-Checks nötig (verwendet bestehende Stats)

---

## Was macht Rescore & Resort?

### ✅ Was es MACHT:
1. Liest bestehende stream_stats aus UDI-Cache
2. Berechnet Scores neu basierend auf:
   - Aktueller Scoring-Methode (enhanced/legacy)
   - M3U-Prioritäten
   - Quality-Preferences
   - Account-Stream-Limits
   - Provider-Diversification
3. Sortiert Streams neu (beste zuerst)
4. Aktualisiert Channel-Stream-Zuordnungen

### ❌ Was es NICHT macht:
- Keine neuen FFmpeg-Analysen
- Keine Quality-Checks
- Keine M3U-Updates
- Keine Stream-Matching

### Wann verwenden?
- Nach Änderung der Scoring-Methode
- Nach Änderung von M3U-Prioritäten
- Nach Änderung von Account-Stream-Limits
- Nach Änderung von Quality-Preferences
- Nach Änderung von Provider-Diversification

### Wann NICHT verwenden?
- Wenn keine stream_stats vorhanden sind
  → Zuerst "Check All Channels" ausführen
- Wenn neue Streams hinzugefügt wurden
  → Zuerst "Check All Channels" ausführen

---

## Performance

**Typische Dauer**:
- 10 Channels: ~1-2 Sekunden
- 100 Channels: ~5-10 Sekunden
- 1000 Channels: ~30-60 Sekunden

**Warum so schnell?**
- Keine FFmpeg-Analysen
- Nur Score-Berechnung und Sortierung
- Verwendet gecachte Daten

**Vergleich**:
- "Check All Channels": 30-60 Sekunden pro Channel (FFmpeg)
- "Rescore & Resort": 0.1-0.5 Sekunden pro Channel (nur Berechnung)

---

## Zusammenfassung

### Checkliste vor Rescore & Resort:
- [ ] Stream Checker Service läuft
- [ ] Channels haben Streams
- [ ] Streams haben stream_stats (mindestens einmal gecheckt)
- [ ] Config-Änderungen gespeichert
- [ ] Backend neu gestartet (falls Config geändert)

### Wenn nichts passiert:
1. Backend-Logs prüfen
2. Browser-Console prüfen
3. API direkt testen
4. Service-Status prüfen

### Wenn "0 channels processed":
1. Zuerst "Check All Channels" ausführen
2. Dann "Rescore & Resort" verwenden

---

## Support

**Logs prüfen**:
```bash
# Alle Rescore-Logs
docker logs streamflow-stream-checker 2>&1 | grep -i "rescore"

# Letzte 100 Zeilen
docker logs --tail 100 streamflow-stream-checker

# Live-Logs
docker logs -f streamflow-stream-checker
```

**Config prüfen**:
```bash
# Scoring-Config
curl http://localhost:5000/api/stream-checker/config | jq '.scoring'

# Service-Status
curl http://localhost:5000/api/stream-checker/status | jq '.'
```

**Test-Request**:
```bash
# Rescore ausführen
curl -X POST http://localhost:5000/api/stream-checker/rescore-resort | jq '.'
```
