# FFmpeg Duration Fallback Fix ✅

## Problem

FFmpeg lief immer mit falscher Duration, weil der Fallback-Wert falsch war.

### Root Cause

Der Fallback-Wert in `stream_checker_service.py` war **20 Sekunden** statt **30 Sekunden**:

```python
# ❌ FALSCH
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 20)
```

**Folge:**
- Wenn `stream_analysis.ffmpeg_duration` nicht in der Config war, wurde 20s statt 30s verwendet
- Frontend zeigt 30s, aber Backend nutzt 20s
- Inkonsistenz zwischen Frontend und Backend

## Lösung

Fallback-Wert auf **30 Sekunden** korrigiert (konsistent mit Default-Config und Frontend):

### Geänderte Stellen (3x)

**1. No Profiles / Custom Streams:**
```python
# Vorher
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 20)

# Nachher
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 30)  # ✅ Konsistent
```

**2. Phase 1 - Available Profiles:**
```python
# Vorher
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 20)

# Nachher
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 30)  # ✅ Konsistent
```

**3. Phase 2 - Remaining Profiles:**
```python
# Vorher
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 20)

# Nachher
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 30)  # ✅ Konsistent
```

## Konsistenz-Check

### Default-Config (stream_checker_service.py, Zeile 107)
```python
'stream_analysis': {
    'ffmpeg_duration': 30,  # ✅ 30 Sekunden
    'timeout': 30,
    # ...
}
```

### Frontend (StreamChecker.jsx, Zeile 671)
```jsx
value={editedConfig?.stream_analysis?.ffmpeg_duration || 30}  // ✅ 30 Sekunden
```

### Backend Fallback (stream_checker_service.py)
```python
ffmpeg_duration=analysis_params.get('ffmpeg_duration', 30)  // ✅ 30 Sekunden
```

**Alle 3 Stellen sind jetzt konsistent: 30 Sekunden!**

## Vorteile

✅ **Konsistenz** zwischen Frontend, Backend und Default-Config
✅ **Korrekte Duration** wird verwendet wenn Config fehlt
✅ **Frontend-Einstellung** wird respektiert (5-120 Sekunden)
✅ **Keine Überraschungen** mehr bei fehlender Config

## Testing

1. Container neu bauen:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

2. Config prüfen:
   - Öffne Stream Checker Seite
   - Prüfe "FFmpeg Duration" Feld (sollte 30s zeigen)
   - Ändere auf z.B. 8s
   - Speichern

3. Logs prüfen:
   ```bash
   docker-compose logs -f backend | grep "duration"
   ```

4. Erwartetes Ergebnis:
   - FFmpeg läuft mit der eingestellten Duration (z.B. 8s)
   - Bei Early Exit: Stoppt früher (z.B. nach 3-4s)
   - Bei fehlender Config: Nutzt 30s Fallback

## Geänderte Dateien

- `backend/stream_checker_service.py`
  - 3x Fallback von 20 → 30 Sekunden korrigiert

## Status

✅ **Fallback-Wert korrigiert**
✅ **Konsistenz hergestellt**
✅ **Keine Syntax-Fehler**
✅ **Bereit zum Testen**
