# Test Without Stats - Enhanced (Merged with Incomplete Stats)

## Änderungen

"Test Without Stats" und "Test Incomplete Stats" wurden zu einem Button zusammengefasst.

### Neuer "Test Without Stats" Button

**Was er macht:**
1. Deaktiviert temporär Account Limits
2. Führt Discover Streams aus (alle Streams werden zugeordnet)
3. Findet Streams ohne Stats ODER mit incomplete Stats
4. Testet diese Streams
5. Reaktiviert Account Limits (werden mit neuen Scores angewendet)

**Workflow:**
```
Step 1/4: Temporarily disable account limits
Step 2/4: Discover and assign ALL matching streams
Step 3/4: Find streams without/incomplete stats
Step 4/4: Queue channels for testing
         Re-enable account limits
```

## Unterschied zu Global Check

| Feature | Global Check | Test Without Stats (neu) |
|---------|-------------|-------------------------|
| **Discover Streams** | ✅ Ja | ✅ Ja |
| **Deaktiviert Limits** | ✅ Ja (temporär) | ✅ Ja (temporär) |
| **Testet Streams mit vollständigen Stats** | ✅ Ja | ❌ Nein |
| **Testet Streams ohne Stats** | ✅ Ja | ✅ Ja |
| **Testet Streams mit incomplete Stats** | ✅ Ja | ✅ Ja |
| **Geschwindigkeit** | 🐢 Langsam (alle) | 🐇 Schneller (nur ohne/incomplete) |

## Was wird als "Incomplete" erkannt?

Ein Stream hat incomplete Stats wenn:
- `resolution` fehlt oder ist `N/A`, `0x0`, `Unknown`
- `video_codec` fehlt oder ist `N/A`, `Unknown`
- `audio_codec` fehlt oder ist `N/A`, `Unknown`
- `ffmpeg_output_bitrate` fehlt oder ist `0`

## API Response

**Erfolg:**
```json
{
  "message": "Queued 150 stream(s) for testing",
  "streams_found": 150,
  "channels_affected": 50,
  "status": "queued",
  "description": "Testing streams from 50 channel(s)",
  "breakdown": {
    "without_stats": 100,
    "incomplete_stats": 50
  }
}
```

**Keine Streams gefunden:**
```json
{
  "message": "No streams without stats or incomplete stats found",
  "streams_found": 0,
  "channels_affected": 0,
  "debug_info": {
    "total_streams_checked": 5000,
    "streams_without_stats": 0,
    "streams_with_incomplete_stats": 0,
    "quality_excluded": 150
  }
}
```

## Test Incomplete Stats Endpoint

Der alte `/api/stream-checker/test-incomplete-stats` Endpoint existiert noch, leitet aber auf den neuen zusammengefassten Endpoint um:

```python
@app.route('/api/stream-checker/test-incomplete-stats', methods=['POST'])
def test_incomplete_stats():
    """DEPRECATED: Redirects to test-streams-without-stats"""
    return test_streams_without_stats()
```

Das bedeutet: Beide Buttons funktionieren, aber machen jetzt das Gleiche.

## Workflow-Empfehlung

### Initiales Setup:
```
1. Global Check
   → Testet ALLE Streams (auch mit vollständigen Stats)
   → Erstellt vollständige Baseline
```

### Laufender Betrieb:
```
1. Discover Streams (manuell oder automatisch)
   → Neue Streams werden gefunden
   
2. Test Without Stats
   → Discover + Test nur neue/incomplete Streams
   → Schneller als Global Check
   → Stellt sicher, dass alle Streams Stats haben
```

### Periodische Wartung:
```
1. Wöchentlich: Global Check
   → Re-Test ALLER Streams
   → Erkennt tote Streams
   → Aktualisiert alle Scores
```

## Vorteile der Zusammenführung

✅ **Einfacher:** Nur ein Button statt zwei  
✅ **Vollständiger:** Testet sowohl ohne als auch incomplete Stats  
✅ **Intelligenter:** Macht automatisch Discover vor dem Test  
✅ **Schneller als Global Check:** Testet nur Streams, die es brauchen  
✅ **Gleiche Qualität:** Deaktiviert Limits wie Global Check  

## Error Handling

Bei Fehler werden Account Limits automatisch wiederhergestellt:

```python
except Exception as e:
    # Restore limits on error
    if original_limits_enabled:
        account_limits_config['enabled'] = True
        service.config['account_stream_limits'] = account_limits_config
```

## Frontend Änderungen

**Optional:** Button-Text anpassen:
- Alt: "Test Without Stats"
- Neu: "Test Missing/Incomplete Stats"
- Oder: "Test Incomplete Streams"

**Tooltip anpassen:**
```
Discovers all streams and tests those with missing or incomplete quality data.
Faster than Global Check as it only tests streams that need it.
```

## Files Modified
- `backend/web_api.py` - Enhanced test-streams-without-stats endpoint
- `backend/web_api.py` - test-incomplete-stats now redirects to test-streams-without-stats
