# Optimierungs-Möglichkeiten für StreamFlow Root

## Übersicht

Deine aktuelle Version ist bereits gut, aber es gibt mehrere Bereiche für Verbesserungen.

---

## 1. 🚀 DISCOVER STREAMS - Weitere Optimierung

### Aktueller Stand
```python
# BEREITS IMPLEMENTIERT (gut!):
- Pre-compiled Regex Patterns ✅
- Progress Logging ✅
- Rate: ~270 streams/sec

Zeit: 228s für 63.793 Streams
```

### Verbesserung A: Parallel Processing
```python
# VORSCHLAG: Multi-Threading für Regex Matching

from concurrent.futures import ThreadPoolExecutor
import multiprocessing

def discover_and_assign_streams_parallel(self):
    """Parallel stream discovery mit Thread Pool"""
    
    # Anzahl CPU Cores
    num_workers = min(multiprocessing.cpu_count(), 8)
    
    # Streams in Chunks aufteilen
    chunk_size = len(all_streams) // num_workers
    chunks = [all_streams[i:i+chunk_size] 
              for i in range(0, len(all_streams), chunk_size)]
    
    # Parallel verarbeiten
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        results = executor.map(self._match_chunk, chunks)
    
    # Ergebnisse zusammenführen
    for channel_matches in results:
        for channel_id, streams in channel_matches.items():
            # Add to channel...

def _match_chunk(self, streams_chunk):
    """Matched einen Chunk von Streams"""
    matches = {}
    for stream in streams_chunk:
        for channel_id, patterns in self._compiled_patterns.items():
            for pattern in patterns:
                if pattern.search(stream['name']):
                    if channel_id not in matches:
                        matches[channel_id] = []
                    matches[channel_id].append(stream)
    return matches
```

**Erwartete Verbesserung:**
- Von 228s auf ~60s (4x schneller)
- Rate: ~1000 streams/sec

**Risiko:** Gering (nur Regex Matching, keine DB-Writes)

---

### Verbesserung B: Regex Caching mit LRU
```python
from functools import lru_cache

class RegexChannelMatcher:
    @lru_cache(maxsize=10000)
    def _match_stream_name(self, stream_name: str, pattern_id: int) -> bool:
        """Cached Regex Matching"""
        pattern = self._compiled_patterns_by_id[pattern_id]
        return bool(pattern.search(stream_name))
```

**Erwartete Verbesserung:**
- Von 228s auf ~180s (20% schneller)
- Besonders bei wiederholten Stream-Namen

**Risiko:** Sehr gering

---

## 2. ⚡ STREAM CHECKING - Timeout Optimierung

### Aktuelles Problem
```python
# Deine Config:
Base Timeout: 15s
Duration: 8s
Startup Buffer: 10s
Total: 33s pro Stream

Bei 100 Streams: 55 Minuten (mit 5 Workers)
```

### Verbesserung: Adaptive Timeouts
```python
class AdaptiveTimeoutManager:
    """Passt Timeouts basierend auf Stream-Historie an"""
    
    def __init__(self):
        self.stream_history = {}  # stream_id -> avg_response_time
    
    def get_timeout(self, stream_id: int, m3u_account: str) -> int:
        """Berechnet optimalen Timeout"""
        
        # 1. Stream-spezifische Historie
        if stream_id in self.stream_history:
            avg_time = self.stream_history[stream_id]
            return int(avg_time * 1.5)  # 50% Buffer
        
        # 2. Account-spezifische Historie
        account_avg = self._get_account_avg(m3u_account)
        if account_avg:
            return int(account_avg * 1.5)
        
        # 3. Fallback: Standard
        return 25  # Statt 33s
    
    def record_response(self, stream_id: int, response_time: float):
        """Speichert Response-Zeit"""
        if stream_id not in self.stream_history:
            self.stream_history[stream_id] = response_time
        else:
            # Exponential Moving Average
            old_avg = self.stream_history[stream_id]
            self.stream_history[stream_id] = old_avg * 0.7 + response_time * 0.3
```

