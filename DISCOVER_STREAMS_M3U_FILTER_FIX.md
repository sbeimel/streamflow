# 🐛 BUG FIX: Discover & Test testet alle Streams statt nur ausgewählte M3U

## Problem

Wenn du "Discover & Test" für **nur M3U Account 262** ausführst:
- ✅ Discovery findet korrekt nur Streams von M3U 262
- ✅ Assignment weist diese Streams den Channels zu
- ❌ **Quality Check testet ALLE Streams des Channels** (auch von anderen M3Us!)

**Beispiel:**
```
User wählt: "Discover & Test" für M3U 262
System testet aber:
- Stream von Account 253 (kukra123-exyu.mine.nu)
- Stream von Account 233 (azers.online)
- Stream von Account 237 (good-service.org)
- Stream von Account 256 (eagle4u.org)
- ... und viele mehr!
```

## Root Cause

**Datei:** `backend/automated_stream_manager.py` Zeile ~1400

```python
def discover_and_assign_streams(self, m3u_account_id=None, ...):
    # 1. Discovery mit M3U Filter ✅
    all_streams = get_streams(m3u_account=m3u_account_id)
    
    # 2. Assignment ✅
    assign_streams_to_channels(matched_streams)
    
    # 3. Mark channels for checking
    stream_checker.mark_channels_updated(channel_ids_to_mark)
    
    # ❌ PROBLEM: m3u_account_id wird NICHT weitergegeben!
    # Stream Checker weiß nicht, dass nur M3U 262 getestet werden soll!
```

**Datei:** `backend/stream_checker_service.py`

```python
def _check_channel_concurrent(self, channel_id, channel_name):
    # Holt ALLE Streams des Channels
    streams = fetch_channel_streams(channel_id)  # ❌ Kein M3U Filter!
    
    # Testet alle Streams
    for stream in streams:
        analyze_stream(stream)  # Testet auch Streams von anderen M3Us!
```

## Lösung

### Schritt 1: M3U Account ID in Channel Marker speichern

**Datei:** `backend/automated_stream_manager.py`

```python
# Nach Zeile 1400
if channel_ids_to_mark:
    try:
        from stream_checker_service import get_stream_checker_service
        stream_checker = get_stream_checker_service()
        
        # ✅ FIX: Übergebe m3u_account_id an mark_channels_updated
        stream_checker.update_tracker.mark_channels_updated(
            channel_ids_to_mark, 
            stream_counts=stream_counts, 
            force_check=False,
            m3u_account_filter=m3u_account_id  # ✅ NEU!
        )
        
        logger.info(f"Marked {len(channel_ids_to_mark)} channels for checking streams from M3U account {m3u_account_id}")
```

### Schritt 2: M3U Filter in UpdateTracker speichern

**Datei:** `backend/stream_checker_service.py` (UpdateTracker Klasse)

```python
class UpdateTracker:
    def __init__(self):
        self.updated_channels = {}
        self.channel_stream_counts = {}
        self.channel_m3u_filters = {}  # ✅ NEU: Speichert M3U Filter pro Channel
        self.lock = threading.Lock()
    
    def mark_channels_updated(self, channel_ids: List[int], stream_counts: Dict[int, int] = None, 
                             force_check: bool = False, m3u_account_filter: int = None):  # ✅ NEU Parameter
        """Mark channels as updated and needing stream quality checks.
        
        Args:
            channel_ids: List of channel IDs to mark
            stream_counts: Optional dict of channel_id -> stream count
            force_check: If True, bypass immunity period
            m3u_account_filter: If provided, only check streams from this M3U account
        """
        with self.lock:
            current_time = time.time()
            for channel_id in channel_ids:
                self.updated_channels[channel_id] = {
                    'timestamp': current_time,
                    'force_check': force_check
                }
                
                # ✅ FIX: Speichere M3U Filter
                if m3u_account_filter is not None:
                    self.channel_m3u_filters[channel_id] = m3u_account_filter
                    logger.debug(f"Channel {channel_id} marked for checking only M3U account {m3u_account_filter}")
                
                if stream_counts and channel_id in stream_counts:
                    self.channel_stream_counts[channel_id] = stream_counts[channel_id]
    
    def get_m3u_filter_for_channel(self, channel_id: int) -> Optional[int]:
        """Get M3U account filter for a channel if one was set.
        
        Returns:
            M3U account ID to filter by, or None for no filter
        """
        with self.lock:
            return self.channel_m3u_filters.get(channel_id)
    
    def clear_m3u_filter(self, channel_id: int):
        """Clear M3U filter for a channel after checking is complete."""
        with self.lock:
            if channel_id in self.channel_m3u_filters:
                del self.channel_m3u_filters[channel_id]
```

