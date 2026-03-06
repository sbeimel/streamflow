# FFmpeg Duration Debug Guide

## Problem

FFmpeg scheint immer den Fallback-Wert zu nutzen statt den konfigurierten Wert aus dem Frontend.

## Debug-Logs hinzugefügt

In `backend/stream_checker_service.py` (Zeile ~2093):
```python
analysis_params = self.config.get('stream_analysis', {})
logger.debug(f"analysis_params loaded: {analysis_params}")
logger.debug(f"ffmpeg_duration from config: {analysis_params.get('ffmpeg_duration', 'NOT_FOUND')}")
```

## Debug-Schritte

### 1. Container neu bauen mit Debug-Logs
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 2. Frontend-Config prüfen
1. Öffne Stream Checker Seite
2. Klicke "Edit Configuration"
3. Ändere "FFmpeg Duration" auf z.B. **8 Sekunden**
4. Klicke "Save Configuration"
5. Prüfe Browser Console auf Fehler

### 3. Backend-Logs prüfen
```bash
docker-compose logs -f backend | grep -E "analysis_params|ffmpeg_duration"
```

**Erwartete Ausgabe:**
```
analysis_params loaded: {'ffmpeg_duration': 8, 'timeout': 30, 'retries': 1, ...}
ffmpeg_duration from config: 8
```

**Wenn Fallback genutzt wird:**
```
analysis_params loaded: {}
ffmpeg_duration from config: NOT_FOUND
```

### 4. Config-Datei im Container prüfen
```bash
docker-compose exec backend cat /app/data/stream_checker_config.json
```

**Erwartete Struktur:**
```json
{
  "stream_analysis": {
    "ffmpeg_duration": 8,
    "timeout": 30,
    "retries": 1,
    "retry_delay": 10,
    "user_agent": "VLC/3.0.14",
    "stream_startup_buffer": 10
  },
  ...
}
```

### 5. Manuellen Check durchführen
1. Wähle einen Channel
2. Klicke "Check Now"
3. Prüfe Logs:
```bash
docker-compose logs -f backend | grep "Analyzing stream"
```

**Erwartete Ausgabe:**
```
▶ Analyzing stream: Channel Name (ID: 123)
⚡ Early exit after 3.5s (all data collected: ...)
```

## Mögliche Probleme

### Problem 1: Config wird nicht gespeichert
**Symptom:** `analysis_params loaded: {}`

**Lösung:**
- Prüfe ob `/app/data` Volume korrekt gemountet ist
- Prüfe Schreibrechte im Container
- Prüfe ob `stream_checker_config.json` existiert

### Problem 2: Config wird nicht geladen
**Symptom:** `ffmpeg_duration from config: NOT_FOUND`

**Lösung:**
- Prüfe ob `stream_analysis` Section in Config existiert
- Prüfe ob Config-Datei valides JSON ist
- Prüfe Logs auf Config-Load-Fehler

### Problem 3: Frontend sendet Config nicht
**Symptom:** Browser Console zeigt Fehler

**Lösung:**
- Prüfe Network Tab im Browser
- Prüfe ob PUT Request an `/api/stream-checker/config` erfolgreich ist
- Prüfe Response Body

### Problem 4: Deep Update überschreibt Werte
**Symptom:** Nur ein Wert wird gespeichert, Rest fehlt

**Lösung:**
- Frontend muss KOMPLETTE `stream_analysis` Section senden
- Nicht nur geänderte Werte

## Fallback-Hierarchie

1. **Gespeicherte Config** (`/app/data/stream_checker_config.json`)
   - Wenn vorhanden: Nutze Wert aus Datei
   
2. **DEFAULT_CONFIG** (im Code)
   - Wenn Config-Datei fehlt: Nutze `ffmpeg_duration: 30`
   
3. **Fallback in get()** 
   - Wenn `stream_analysis` fehlt: Nutze `{}`
   - Wenn `ffmpeg_duration` fehlt: Nutze `30`

## Erwartetes Verhalten

### Szenario 1: Frische Installation
- Config-Datei existiert nicht
- DEFAULT_CONFIG wird verwendet
- `ffmpeg_duration = 30` (aus DEFAULT_CONFIG)

### Szenario 2: Config gespeichert mit 8s
- Config-Datei existiert mit `ffmpeg_duration: 8`
- Gespeicherte Config wird geladen
- `ffmpeg_duration = 8` (aus Datei)

### Szenario 3: Config gespeichert ohne ffmpeg_duration
- Config-Datei existiert aber `stream_analysis` fehlt
- DEFAULT_CONFIG wird gemerged
- `ffmpeg_duration = 30` (aus DEFAULT_CONFIG)

## Nächste Schritte

1. Führe Debug-Schritte durch
2. Poste Logs hier
3. Wir analysieren das Problem weiter

## Status

🔍 **Debug-Logs hinzugefügt**
⏳ **Warte auf Test-Ergebnisse**