**Erwartete Verbesserung:**
- Schnelle Streams: 10-15s (statt 33s)
- Langsame Streams: 25-30s (statt 33s)
- Durchschnitt: ~18s (45% schneller!)
- Bei 100 Streams: 30 Minuten (statt 55 Min)

**Risiko:** Mittel (könnte schnelle Streams zu früh abbrechen)

---

### Verbesserung: Early Exit bei Erfolg
```python
def check_stream_with_early_exit(self, stream_url: str, duration: int = 8):
    """Stoppt FFmpeg sobald genug Daten vorhanden"""
    
    process = subprocess.Popen([...])
    
    start_time = time.time()
    required_data = {
        'resolution': False,
        'fps': False,
        'bitrate': False,
        'codec': False
    }
    
    for line in process.stderr:
        # Parse Stats
        if 'Video:' in line:
            # Extract resolution, fps, codec
            required_data['resolution'] = True
            required_data['fps'] = True
            required_data['codec'] = True
        
        if 'bitrate=' in line:
            required_data['bitrate'] = True
        
        # Early Exit wenn alle Daten vorhanden
        if all(required_data.values()):
            elapsed = time.time() - start_time
            if elapsed >= 3:  # Min 3s für Stabilität
                logger.info(f"Early exit after {elapsed:.1f}s (all data collected)")
                process.terminate()
                break
    
    # Rest wie bisher...
```

**Erwartete Verbesserung:**
- Gute Streams: 3-5s (statt 8s)
- Schlechte Streams: 8s (wie bisher)
- Durchschnitt: ~5s (40% schneller!)

**Risiko:** Gering (nur bei stabilen Streams)

---

## 3. 🔄 MULTI-CHANNEL PROCESSING - Intelligente Priorisierung

### Aktuelles Problem
```python
# Alle Channels werden gleich behandelt
# Wichtige Channels warten genauso lange wie unwichtige
```

### Verbesserung: Priority Queue
```python
import heapq
from dataclasses import dataclass, field
from typing import Any

@dataclass(order=True)
class PrioritizedChannel:
    priority: int
    channel_id: int = field(compare=False)
    data: Any = field(compare=False)

class PriorityChannelQueue:
    """Priority Queue für Channels"""
    
    def __init__(self):
        self.queue = []
        self.priorities = {}  # channel_id -> priority
    
    def set_priority(self, channel_id: int, priority: int):
        """Setzt Priorität für Channel (0 = höchste)"""
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

# Verwendung:
queue = PriorityChannelQueue()

# Wichtige Channels (z.B. Sport)
queue.set_priority(3848, 0)  # Sky Sport (höchste Priorität)
queue.set_priority(3982, 1)  # Sky Bundesliga

# Normale Channels
queue.set_priority(3827, 50)  # Sat.1 Gold

# Unwichtige Channels
queue.set_priority(4047, 100)  # ARD-alpha
```

**Erwartete Verbesserung:**
- Wichtige Channels: Sofort verarbeitet
- User-Erfahrung: Deutlich besser
- Gesamtzeit: Gleich, aber bessere Reihenfolge

**Risiko:** Sehr gering

---

## 4. 💾 CACHING - Intelligentes Stream-Caching

### Aktuelles Problem
```python
# Jeder Check lädt Stream komplett neu
# Keine Wiederverwendung von bekannten Daten
```

