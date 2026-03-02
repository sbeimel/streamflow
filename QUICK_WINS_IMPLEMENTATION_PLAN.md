# Quick Wins Implementation Plan

## Übersicht

Implementierung von 4 Performance-Optimierungen für StreamFlow:

1. ✅ **Early Exit** (40% schneller bei Stream Checks)
2. ✅ **Metadata Cache** (60% bei Wiederholungen) 
3. ✅ **Parallel Regex Matching** (60% schneller bei Discover - von 228s auf 60s)
4. ✅ **Priority Queue** (bessere UX)

---

## 1. Early Exit bei Stream Checks

### Problem
FFmpeg läuft immer die volle Duration (8s), auch wenn alle Daten bereits nach 3s vorhanden sind.

### Lösung
Stoppt FFmpeg sobald alle benötigten Daten (codec, resolution, fps, bitrate) erkannt wurden.

### Implementation
**Datei:** `backend/stream_check_utils.py`

**Änderungen:**
- `get_stream_info_and_bitrate()` von `subprocess.run()` auf `subprocess.Popen()` umstellen
- Echtzeit-Parsing der FFmpeg-Ausgabe
- Early Exit wenn alle 4 Daten vorhanden + mindestens 3s elapsed
- Graceful Termination mit `process.terminate()`

**Code-Struktur:**
```python
def get_stream_info_and_bitrate_with_early_exit(...):
    # Start FFmpeg als Popen (nicht run)
    process = subprocess.Popen(command, stderr=subprocess.PIPE, ...)
    
    # Track required data
    required_data = {
        'video_codec': False,
        'resolution': False,
        'fps': False,
        'bitrate': False
    }
    
    # Parse output in real-time
    for line in iter(process.stderr.readline, ''):
        # Extract data...
        if 'Video:' in line:
            required_data['video_codec'] = True
            required_data['resolution'] = True
            required_data['fps'] = True
        
        if 'bitrate=' in line:
            required_data['bitrate'] = True
        
        # Early Exit Check
        elapsed = time.time() - start
        if all(required_data.values()) and elapsed >= 3:
            logger.info(f"⚡ Early exit after {elapsed:.1f}s (all data collected)")
            process.terminate()
            break
    
    # Wait for process to finish
    process.wait(timeout=5)
```

**Erwartete Verbesserung:**
- Gute Streams: 3-5s (statt 8s) → 40% schneller
- Schlechte Streams: 8s (wie bisher)
- Tote Streams: Timeout (wie bisher)

---

## 2. Metadata Cache

### Problem
Streams werden bei jedem Check komplett neu analysiert, auch wenn sie kürzlich geprüft wurden.

### Lösung
Cached Stream-Metadaten für 24h in Pickle-Datei.

### Implementation
**Datei:** `backend/stream_metadata_cache.py` (NEU)

**Features:**
- Thread-safe Cache mit Lock
- 24h TTL (Time To Live)
- Persistent Storage (Pickle)
- Automatic Cleanup
- Hit/Miss Statistics

**Integration in `stream_check_utils.py`:**
```python
from stream_metadata_cache import get_metadata_cache

def analyze_stream(...):
    cache = get_metadata_cache()
    
    # 1. Check Cache
    cached = cache.get(stream_url)
    if cached:
        logger.info(f"Using cached metadata (age: {age}h)")
        return cached
    
    # 2. Full Analysis
    result = get_stream_info_and_bitrate(...)
    
    # 3. Store in Cache
    cache.set(stream_url, result)
    
    return result
```

**Erwartete Verbesserung:**
- Cache Hit: ~0.1s (instant)
- Cache Miss: ~5-8s (full analysis)
- Hit Rate: 60-70%
- Zeitersparnis: 60% bei wiederholten Checks

---

## 3. Parallel Regex Matching

### Problem
Regex Matching läuft sequentiell: 63.793 Streams × 50 Channels = 228s