### Schritt 3: M3U Filter beim Stream Check anwenden

**Datei:** `backend/stream_checker_service.py` (_check_channel_concurrent Methode)

```python
def _check_channel_concurrent(self, channel_id: int, channel_name: str) -> Dict[str, Any]:
    """Check all streams for a channel with concurrent stream limiting."""
    
    # ✅ FIX: Hole M3U Filter falls gesetzt
    m3u_filter = self.update_tracker.get_m3u_filter_for_channel(channel_id)
    
    if m3u_filter:
        logger.info(f"🔍 Checking channel {channel_name}: ONLY streams from M3U account {m3u_filter}")
    else:
        logger.info(f"🔍 Checking channel {channel_name}: ALL streams")
    
    # Fetch streams
    streams = fetch_channel_streams(channel_id)
    
    if not streams:
        logger.warning(f"No streams found for channel {channel_name}")
        return {...}
    
    # ✅ FIX: Filtere Streams nach M3U Account falls Filter gesetzt
    if m3u_filter is not None:
        original_count = len(streams)
        streams = [s for s in streams if s.get('m3u_account') == m3u_filter]
        filtered_count = len(streams)
        
        logger.info(f"📊 M3U Filter applied: {original_count} total streams → {filtered_count} from M3U {m3u_filter}")
        
        if filtered_count == 0:
            logger.warning(f"No streams from M3U account {m3u_filter} found in channel {channel_name}")
            # Clear filter and mark as completed
            self.update_tracker.clear_m3u_filter(channel_id)
            return {...}
    
    logger.info(f"Found {len(streams)} streams for channel {channel_name}")
    
    # ... rest of checking logic ...
    
    # ✅ FIX: Clear M3U filter after check is complete
    if m3u_filter is not None:
        self.update_tracker.clear_m3u_filter(channel_id)
        logger.debug(f"Cleared M3U filter for channel {channel_id}")
    
    return result
```

### Schritt 4: M3U Filter auch in Single Channel Check

**Datei:** `backend/stream_checker_service.py` (check_single_channel Methode)

```python
def _check_single_channel(self, channel_id: int, channel_name: str, m3u_account_filter: int = None) -> Dict[str, Any]:
    """Check a single channel's streams.
    
    Args:
        channel_id: Channel ID to check
        channel_name: Channel name
        m3u_account_filter: Optional M3U account ID to filter streams by
    """
    
    # ✅ FIX: Setze M3U Filter falls übergeben
    if m3u_account_filter is not None:
        self.update_tracker.mark_channels_updated(
            [channel_id], 
            force_check=True,
            m3u_account_filter=m3u_account_filter
        )
    
    # Use concurrent checking method
    return self._check_channel_concurrent(channel_id, channel_name)
```

## Implementation

Erstelle einen Patch:

```bash
# patch_m3u_filter_fix.patch
```

```python
# Vollständiger Patch wird in separater Datei erstellt
```

## Testing

Nach dem Fix:

```
User wählt: "Discover & Test" für M3U 262

Logs sollten zeigen:
✅ Marked 17 channels for checking streams from M3U account 262
✅ 🔍 Checking channel Sky Sport News HD: ONLY streams from M3U account 262
✅ 📊 M3U Filter applied: 45 total streams → 3 from M3U 262
✅ Found 3 streams for channel Sky Sport News HD
✅ Cleared M3U filter for channel 3930
```

## Backward Compatibility

- ✅ Wenn `m3u_account_filter` nicht gesetzt: Altes Verhalten (alle Streams testen)
- ✅ Bestehende Funktionalität bleibt unverändert
- ✅ Nur "Discover & Test" mit M3U Auswahl nutzt den Filter

## Benefits

1. **Schneller:** Testet nur relevante Streams (z.B. 30 statt 500)
2. **Korrekter:** Testet nur was der User ausgewählt hat
3. **Effizienter:** Keine verschwendeten ffmpeg Calls
4. **Klarer:** Logs zeigen genau was getestet wird

---

**Erstellt:** 2026-03-06  
**Status:** FIX READY - NEEDS IMPLEMENTATION  
**Priority:** HIGH  
**Affects:** Discover & Test Feature