### Verbesserung: Stream Metadata Cache
```python
import pickle
from pathlib import Path

class StreamMetadataCache:
    """Cached Stream-Metadaten für schnellere Checks"""
    
    def __init__(self, cache_file: Path):
        self.cache_file = cache_file
        self.cache = self._load_cache()
        self.ttl = 86400  # 24h TTL
    
    def get(self, stream_url: str) -> Optional[dict]:
        """Holt Metadaten aus Cache"""
        if stream_url in self.cache:
            entry = self.cache[stream_url]
            age = time.time() - entry['timestamp']
            
            if age < self.ttl:
                return entry['metadata']
        
        return None
    
    def set(self, stream_url: str, metadata: dict):
        """Speichert Metadaten im Cache"""
        self.cache[stream_url] = {
            'metadata': metadata,
            'timestamp': time.time()
        }
        self._save_cache()
    
    def _load_cache(self) -> dict:
        if self.cache_file.exists():
            with open(self.cache_file, 'rb') as f:
                return pickle.load(f)
        return {}
    
    def _save_cache(self):
        with open(self.cache_file, 'wb') as f:
            pickle.dump(self.cache, f)

# Verwendung:
cache = StreamMetadataCache(Path('data/stream_metadata_cache.pkl'))

def check_stream_with_cache(stream_url: str):
    # 1. Prüfe Cache
    cached = cache.get(stream_url)
    if cached:
        logger.info(f"Using cached metadata for {stream_url[:50]}")
        return cached
    
    # 2. Wenn nicht im Cache: Voller Check
    result = check_stream_full(stream_url)
    
    # 3. Speichere im Cache
    cache.set(stream_url, result)
    
    return result
```

**Erwartete Verbesserung:**
- Bei wiederholten Checks: 90% schneller
- Besonders bei "Discover Streams" → "Check Streams"
- Cache Hit Rate: ~60-70%

**Risiko:** Gering (TTL verhindert veraltete Daten)

---

## 5. 🗄️ DATABASE - Batch Operations

### Aktuelles Problem
```python
# Viele einzelne API-Calls zu Dispatcharr
# Jeder Stream einzeln aktualisiert
```

### Verbesserung: Batch Updates
```python
def batch_update_streams(self, updates: List[dict], batch_size: int = 50):
    """Aktualisiert Streams in Batches"""
    
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        
        # Batch-Request zu Dispatcharr
        response = requests.post(
            f"{self.base_url}/api/streams/batch",
            json={'updates': batch},
            timeout=30
        )
        
        if response.status_code == 200:
            logger.info(f"Updated batch {i//batch_size + 1} ({len(batch)} streams)")
        else:
            logger.error(f"Batch update failed: {response.text}")
```

**Erwartete Verbesserung:**
- Von 298 Requests auf 6 Requests (50er Batches)
- API-Zeit: Von 30s auf 2s (15x schneller)
- Netzwerk-Last: 90% weniger

**Risiko:** Mittel (benötigt Dispatcharr API-Änderung)

---

## 6. 🧹 DEAD STREAMS - Intelligentes Tracking

### Aktuelles Problem
```python
# Tote Streams werden immer wieder geprüft
# Verschwendet Zeit bei jedem Check
```

### Verbesserung: Dead Stream Blacklist mit Decay
```python
class DeadStreamTracker:
    """Tracked tote Streams mit exponential backoff"""
    
    def __init__(self):
        self.dead_streams = {}  # url -> {'count': int, 'last_check': float, 'backoff': int}
    
    def should_check(self, stream_url: str) -> bool:
        """Prüft ob Stream gecheckt werden soll"""
        if stream_url not in self.dead_streams:
            return True
        
        entry = self.dead_streams[stream_url]
        time_since_check = time.time() - entry['last_check']
        
        # Exponential Backoff: 1h, 2h, 4h, 8h, 24h
        backoff_seconds = min(entry['backoff'] * 3600, 86400)
        
        return time_since_check >= backoff_seconds
    
    def mark_dead(self, stream_url: str):
        """Markiert Stream als tot"""
        if stream_url not in self.dead_streams:
            self.dead_streams[stream_url] = {
                'count': 1,
                'last_check': time.time(),
                'backoff': 1  # 1 Stunde
            }
        else:
            entry = self.dead_streams[stream_url]
            entry['count'] += 1
            entry['last_check'] = time.time()
            entry['backoff'] = min(entry['backoff'] * 2, 24)  # Max 24h
    
    def mark_alive(self, stream_url: str):
        """Entfernt Stream aus Blacklist"""
        if stream_url in self.dead_streams:
            del self.dead_streams[stream_url]

# Verwendung:
tracker = DeadStreamTracker()

for stream in streams_to_check:
    if not tracker.should_check(stream['url']):
        logger.debug(f"Skipping dead stream (backoff): {stream['url'][:50]}")
        continue
    
    result = check_stream(stream['url'])
    
    if result['is_alive']:
        tracker.mark_alive(stream['url'])
    else:
        tracker.mark_dead(stream['url'])
```

