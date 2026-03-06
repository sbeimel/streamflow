# M3U Filter Fix - Implementation Status

## ✅ Completed Changes

### 1. UpdateTracker erweitert (backend/stream_checker_service.py)

**Zeile ~355:** `__init__` Methode
```python
self.channel_m3u_filters = {}  # Track M3U account filters per channel
```

**Zeile ~420:** `mark_channels_updated` Methode - Parameter hinzugefügt
```python
def mark_channels_updated(self, channel_ids: List[int], ..., m3u_account_filter: int = None):
    # Store M3U filter if provided
    if m3u_account_filter is not None:
        self.channel_m3u_filters[channel_id] = m3u_account_filter
```

**Zeile ~710:** Neue Methoden hinzugefügt
```python
def get_m3u_filter_for_channel(self, channel_id: int) -> Optional[int]:
    """Get M3U account filter for a channel if one was set."""
    with self.lock:
        return self.channel_m3u_filters.get(channel_id)

def clear_m3u_filter(self, channel_id: int):
    """Clear M3U filter for a channel after checking is complete."""
    with self.lock:
        if channel_id in self.channel_m3u_filters:
            del self.channel_m3u_filters[channel_id]
```

## ⚠️ MANUELLE ÄNDERUNG ERFORDERLICH

### 2. M3U Filter in _check_channel_concurrent anwenden

**Datei:** `backend/stream_checker_service.py`  
**Methode:** `_check_channel_concurrent`  
**Zeile:** ~2050 (nach `logger.info(f"Found {len(streams)} streams...")`)

**FÜGE HINZU:**
```python
# Check if M3U filter is set for this channel (from Discover & Test for specific M3U)
m3u_filter = self.update_tracker.get_m3u_filter_for_channel(channel_id)

if m3u_filter is not None:
    original_count = len(streams)
    streams = [s for s in streams if s.get('m3u_account') == m3u_filter]
    filtered_count = len(streams)
    
    logger.info(f"🔍 M3U Filter applied: {original_count} total streams → {filtered_count} from M3U account {m3u_filter}")
    
    if filtered_count == 0:
        logger.warning(f"No streams from M3U account {m3u_filter} found in channel {channel_name}")
        # Clear filter and mark as completed
        self.update_tracker.clear_m3u_filter(channel_id)
        self.check_queue.mark_completed(channel_id)
        self.update_tracker.mark_channel_checked(channel_id)
        return {
            'dead_streams_count': 0,
            'revived_streams_count': 0
        }
```

**POSITION:** Direkt nach dieser Zeile:
```python
logger.info(f"Found {len(streams)} streams for channel {channel_name}")
```

**VOR dieser Zeile:**
```python
# Check if channel has active viewers or if its playlist has reached max concurrent streams
limit_check_result = self._check_channel_limits(channel_id, channel_name, streams)
```

### 3. M3U Filter nach Check löschen

**Datei:** `backend/stream_checker_service.py`  
**Methode:** `_check_channel_concurrent`  
**Zeile:** ~2360 (am Ende der Methode, vor `return result`)

**FÜGE HINZU:**
```python
# Clear M3U filter after check is complete
m3u_filter = self.update_tracker.get_m3u_filter_for_channel(channel_id)
if m3u_filter is not None:
    self.update_tracker.clear_m3u_filter(channel_id)
    logger.debug(f"Cleared M3U filter for channel {channel_id}")
```

### 4. M3U Filter in automated_stream_manager übergeben

**Datei:** `backend/automated_stream_manager.py`  
**Zeile:** ~1410 (in `discover_and_assign_streams`)

**ÄNDERE:**
```python
stream_checker.update_tracker.mark_channels_updated(
    channel_ids_to_mark, 
    stream_counts=stream_counts, 
    force_check=False,
    m3u_account_filter=m3u_account_id  # ✅ HINZUFÜGEN!
)
```

## Testing

Nach den Änderungen sollten die Logs zeigen:
```
✅ Marked 17 channels for checking streams from M3U account 262
✅ 🔍 M3U Filter applied: 45 total streams → 3 from M3U account 262
✅ Found 3 streams for channel Sky Sport News HD
✅ Cleared M3U filter for channel 3930
```

## Status

- ✅ UpdateTracker erweitert
- ⚠️ _check_channel_concurrent: MANUELLE ÄNDERUNG NÖTIG
- ⚠️ automated_stream_manager: MANUELLE ÄNDERUNG NÖTIG

Die Änderungen in `stream_checker_service.py` Zeile ~2050 und `automated_stream_manager.py` Zeile ~1410 müssen manuell vorgenommen werden.
