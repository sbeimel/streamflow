# Test Incomplete Stats Feature

## ✅ IMPLEMENTIERT

Ein neuer Button "Test Incomplete Stats" wurde hinzugefügt, der Streams mit unvollständigen Quality Stats testet.

## Problem

Manche Streams haben zwar `stream_stats`, aber diese sind unvollständig:
- Nur `bitrate` vorhanden, aber `codec` und `resolution` fehlen
- FFmpeg-Analyse wurde unterbrochen
- Nur teilweise Daten wurden erfasst

Der bestehende Button "Test Streams Without Stats" testet nur Streams OHNE jegliche Stats (`stream_stats` ist null/leer).

## Lösung: "Test Incomplete Stats" Button

### Was wird als "incomplete" erkannt?

Ein Stream hat incomplete stats, wenn `stream_stats` existiert, aber eines dieser Felder fehlt oder ungültig ist:

1. **Resolution**: fehlt, ist `N/A`, `0x0`, leer oder `Unknown`
2. **Video Codec**: fehlt, ist `N/A`, leer oder `Unknown`
3. **Audio Codec**: fehlt, ist `N/A`, leer oder `Unknown`
4. **Bitrate**: fehlt, ist `0` oder leer

### Beispiel für incomplete stats:

```json
{
  "stream_stats": {
    "ffmpeg_output_bitrate": 5000,  // ✓ Vorhanden
    "resolution": "N/A",             // ✗ Ungültig
    "video_codec": "N/A",            // ✗ Ungültig
    "audio_codec": "N/A",            // ✗ Ungültig
    "source_fps": null               // ✗ Fehlt
  }
}
```

## Implementierung

### Backend

**Endpoint**: `POST /api/stream-checker/test-incomplete-stats`

**Datei**: `backend/web_api.py` (Zeile 3337-3500)

**Funktionsweise**:
1. Durchsucht alle Channels und deren Streams
2. Überspringt Quality-Excluded Streams
3. Überspringt Streams ohne Stats (werden von "Test Without Stats" behandelt)
4. Prüft ob Stats unvollständig sind
5. Queued betroffene Channels mit `force_check=True` und Priorität 20

**Response**:
```json
{
  "message": "Queued 45 stream(s) with incomplete stats for testing",
  "streams_found": 45,
  "channels_affected": 12,
  "status": "queued",
  "description": "Testing streams from 12 channel(s)"
}
```

### Frontend

**API-Funktion**: `frontend/src/services/api.js`
```javascript
testIncompleteStats: () => api.post('/stream-checker/test-incomplete-stats')
```

**Button-Locations**:
1. **Stream Checker Seite** (`frontend/src/pages/StreamChecker.jsx`)
   - Zwischen "Test Streams Without Stats" und "Re-Score & Re-Sort"
   - Icon: TestTube
   - Variant: outline

2. **Dashboard** (`frontend/src/pages/Dashboard.jsx`)
   - Zwischen "Test Streams Without Stats" und "Re-Score & Re-Sort"
   - Icon: TestTube
   - Variant: outline

## Unterschied zu "Test Streams Without Stats"

| Feature | Test Without Stats | Test Incomplete Stats |
|---------|-------------------|----------------------|
| **Ziel** | Streams ohne jegliche Stats | Streams mit unvollständigen Stats |
| **Bedingung** | `stream_stats` ist null/leer | `stream_stats` existiert, aber Felder fehlen |
| **Use Case** | Neue Streams, nie getestet | Unterbrochene/fehlerhafte Analysen |
| **Beispiel** | `stream_stats: null` | `stream_stats: {bitrate: 5000, codec: "N/A"}` |

## Verwendung

1. **Container neu bauen** (falls nötig):
   ```bash
   docker-compose build
   docker-compose up -d
   ```

2. **Button klicken**:
   - Gehe zu "Stream Checker" oder "Dashboard"
   - Klicke auf "Test Incomplete Stats"
   - System findet alle Streams mit unvollständigen Stats
   - Channels werden mit hoher Priorität (20) zur Queue hinzugefügt
   - Quality Check startet automatisch

3. **Ergebnis prüfen**:
   - Toast-Nachricht zeigt Anzahl gefundener Streams
   - Logs zeigen Details: `docker-compose logs -f backend`
   - Stream Checker Progress zeigt Fortschritt

## Vorteile

✅ Findet Streams mit partiellen Daten
✅ Vervollständigt unterbrochene Analysen
✅ Verbessert Datenqualität
✅ Separate Funktion von "Test Without Stats"
✅ Hohe Priorität (20) für schnelle Verarbeitung
✅ Überspringt Quality-Excluded Streams

## Testing

1. Erstelle einen Stream mit incomplete stats:
   - Manuell in Dispatcharr: `stream_stats: {"bitrate": 5000}`
   - Oder unterbreche FFmpeg-Analyse

2. Klicke "Test Incomplete Stats"

3. Prüfe Logs:
   ```bash
   docker-compose logs -f backend | grep "incomplete"
   ```

4. Erwartetes Ergebnis:
   - Stream wird gefunden
   - Channel wird zur Queue hinzugefügt
   - Quality Check läuft
   - Stats werden vervollständigt

## Status

✅ **Backend-Endpoint implementiert**
✅ **Frontend-API-Funktion hinzugefügt**
✅ **Button in Stream Checker Seite**
✅ **Button in Dashboard**
✅ **Keine Syntax-Fehler**
✅ **Bereit zum Testen**