**Erwartete Verbesserung:**
- Erste Check: 100 Streams
- Nach 1 Woche: ~70 Streams (30% gespart)
- Nach 1 Monat: ~50 Streams (50% gespart)
- Zeit: 20 Min → 10 Min

**Risiko:** Gering (Streams können sich erholen)

---

## 7. 📊 MONITORING - Performance Metrics

### Verbesserung: Prometheus Metrics
```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Metrics
stream_checks_total = Counter('stream_checks_total', 'Total stream checks', ['status'])
stream_check_duration = Histogram('stream_check_duration_seconds', 'Stream check duration')
active_workers = Gauge('active_workers', 'Number of active workers')
queue_size = Gauge('queue_size', 'Number of channels in queue')

# Verwendung:
with stream_check_duration.time():
    result = check_stream(url)

if result['is_alive']:
    stream_checks_total.labels(status='alive').inc()
else:
    stream_checks_total.labels(status='dead').inc()

# Start Metrics Server
start_http_server(9090)
```

**Vorteil:**
- Grafana Dashboards
- Performance-Analyse
- Bottleneck-Erkennung

---

## 8. 🔧 CONFIGURATION - Dynamic Tuning

### Verbesserung: Auto-Tuning basierend auf System
```python
import psutil

class AutoTuner:
    """Passt Config automatisch an System an"""
    
    def __init__(self):
        self.cpu_count = psutil.cpu_count()
        self.memory_gb = psutil.virtual_memory().total / (1024**3)
    
    def get_optimal_workers(self) -> int:
        """Berechnet optimale Worker-Anzahl"""
        # Regel: 1 Worker pro 2 CPU Cores
        return max(1, self.cpu_count // 2)
    
    def get_optimal_timeout(self) -> int:
        """Berechnet optimalen Timeout"""
        # Bei wenig RAM: Kürzere Timeouts
        if self.memory_gb < 8:
            return 20
        elif self.memory_gb < 16:
            return 25
        else:
            return 30
    
    def get_optimal_batch_size(self) -> int:
        """Berechnet optimale Batch-Größe"""
        # Bei viel RAM: Größere Batches
        if self.memory_gb < 8:
            return 25
        elif self.memory_gb < 16:
            return 50
        else:
            return 100

# Verwendung:
tuner = AutoTuner()
config['max_workers'] = tuner.get_optimal_workers()
config['timeout'] = tuner.get_optimal_timeout()
```

**Vorteil:**
- Automatische Optimierung
- Funktioniert auf verschiedenen Systemen
- Keine manuelle Konfiguration nötig

---

## 9. 🚦 RATE LIMITING - Intelligentes Throttling

