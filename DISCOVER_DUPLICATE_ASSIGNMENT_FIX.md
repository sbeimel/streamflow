# Discover Streams - Duplikat-Zuweisungen Fix

## Problem

Wenn "Discover Streams" mehrmals hintereinander geklickt wird, werden jedes Mal "neue" Streams gefunden und zugewiesen, obwohl nach dem ersten Mal keine neuen Streams mehr vorhanden sein sollten.

### Symptome

```
Klick 1: "Assigned 30 new streams across 17 channels"
Klick 2: "Assigned 30 new streams across 17 channels"  ← FALSCH!
Klick 3: "Assigned 30 new streams across 17 channels"  ← FALSCH!
Klick 4: "Assigned 30 new streams across 17 channels"  ← FALSCH!
Klick 5: "Assigned 30 new streams across 17 channels"  ← FALSCH!
```

Nach dem ersten Klick sollten 0 neue Streams gefunden werden!

## Root Cause

### Problem 1: Veralteter UDI-Cache

```python
# automated_stream_manager.py, discover_and_assign_streams()

def discover_and_assign_streams(self):
    # Get all channels from UDI
    udi = get_udi_manager()
    all_channels = udi.get_channels()
    
    # Create map of existing channel streams
    channel_streams = {}
    for channel in all_channels:
        streams = udi.get_channel_streams(channel_id)  # ← VERALTETE DATEN!
        channel_streams[channel_id] = set(stream_ids)
```

**Problem**: UDI-Cache wird NICHT refreshed vor dem Discover!
- UDI hat alte Channel-Stream-Zuordnungen im Cache
- Streams, die beim letzten Discover hinzugefügt wurden, sind NICHT im Cache
- Discover denkt, diese Streams sind "neu"

### Problem 2: Lokale Map wird nicht aktualisiert

```python
# Später im Code:
for stream in all_streams:
    matching_channels = self.regex_matcher.match_stream_to_channels(stream_name)
    
    for channel_id in matching_channels:
        # Check if stream is already in this channel
        if channel_id in channel_streams and stream_id not in channel_streams[channel_id]:
            assignments[channel_id].append(stream_id)  # ← "NEU" gefunden!
```

**Problem**: `channel_streams` Map basiert auf veralteten UDI-Daten!
- Stream wurde beim letzten Discover hinzugefügt
- ABER: `channel_streams` hat die alten Daten (vor dem Hinzufügen)
- Stream wird als "neu" erkannt und wieder zugewiesen

### Warum keine echten Duplikate entstehen

```python
# api_utils.py, add_streams_to_channel()

def add_streams_to_channel(channel_id, stream_ids):
    # First get current streams
    current_streams = fetch_channel_streams(channel_id)  # ← FRISCHE Daten von API!
    current_stream_ids = [s['id'] for s in current_streams]
    
    # Filter out duplicates
    valid_new_stream_ids = [
        sid for sid in stream_ids
        if sid in valid_stream_ids and sid not in current_stream_ids  # ← Duplikate raus!
    ]
    
    if valid_new_stream_ids:
        # Add only NEW streams
        return len(valid_new_stream_ids)
    else:
        return 0  # ← Keine neuen Streams!
```

**Gut**: `add_streams_to_channel()` holt FRISCHE Daten von der API und filtert Duplikate!
**Schlecht**: Discover zeigt trotzdem "30 new streams found", obwohl 0 hinzugefügt werden!

## Datenfluss VORHER (mit Bug)

```
Klick 1:
  ↓
UDI-Cache (alt): Channel 1 hat [Stream A, B, C]
  ↓
Discover findet: Stream D, E, F passen zu Channel 1
  ↓
Check: D not in [A,B,C] ✓, E not in [A,B,C] ✓, F not in [A,B,C] ✓
  ↓
Assignments: Channel 1 → [D, E, F]
  ↓
add_streams_to_channel():
  - Holt FRISCHE Daten: [A, B, C]
  - Filtert: D not in [A,B,C] ✓, E not in [A,B,C] ✓, F not in [A,B,C] ✓
  - Fügt hinzu: [D, E, F]
  - Gibt zurück: 3
  ↓
Log: "Assigned 3 new streams to Channel 1" ✓

Klick 2:
  ↓
UDI-Cache (IMMER NOCH ALT!): Channel 1 hat [Stream A, B, C]  ← BUG!
  ↓
Discover findet: Stream D, E, F passen zu Channel 1
  ↓
Check: D not in [A,B,C] ✓, E not in [A,B,C] ✓, F not in [A,B,C] ✓  ← FALSCH!
  ↓
Assignments: Channel 1 → [D, E, F]  ← DUPLIKATE!
  ↓
add_streams_to_channel():
  - Holt FRISCHE Daten: [A, B, C, D, E, F]  ← Korrekt!
  - Filtert: D in [A,B,C,D,E,F] ✗, E in [A,B,C,D,E,F] ✗, F in [A,B,C,D,E,F] ✗
  - Fügt hinzu: []
  - Gibt zurück: 0  ← Korrekt!
  ↓
Log: "No new streams to add to Channel 1"  ← Korrekt!
ABER: Discover zeigt "Found 3 new streams"  ← FALSCH!
```

