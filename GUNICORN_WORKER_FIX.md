# Gunicorn Multi-Worker State Problem - Fix

## Problem

Wenn Gunicorn mit mehreren Workern läuft (Standard: 4), hat jeder Worker seinen eigenen Speicher und State. Das führt zu:

- **Progress-Bars springen wild hin und her**
- **Status-Informationen sind inkonsistent**
- **Stream-Checker-Status zeigt falsche Werte**

### Warum?

```
Request 1 → Worker 1 (Progress: 50%)
Request 2 → Worker 2 (Progress: 0% - weiß nichts von Worker 1)
Request 3 → Worker 3 (Progress: 75%)
Request 4 → Worker 1 (Progress: 50%)
```

Jeder Worker hat seine eigene Instanz von `stream_checker_service` mit eigenem State!

## Lösung 1: Single Worker (Empfohlen für kleine/mittlere Setups)

### Option A: Via docker-compose.yml

```yaml
services:
  stream-checker:
    environment:
      - GUNICORN_WORKERS=1  # Nur 1 Worker
      - GUNICORN_THREADS=4  # Mehr Threads für Parallelität
```

### Option B: Via .env File

```bash
# .env
GUNICORN_WORKERS=1
GUNICORN_THREADS=4
```

### Vorteile:
- ✅ Sofort funktionsfähig
- ✅ Keine Code-Änderungen nötig
- ✅ State bleibt konsistent
- ✅ Ausreichend für die meisten Setups

### Nachteile:
- ⚠️ Weniger CPU-Auslastung bei vielen gleichzeitigen Requests
- ⚠️ Ein Worker-Crash = kompletter Service down

## Lösung 2: Shared State mit Redis (Für große Setups)

Für Production-Umgebungen mit hoher Last sollte ein Shared State implementiert werden.

### Implementierung:

1. **Redis hinzufügen zu docker-compose.yml:**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  stream-checker:
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379/0
      - GUNICORN_WORKERS=4

volumes:
  redis-data:
```

2. **State-Manager mit Redis erstellen:**

```python
# backend/shared_state.py
import redis
import json
from typing import Any, Optional

class SharedState:
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis = redis.from_url(redis_url, decode_responses=True)
    
    def set_progress(self, data: dict, ttl: int = 300):
        """Store progress data with TTL"""
        self.redis.setex(
            "stream_checker:progress",
            ttl,
            json.dumps(data)
        )
    
    def get_progress(self) -> Optional[dict]:
        """Get current progress"""
        data = self.redis.get("stream_checker:progress")
        return json.loads(data) if data else None
    
    def set_status(self, data: dict, ttl: int = 300):
        """Store status data with TTL"""
        self.redis.setex(
            "stream_checker:status",
            ttl,
            json.dumps(data)
        )
    
    def get_status(self) -> Optional[dict]:
        """Get current status"""
        data = self.redis.get("stream_checker:status")
        return json.loads(data) if data else None
```

3. **Stream Checker Service anpassen:**

```python
# In stream_checker_service.py
from shared_state import SharedState

class StreamCheckerService:
    def __init__(self):
        self.shared_state = SharedState()
        # ... rest of init
    
    def get_status(self):
        # Return from Redis instead of local state
        return self.shared_state.get_status() or self._build_default_status()
    
    def update_progress(self, progress_data):
        # Store in Redis
        self.shared_state.set_progress(progress_data)
```

### Vorteile:
- ✅ Volle Multi-Worker-Unterstützung
- ✅ Konsistenter State über alle Worker
- ✅ Bessere Skalierbarkeit
- ✅ Worker-Crashes beeinflussen State nicht

### Nachteile:
- ⚠️ Zusätzliche Abhängigkeit (Redis)
- ⚠️ Mehr Komplexität
- ⚠️ Leichte Performance-Overhead

## Empfehlung

**Für die meisten Setups: Lösung 1 (Single Worker)**

Dein Setup verarbeitet bereits:
- 10 Channels parallel
- 60 Stream-Worker
- 4 Regex-Worker

Das ist bereits massiv parallel! Ein einzelner Gunicorn-Worker mit mehreren Threads reicht völlig aus für die API-Requests.

**Nur wenn du >100 gleichzeitige API-Requests hast: Lösung 2 (Redis)**

## Schnell-Fix (Jetzt anwenden)

```bash
# In docker-compose.yml hinzufügen:
environment:
  - GUNICORN_WORKERS=1
  - GUNICORN_THREADS=4

# Dann:
docker-compose down
docker-compose up -d
```

Das sollte das Problem sofort beheben!
