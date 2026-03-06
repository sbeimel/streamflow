# Stream Metadata Cache - ENTFERNT ✅

## Warum entfernt?

Der Stream Metadata Cache war **redundant**, weil:

1. ✅ **Dispatcharr ist bereits der Cache** - `stream_stats` werden dort persistent gespeichert
2. ✅ **2-Stunden-Immunität** verhindert bereits redundante Checks
3. ✅ **`streams_already_checked`** nutzt bereits Dispatcharr-Daten
4. ❌ **Zusätzliche Komplexität** ohne echten Mehrwert
5. ❌ **Kann zu Inkonsistenzen führen** (Cache vs. Dispatcharr)
6. ❌ **Braucht extra Speicher** (`stream_metadata_cache.pkl`)

## Was wurde entfernt?

### 1. Datei gelöscht
- ❌ `backend/stream_metadata_cache.py` - Komplett entfernt

### 2. Code-Änderungen

**`backend/stream_check_utils.py`:**
- ❌ Entfernt: `use_cache` Parameter aus `analyze_stream()`
- ❌ Entfernt: Cache-Check am Anfang der Funktion
- ❌ Entfernt: Cache-Write bei erfolgreicher Analyse
- ❌ Entfernt: `cached` Feld aus Return-Dict
- ❌ Entfernt: Docstring-Referenzen zum Cache

**`backend/stream_checker_service.py`:**
- ❌ Entfernt: `use_cache` Parameter aus `_analyze_stream_with_profile_failover()`
- ❌ Entfernt: `use_cache=(not force_check)` aus allen Aufrufen
- ❌ Entfernt: Docstring-Referenzen zum Cache

## Wie funktioniert es jetzt?

### Dispatcharr als Single Source of Truth

```python
# In check_channel():
if force_check:
    streams_to_check = streams  # Alle Streams prüfen
else:
    # Nur neue/ungeprüfte Streams
    streams_to_check = [s for s in streams if s['id'] not in checked_stream_ids]
    streams_already_checked = [s for s in streams if s['id'] in checked_stream_ids]
```

**Für `streams_already_checked`:**
```python
# Daten direkt aus Dispatcharr holen
stream_data = udi.get_stream_by_id(stream['id'])
stream_stats = stream_data.get('stream_stats', {})

# Verwende gespeicherte Stats für Scoring
analyzed_streams.append({
    'stream_id': stream['id'],
    'resolution': stream_stats.get('resolution', '0x0'),
    'fps': stream_stats.get('source_fps', 0),
    'video_codec': stream_stats.get('video_codec', 'N/A'),
    'audio_codec': stream_stats.get('audio_codec', 'N/A'),
    'bitrate_kbps': stream_stats.get('ffmpeg_output_bitrate', 0),
    'status': 'OK'
})
```

## Vorteile der Entfernung

✅ **Einfacherer Code** - Weniger Komplexität
✅ **Keine Inkonsistenzen** - Dispatcharr ist die einzige Wahrheit
✅ **Weniger Speicher** - Keine lokale Cache-Datei
✅ **Weniger Fehlerquellen** - Keine Cache-Synchronisations-Probleme
✅ **Bessere Wartbarkeit** - Ein System weniger zu debuggen

## Performance-Impact

**Keine negativen Auswirkungen**, weil:

1. **2-Stunden-Immunität** verhindert bereits die meisten redundanten Checks
2. **Dispatcharr-Daten** werden für `streams_already_checked` verwendet
3. **Nur neue Streams** werden mit FFmpeg analysiert
4. **force_check** ist für manuelle Tests gedacht (Geschwindigkeit egal)

## Migration

**Keine Aktion nötig!**

- Alte Cache-Datei `/app/data/stream_metadata_cache.pkl` wird ignoriert
- System funktioniert sofort ohne Cache
- Dispatcharr-Daten bleiben erhalten

## Testing

1. Container neu bauen:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

2. Normalen Check durchführen:
   - Streams mit 2-Stunden-Immunität werden übersprungen
   - Nur neue Streams werden analysiert
   - Dispatcharr-Daten werden verwendet

3. Force Check durchführen:
   - Alle Streams werden neu analysiert
   - Keine Cache-Hits mehr (wie gewünscht)

## Status

✅ **Cache komplett entfernt**
✅ **Keine Syntax-Fehler**
✅ **Dispatcharr ist Single Source of Truth**
✅ **Bereit zum Testen**
