# Resolution Parsing Fix

## Problem

Auflösung konnte manchmal nicht ausgelesen werden (0x0), weil das Regex-Pattern zu strikt war.

## Ursache

Das alte Pattern suchte nur nach exaktem Format `1920x1080`:
```python
# Alt (zu strikt):
res_match = re.search(r'(\d{2,5})x(\d{2,5})', line)
```

FFmpeg gibt aber verschiedene Formate aus:
- `1920x1080` ✅ (funktionierte)
- `1920 x 1080` ❌ (mit Leerzeichen - funktionierte NICHT)
- `1920*1080` ❌ (mit Stern - funktionierte NICHT)
- `1920×1080` ❌ (mit Unicode × - funktionierte NICHT)

## Lösung

Flexibleres Regex-Pattern, das alle Varianten unterstützt:
```python
# Neu (flexibel):
res_match = re.search(r'(\d{2,5})\s*[x*×]\s*(\d{2,5})', line)
```

### Was das Pattern macht:
- `(\d{2,5})` - Erste Zahl (2-5 Stellen) = Breite
- `\s*` - Optionale Leerzeichen
- `[x*×]` - Eines der Trennzeichen: x, *, oder ×
- `\s*` - Optionale Leerzeichen
- `(\d{2,5})` - Zweite Zahl (2-5 Stellen) = Höhe

### Unterstützte Formate:
✅ `1920x1080`
✅ `1920 x 1080`
✅ `1920*1080`
✅ `1920×1080`
✅ `1920  x  1080` (mehrere Leerzeichen)

## Zusätzliche Verbesserungen

### 1. Besseres Early Exit Logging
```python
# Zeigt jetzt welche Daten gesammelt wurden:
logger.info(f"⚡ Early exit after {elapsed:.1f}s (all data collected: codec={result_data['video_codec']}, res={result_data['resolution']}, fps={result_data['fps']}, bitrate={result_data.get('bitrate_kbps', 'pending')})")
```

### 2. Debug-Logging für fehlende Daten
```python
# Zeigt warum Early Exit NICHT getriggert wurde:
if not early_exit_triggered and elapsed >= min_runtime:
    missing_data = [key for key, value in required_data.items() if not value]
    if missing_data:
        logger.debug(f"  ⏱ No early exit: missing data after {elapsed:.1f}s: {', '.join(missing_data)}")
```

## Erwartete Verbesserung

- **Weniger 0x0 Resolutions** - Mehr Streams werden korrekt erkannt
- **Besseres Debugging** - Logs zeigen genau was fehlt
- **Robustere Erkennung** - Funktioniert mit mehr FFmpeg-Output-Varianten

## Testing

Nach dem Deployment kannst du testen:

```bash
# Prüfe Logs für Resolution-Erkennung:
docker-compose logs -f backend | grep "Detected resolution"

# Prüfe Early Exit Logs:
docker-compose logs -f backend | grep "Early exit"

# Prüfe fehlende Daten:
docker-compose logs -f backend | grep "No early exit"
```

## Deployment

```bash
# Container neu bauen mit den Fixes:
docker-compose down
docker-compose up -d --build
```

## Änderungen

**Datei:** `backend/stream_check_utils.py`

**Zeilen geändert:**
- Zeile ~426: Resolution-Parsing in Early Exit Modus
- Zeile ~542: Resolution-Parsing in Non-Early-Exit Modus
- Zeile ~477: Verbessertes Early Exit Logging
- Zeile ~493: Debug-Logging für fehlende Daten

**Backward Compatible:** Ja, alle alten Formate funktionieren weiterhin.
