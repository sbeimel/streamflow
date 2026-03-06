# Test Incomplete Stats - Account Limit Fix

## Problem
"Test Incomplete Stats" und "Test Without Stats" fanden keine Streams, weil sie nur **zugeordnete Streams** durchsuchten.

### Root Cause
Wenn **Account Limits** aktiv sind:
- Nur begrenzte Anzahl Streams pro Account werden Channels zugeordnet
- Nicht zugeordnete Streams haben `channel=null`
- `get_channel_streams()` gibt nur zugeordnete Streams zurück
- Unzugeordnete Streams wurden nie gefunden

## Implementierte Lösung

### Vorher (FALSCH):
```python
# Iteriere über Channels
for channel in channels:
    # Hole nur zugeordnete Streams
    streams = udi.get_channel_streams(channel_id)
    # Problem: Streams ohne Zuordnung werden nicht gefunden!
```

### Nachher (RICHTIG):
```python
# Hole ALLE Streams aus der Datenbank
all_streams = udi.get_streams(log_result=False)

# Iteriere über alle Streams
for stream in all_streams:
    channel_id = stream.get('channel')
    if not channel_id:
        # Stream ist nicht zugeordnet - überspringen
        streams_without_channel += 1
        continue
    # Prüfe Stats...
```

## Änderungen

### 1. Test Incomplete Stats (`/api/stream-checker/test-incomplete-stats`)

**Neu:**
- Durchsucht ALLE Streams in der Datenbank
- Zählt unzugeordnete Streams separat
- Neue Debug-Info: `streams_without_channel`

**Vorteile:**
- Findet auch Streams, die wegen Account Limits nicht zugeordnet wurden
- Vollständige Abdeckung aller Streams mit incomplete Stats

### 2. Test Without Stats (`/api/stream-checker/test-streams-without-stats`)

**Neu:**
- Durchsucht ALLE Streams in der Datenbank
- Zählt unzugeordnete Streams separat
- Neue Debug-Info: `streams_without_channel`

**Vorteile:**
- Findet auch neue Streams, die noch nicht zugeordnet wurden
- Vollständige Abdeckung aller Streams ohne Stats

## Debug-Informationen

### Test Incomplete Stats Response:
```json
{
  "message": "No streams with incomplete stats found",
  "streams_found": 0,
  "channels_affected": 0,
  "debug_info": {
    "total_streams_checked": 5000,
    "streams_with_stats": 4500,
    "streams_without_stats": 300,
    "quality_excluded": 150,
    "streams_without_channel": 50  // NEU!
  }
}
```

### Test Without Stats Response:
```json
{
  "message": "No streams without stats found",
  "streams_found": 0,
  "channels_affected": 0,
  "debug_info": {
    "total_streams_checked": 5000,
    "quality_excluded": 150,
    "streams_without_channel": 50  // NEU!
  }
}
```

## Wichtige Hinweise

### Streams ohne Channel-Zuordnung
Streams mit `channel=null` werden **übersprungen**, weil:
- Sie können nicht getestet werden (kein Channel zum Queuen)
- Sie müssen erst durch "Discover Streams" zugeordnet werden
- Account Limits verhindern möglicherweise die Zuordnung

### Lösung für unzugeordnete Streams:
1. **Discover Streams** ausführen (mit oder ohne Account Limits)
2. Streams werden Channels zugeordnet
3. Dann können sie mit "Test Incomplete Stats" / "Test Without Stats" getestet werden

## Logging

**Neue Log-Ausgaben:**

**Test Incomplete Stats:**
```
INFO - Checking 5000 total streams for incomplete stats...
INFO - Incomplete stats scan complete: 5000 streams checked, 4500 with stats, 300 without stats, 150 quality-excluded, 50 unassigned, 0 incomplete
```

**Test Without Stats:**
```
INFO - Without stats scan complete: 5000 streams checked, 150 quality-excluded, 50 unassigned, 300 without stats
```

## Testing

**Container neu bauen:**
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

**Test-Szenario:**
1. Account Limits aktivieren (z.B. max 5 Streams pro Account)
2. "Discover Streams" ausführen
3. "Test Incomplete Stats" klicken
4. Sollte jetzt auch Streams finden, die wegen Limits nicht zugeordnet wurden (aber einen Channel haben)

## Files Modified
- `backend/web_api.py` - Both endpoints now search ALL streams, not just assigned ones
- `TEST_INCOMPLETE_STATS_DEBUG.md` - Updated documentation