### Lösung
Multi-Threading mit ThreadPoolExecutor für paralleles Regex Matching.

### Implementation
**Datei:** `backend/automated_stream_manager.py`

**Änderungen in `discover_and_assign_streams()`:**
```python
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

def discover_and_assign_streams(self, ...):
    # ... existing code ...
    
    # Determine optimal worker count
    num_workers = min(multiprocessing.cpu_count(), 8)
    chunk_size = max(1000, len(all_streams) // num_workers)
    
    # Split streams into chunks
    chunks = [all_streams[i:i+chunk_size] 
              for i in range(0, len(all_streams), chunk_size)]
    
    logger.info(f"Processing {len(all_streams)} streams with {num_workers} workers ({len(chunks)} chunks)")
    
    # Process chunks in parallel
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [
            executor.submit(self._match_chunk, chunk, channel_streams)
            for chunk in chunks
        ]
        
        # Collect results
        for future in futures:
            chunk_assignments = future.result()
            # Merge into assignments dict
            for channel_id, stream_ids in chunk_assignments.items():
                assignments[channel_id].extend(stream_ids)
                assignment_details[channel_id].extend(...)

def _match_chunk(self, streams_chunk, channel_streams):
    """Match a chunk of streams to channels (runs in parallel)"""
    chunk_assignments = defaultdict(list)
    chunk_details = defaultdict(list)
    
    for stream in streams_chunk:
        stream_name = stream.get('name', '')
        stream_id = stream.get('id')
        stream_m3u_account = stream.get('m3u_account')
        
        # Find matching channels
        matching_channels = self.regex_matcher.match_stream_to_channels(
            stream_name, stream_m3u_account
        )
        
        for channel_id in matching_channels:
            if channel_id in channel_streams and stream_id not in channel_streams[channel_id]:
                chunk_assignments[channel_id].append(stream_id)
                chunk_details[channel_id].append({
                    "stream_id": stream_id,
                    "stream_name": stream_name
                })
    
    return chunk_assignments, chunk_details
```

**Erwartete Verbesserung:**
- Von 228s auf ~60s (4x schneller)
- Rate: Von 270 streams/sec auf ~1000 streams/sec
- CPU-Auslastung: Besser verteilt über alle Cores

---

## 4. Priority Queue

### Problem
Alle Channels werden gleich behandelt - wichtige Channels warten genauso lange wie unwichtige.

### Lösung
Priority Queue mit Heap für intelligente Channel-Reihenfolge.

### Implementation
**Datei:** `backend/priority_queue.py` (NEU)

**Features:**
```python
import heapq
from dataclasses import dataclass, field
from typing import Any

@dataclass(order=True)
class PrioritizedChannel:
    priority: int  # 0 = höchste Priorität
    channel_id: int = field(compare=False)
    data: Any = field(compare=False)

class PriorityChannelQueue:
    def __init__(self):
        self.queue = []
        self.priorities = {}  # channel_id -> priority
    
    def set_priority(self, channel_id: int, priority: int):
        """Setzt Priorität (0 = höchste, 100 = niedrigste)"""
        self.priorities[channel_id] = priority
    
    def add_channel(self, channel_id: int, data: Any):
        """Fügt Channel zur Queue hinzu"""
        priority = self.priorities.get(channel_id, 100)  # Default: niedrig
        item = PrioritizedChannel(priority, channel_id, data)
        heapq.heappush(self.queue, item)
    
    def get_next(self) -> tuple:
        """Holt nächsten Channel (höchste Priorität)"""
        if self.queue:
            item = heapq.heappop(self.queue)
            return item.channel_id, item.data
        return None, None
```