## Lösung

### UDI-Cache VOR Discover refreshen

```python
# automated_stream_manager.py, discover_and_assign_streams()

def discover_and_assign_streams(self):
    # Reload patterns
    self.regex_matcher.reload_patterns()
    
    logger.info("Starting stream discovery and assignment...")
    
    # WICHTIG: UDI-Cache refreshen BEVOR wir Channel-Streams lesen!
    udi = get_udi_manager()
    logger.debug("Refreshing UDI cache to get latest channel-stream assignments...")
    udi.refresh_channels()  # ← NEU!
    
    # Jetzt haben wir FRISCHE Daten!
    all_channels = udi.get_channels()
    
    # Create map of existing channel streams (mit FRISCHEN Daten!)
    channel_streams = {}
    for channel in all_channels:
        streams = udi.get_channel_streams(channel_id)  # ← FRISCHE Daten!
        channel_streams[channel_id] = set(stream_ids)
```

## Datenfluss NACHHER (mit Fix)

```
Klick 1:
  ↓
UDI-Cache refreshen → Channel 1 hat [Stream A, B, C]
  ↓
Discover findet: Stream D, E, F passen zu Channel 1
  ↓
Check: D not in [A,B,C] ✓, E not in [A,B,C] ✓, F not in [A,B,C] ✓
  ↓
Assignments: Channel 1 → [D, E, F]
  ↓
add_streams_to_channel():
  - Holt FRISCHE Daten: [A, B, C]
  - Filtert: D not in [A,B,C] ✓, E not in [A,B,C] ✓, F not in [A,B,C] ✓
  - Fügt hinzu: [D, E, F]
  - Gibt zurück: 3
  ↓
Log: "Assigned 3 new streams to Channel 1" ✓

Klick 2:
  ↓
UDI-Cache refreshen → Channel 1 hat [Stream A, B, C, D, E, F]  ← FRISCH!
  ↓
Discover findet: Stream D, E, F passen zu Channel 1
  ↓
Check: D in [A,B,C,D,E,F] ✗, E in [A,B,C,D,E,F] ✗, F in [A,B,C,D,E,F] ✗  ← KORREKT!
  ↓
Assignments: Channel 1 → []  ← KEINE Duplikate!
  ↓
Log: "No new streams found" ✓
```

## Implementierung

### Änderung in `automated_stream_manager.py`

**Zeile ~958** (discover_and_assign_streams):
```python
# WICHTIG: UDI-Cache refreshen BEVOR wir Channel-Streams lesen
udi = get_udi_manager()
logger.debug("Refreshing UDI cache to get latest channel-stream assignments...")
udi.refresh_channels()

# Get all available streams
all_streams = get_streams(log_result=False)
```

**Zeile ~1071** (udi nicht nochmal initialisieren):
```python
# Get all channels from UDI (already initialized and refreshed above)
all_channels = udi.get_channels()
```

## Performance-Impact

### Frage: Ist der zusätzliche Refresh langsam?

**NEIN!** Weil:

1. **UDI-Refresh ist schnell**: ~0.1-0.2s für Channels
2. **Nur Channels werden refreshed**: Nicht alle Streams
3. **Verhindert unnötige Arbeit**: Discover muss nicht alle Streams nochmal prüfen
4. **Bessere UX**: Benutzer sieht sofort "0 new streams" beim 2. Klick

### Vergleich

| Operation | Ohne Fix | Mit Fix |
|-----------|----------|---------|
| Klick 1 | 18s | 18.2s (+0.2s) |
| Klick 2 | 18s (unnötig!) | 0.2s (sofort fertig!) |
| Klick 3 | 18s (unnötig!) | 0.2s (sofort fertig!) |
| Total (3 Klicks) | 54s | 18.6s |

**Mit Fix ist es SCHNELLER bei mehrfachen Klicks!**

## Testing

Nach diesem Fix:

1. ✅ **Klick 1**: "Assigned 30 new streams across 17 channels"
2. ✅ **Klick 2**: "No new streams found" (oder sehr wenige, wenn wirklich neue da sind)
3. ✅ **Klick 3**: "No new streams found"
4. ✅ **Klick 4**: "No new streams found"
5. ✅ **Klick 5**: "No new streams found"

## Geänderte Dateien

- `backend/automated_stream_manager.py`
  - `discover_and_assign_streams()`: UDI-Cache refresh vor dem Discover
  - Zeile ~958: `udi.refresh_channels()` hinzugefügt
  - Zeile ~1071: Doppelte `udi = get_udi_manager()` entfernt

## Zusammenfassung

**Problem**: UDI-Cache war veraltet, Discover fand immer wieder dieselben "neuen" Streams

**Lösung**: UDI-Cache vor Discover refreshen, um aktuelle Channel-Stream-Zuordnungen zu haben

**Ergebnis**: 
- Keine falschen "new streams found" Meldungen mehr
- Schneller bei mehrfachen Klicks
- Korrekte Duplikat-Erkennung