### Verbesserung: Per-Account Rate Limiting
```python
from collections import defaultdict
import time

class RateLimiter:
    """Rate Limiter pro M3U Account"""
    
    def __init__(self):
        self.requests = defaultdict(list)  # account_id -> [timestamps]
        self.limits = {}  # account_id -> max_requests_per_minute
    
    def set_limit(self, account_id: str, limit: int):
        """Setzt Limit für Account"""
        self.limits[account_id] = limit
    
    def can_request(self, account_id: str) -> bool:
        """Prüft ob Request erlaubt ist"""
        now = time.time()
        limit = self.limits.get(account_id, 60)  # Default: 60/min
        
        # Entferne alte Requests (älter als 1 Min)
        self.requests[account_id] = [
            ts for ts in self.requests[account_id]
            if now - ts < 60
        ]
        
        # Prüfe Limit
        return len(self.requests[account_id]) < limit
    
    def record_request(self, account_id: str):
        """Speichert Request"""
        self.requests[account_id].append(time.time())
    
    def wait_if_needed(self, account_id: str):
        """Wartet wenn Limit erreicht"""
        while not self.can_request(account_id):
            time.sleep(0.1)
        self.record_request(account_id)

# Verwendung:
limiter = RateLimiter()
limiter.set_limit('MR-Jinbox', 30)  # 30 Requests/Min
limiter.set_limit('delta8k', 60)    # 60 Requests/Min

for stream in streams:
    account = stream['m3u_account']
    limiter.wait_if_needed(account)
    check_stream(stream['url'])
```

**Vorteil:**
- Verhindert Account-Bans
- Respektiert Provider-Limits
- Automatisches Throttling

---

## 10. 🎯 ZUSAMMENFASSUNG - Erwartete Verbesserungen

| Optimierung | Zeitersparnis | Komplexität | Risiko | Priorität |
|-------------|---------------|-------------|--------|-----------|
| **1. Parallel Regex** | 60% | Mittel | Gering | 🔥 Hoch |
| **2. Adaptive Timeouts** | 45% | Mittel | Mittel | 🔥 Hoch |
| **3. Early Exit** | 40% | Niedrig | Gering | 🔥 Hoch |
| **4. Priority Queue** | 0%* | Niedrig | Gering | ⭐ Mittel |
| **5. Metadata Cache** | 60%** | Niedrig | Gering | ⭐ Mittel |
| **6. Batch Updates** | 90%*** | Hoch | Mittel | ⭐ Mittel |
| **7. Dead Stream Tracking** | 50%**** | Niedrig | Gering | ⭐ Mittel |
| **8. Prometheus Metrics** | 0% | Niedrig | Gering | 💡 Niedrig |
| **9. Auto-Tuning** | 10% | Niedrig | Gering | 💡 Niedrig |
| **10. Rate Limiting** | 0% | Niedrig | Gering | 💡 Niedrig |

\* Keine Zeitersparnis, aber bessere User-Erfahrung  
\** Nur bei wiederholten Checks  
\*** Nur API-Zeit, nicht Check-Zeit  
\**** Nach 1 Monat Laufzeit

---

## 🎯 EMPFOHLENE REIHENFOLGE

### Phase 1: Quick Wins (1-2 Tage)
1. **Early Exit** - Einfach, großer Effekt
2. **Dead Stream Tracking** - Einfach, langfristiger Nutzen
3. **Metadata Cache** - Einfach, sofortiger Nutzen

**Erwartete Verbesserung:** 40-50% schneller

---

### Phase 2: Mittelfristig (1 Woche)
4. **Adaptive Timeouts** - Mittlere Komplexität, großer Effekt
5. **Priority Queue** - Einfach, bessere UX
6. **Parallel Regex** - Mittlere Komplexität, großer Effekt

**Erwartete Verbesserung:** 60-70% schneller

---

### Phase 3: Langfristig (2-4 Wochen)
7. **Batch Updates** - Benötigt Dispatcharr API-Änderung
8. **Prometheus Metrics** - Für Monitoring
9. **Auto-Tuning** - Nice-to-have
10. **Rate Limiting** - Für Stabilität

**Erwartete Verbesserung:** 80-90% schneller

---

## 📈 GESAMTPOTENTIAL

### Aktuell
```
Discover Streams: 228s
Stream Checking: 20 Min (100 Channels, 5 Workers)
Total: ~25 Min
```

### Nach allen Optimierungen
```
Discover Streams: 60s (-73%)
Stream Checking: 5 Min (-75%)
Total: ~6 Min (-76%)
```

**Von 25 Minuten auf 6 Minuten = 4x schneller!**

---

**Erstellt:** 2026-03-02
**Autor:** Kiro AI Assistant