**Integration in `stream_checker_service.py`:**
```python
from priority_queue import PriorityChannelQueue

class StreamCheckerService:
    def __init__(self):
        self.priority_queue = PriorityChannelQueue()
        # Load priorities from channel settings
        self._load_channel_priorities()
    
    def _load_channel_priorities(self):
        """Load priorities from channel_settings.json"""
        channel_settings = get_channel_settings_manager()
        for channel_id in channel_settings._settings.keys():
            priority = channel_settings.get_priority(channel_id)
            self.priority_queue.set_priority(channel_id, priority)
    
    def add_to_queue(self, channel_id: int, ...):
        """Add channel to priority queue"""
        self.priority_queue.add_channel(channel_id, data)
    
    def _worker_loop(self):
        """Process channels by priority"""
        while True:
            channel_id, data = self.priority_queue.get_next()
            if channel_id is None:
                break
            # Process channel...
```

**UI Integration in `ChannelConfiguration.jsx`:**
```jsx
// Add Priority Input Field
<div className="space-y-2">
  <Label htmlFor="priority">Priority</Label>
  <Input
    id="priority"
    type="number"
    min="0"
    max="100"
    value={channelSettings?.priority ?? 50}
    onChange={(e) => updateSetting('priority', parseInt(e.target.value))}
  />
  <p className="text-xs text-muted-foreground">
    0 = highest priority, 100 = lowest (default: 50)
  </p>
</div>
```

**Erwartete Verbesserung:**
- Keine Zeitersparnis
- Bessere User-Erfahrung (wichtige Channels zuerst)
- Wichtige Channels: Sofort verarbeitet
- Unwichtige Channels: Später verarbeitet

---

## Implementation Reihenfolge

### Phase 1: Backend (2-3 Stunden)
1. ✅ Metadata Cache erstellen (`stream_metadata_cache.py`)
2. ⏳ Early Exit implementieren (Änderung in `stream_check_utils.py`)
3. ⏳ Parallel Regex implementieren (Änderung in `automated_stream_manager.py`)
4. ⏳ Priority Queue erstellen (`priority_queue.py`)

### Phase 2: Integration (1-2 Stunden)
5. ⏳ Cache in `analyze_stream()` integrieren
6. ⏳ Priority Queue in `stream_checker_service.py` integrieren
7. ⏳ Channel Settings erweitern um `priority` Feld

### Phase 3: Frontend (1 Stunde)
8. ⏳ Priority Input in `ChannelConfiguration.jsx` hinzufügen
9. ⏳ Cache Statistics in `StreamChecker.jsx` anzeigen

### Phase 4: Testing (1 Stunde)
10. ⏳ Early Exit testen
11. ⏳ Cache Hit/Miss Rate prüfen
12. ⏳ Parallel Regex Performance messen
13. ⏳ Priority Queue Reihenfolge verifizieren

---

## Erwartete Gesamt-Verbesserung

### Aktuell
```
Discover Streams: 228s
Stream Checking: 20 Min (100 Channels, 5 Workers)
Total: ~25 Min
```

### Nach Optimierungen
```
Discover Streams: 60s (-73%)
Stream Checking: 8 Min (-60%)
Total: ~9 Min (-64%)
```

**Von 25 Minuten auf 9 Minuten = 2.8x schneller!**

---

## Risiken & Mitigation

### Early Exit
- **Risiko:** Könnte zu früh abbrechen bei langsamen Streams
- **Mitigation:** Mindestens 3s warten + alle 4 Daten müssen vorhanden sein

### Metadata Cache
- **Risiko:** Veraltete Daten bei Stream-Änderungen
- **Mitigation:** 24h TTL + Force Check Option

### Parallel Regex
- **Risiko:** Race Conditions bei Shared State
- **Mitigation:** Jeder Worker hat eigene Datenstrukturen, Merge am Ende

### Priority Queue
- **Risiko:** Unwichtige Channels werden nie verarbeitet
- **Mitigation:** Alle Channels werden verarbeitet, nur Reihenfolge ändert sich

---

**Erstellt:** 2026-03-02
**Status:** In Progress
**Autor:** Kiro AI Assistant
