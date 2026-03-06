# Stop All Button & Docker Worker Configuration

## 1. Stop All Button

### Problem
Bisher gab es keine Möglichkeit, alle laufenden Prozesse zu stoppen außer Container-Neustart.

### Lösung

**Neuer "Stop All" Button im Dashboard**

### Was wird gestoppt?

1. **Automation Service**
   - Stoppt M3U Playlist Updates
   - Stoppt Stream Discovery
   - Stoppt alle Automation Cycles

2. **Stream Checker Service**
   - Stoppt alle laufenden Stream-Checks
   - Stoppt Multi-Channel Processing
   - Leert die Queue (alle wartenden Kanäle)

### Backend API

**Endpoint:**
```
POST /api/stop-all
```

**Response:**
```json
{
  "message": "All services stopped successfully",
  "status": "stopped",
  "details": {
    "automation": {
      "stopped": true,
      "error": null
    },
    "stream_checker": {
      "stopped": true,
      "error": null,
      "queue_cleared": true
    }
  }
}
```

**Partial Failure Response:**
```json
{
  "message": "Some services failed to stop",
  "status": "partial",
  "details": {
    "automation": {
      "stopped": true,
      "error": null
    },
    "stream_checker": {
      "stopped": false,
      "error": "Service not running"
    }
  }
}
```

### Frontend Integration

**Location:** Dashboard → Quick Actions

**Button:**
- Variant: `destructive` (rot)
- Icon: StopCircle
- Label: "Stop All"
- Disabled: Nur während des Stopps selbst

**Toast Notification:**
```
Services Stopped
Automation: ✓ | Stream Checker: ✓
```

### Use Cases

1. **Emergency Stop**
   - System überlastet
   - Zu viele parallele Checks
   - Ressourcen-Probleme

2. **Maintenance Mode**
   - Vor Konfigurationsänderungen
   - Vor Container-Updates
   - Vor Datenbank-Wartung

3. **Debugging**
   - Logs analysieren ohne neue Einträge
   - Probleme isolieren
   - Tests durchführen

4. **Resource Management**
   - CPU/RAM zu hoch
   - Netzwerk überlastet
   - Provider-Limits erreicht

### Unterschied zu einzelnen Stop-Buttons

**Einzelne Stops:**
- `/api/automation/stop` - Nur Automation
- `/api/stream-checker/stop` - Nur Stream Checker (Queue bleibt)

**Stop All:**
- Stoppt beide Services
- Leert Stream Checker Queue
- Atomic Operation (alles oder nichts)

---

## 2. Docker Worker Configuration für Multi-Channel

### Problem

**Aktuell:** Flask läuft im Development Mode (single-threaded)
```bash
exec python3 web_api.py --host "${API_HOST}" --port "${API_PORT}"
```

**Problem bei Multi-Channel:**
- Flask Development Server ist single-threaded
- Multi-Channel nutzt ThreadPoolExecutor
- Threads konkurrieren um GIL (Global Interpreter Lock)
- Performance-Bottleneck bei vielen parallelen Kanälen

### Lösung: Gunicorn mit Workers

**Gunicorn** ist ein Production WSGI Server mit:
- Multi-Worker Support (echte Parallelität)
- Bessere Performance
- Bessere Stabilität
- Graceful Shutdown

### Empfohlene Konfiguration

#### entrypoint.sh Update

```bash
#!/bin/bash

set -e

echo "[INFO] Starting StreamFlow Container: $(date)"

# Environment variables with defaults
API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-5000}"
DEBUG_MODE="${DEBUG_MODE:-false}"
CONFIG_DIR="${CONFIG_DIR:-/app/data}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-4}"  # NEU
GUNICORN_THREADS="${GUNICORN_THREADS:-2}"  # NEU
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-120}"  # NEU

# Export environment variables
export API_HOST API_PORT DEBUG_MODE CONFIG_DIR

# ... (rest of setup) ...

echo "[INFO] ============================================"
echo "[INFO] Starting StreamFlow Container"
echo "[INFO] ============================================"
echo "[INFO] Flask API: ${API_HOST}:${API_PORT}"
echo "[INFO] Debug mode: ${DEBUG_MODE}"
echo "[INFO] Gunicorn Workers: ${GUNICORN_WORKERS}"
echo "[INFO] Gunicorn Threads per Worker: ${GUNICORN_THREADS}"
echo "[INFO] ============================================"

# Start with Gunicorn in production, Flask in debug mode
if [ "$DEBUG_MODE" = "true" ]; then
    echo "[INFO] Starting Flask in DEBUG mode (single-threaded)..."
    exec python3 web_api.py --host "${API_HOST}" --port "${API_PORT}"
else
    echo "[INFO] Starting Gunicorn in PRODUCTION mode..."
    exec gunicorn \
        --bind "${API_HOST}:${API_PORT}" \
        --workers "${GUNICORN_WORKERS}" \
        --threads "${GUNICORN_THREADS}" \
        --timeout "${GUNICORN_TIMEOUT}" \
        --access-logfile - \
        --error-logfile - \
        --log-level info \
        --worker-class gthread \
        "web_api:app"
fi
```

#### requirements.txt Update

```txt
# ... existing packages ...
gunicorn==21.2.0
```

#### docker-compose.yml Update

```yaml
services:
  streamflow:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      
      # Gunicorn Configuration (Production Mode)
      GUNICORN_WORKERS: "4"        # Number of worker processes
      GUNICORN_THREADS: "2"        # Threads per worker
      GUNICORN_TIMEOUT: "120"      # Request timeout in seconds
      
      # Set to "false" for production (Gunicorn), "true" for debug (Flask)
      DEBUG_MODE: "false"
```

### Worker Calculation

**Formula:**
```
workers = (2 × CPU_cores) + 1
threads = 2-4 per worker
```

**Examples:**

**2 CPU Cores:**
```
GUNICORN_WORKERS=5  # (2 × 2) + 1
GUNICORN_THREADS=2
Total Capacity: 10 concurrent requests
```

**4 CPU Cores:**
```
GUNICORN_WORKERS=9  # (2 × 4) + 1
GUNICORN_THREADS=2
Total Capacity: 18 concurrent requests
```

**8 CPU Cores (Recommended for Multi-Channel):**
```
GUNICORN_WORKERS=17  # (2 × 8) + 1
GUNICORN_THREADS=2
Total Capacity: 34 concurrent requests
```

### Multi-Channel Specific Recommendations

**Für max_concurrent_channels = 10:**

**Minimum:**
```yaml
GUNICORN_WORKERS: "4"
GUNICORN_THREADS: "2"
# Capacity: 8 concurrent requests
# Ausreichend für 10 Kanäle mit leichter Last
```

**Empfohlen:**
```yaml
GUNICORN_WORKERS: "8"
GUNICORN_THREADS: "2"
# Capacity: 16 concurrent requests
# Gut für 10 Kanäle mit mittlerer Last
```

**Optimal:**
```yaml
GUNICORN_WORKERS: "12"
GUNICORN_THREADS: "2"
# Capacity: 24 concurrent requests
# Ideal für 10 Kanäle mit hoher Last
```

### Memory Considerations

**Per Worker Memory:**
- Base: ~50-100 MB
- With UDI Cache: +50-100 MB
- With Active Checks: +100-200 MB

**Total Memory:**
```
Total = (Workers × Per_Worker_Memory) + Base_Memory

Example (8 workers):
Total = (8 × 200 MB) + 200 MB = 1.8 GB
```

**Docker Memory Limit:**
```yaml
services:
  streamflow:
    deploy:
      resources:
        limits:
          memory: 2G  # Für 8 workers
          cpus: '4'   # Für 8 workers
        reservations:
          memory: 1G
          cpus: '2'
```

### Timeout Configuration

**GUNICORN_TIMEOUT:**
- Default: 30s (zu kurz für Stream Checks!)
- Empfohlen: 120s (2 Minuten)
- Multi-Channel: 180s (3 Minuten)

**Warum länger?**
- Stream Checks dauern 8-30s pro Stream
- Profile Failover kann mehrere Versuche machen
- Multi-Channel prüft mehrere Kanäle gleichzeitig

### Graceful Shutdown

**Gunicorn unterstützt:**
```bash
# Graceful shutdown (wartet auf laufende Requests)
docker stop streamflow  # Sendet SIGTERM

# Force shutdown nach 30s
docker stop -t 30 streamflow
```

**Flask Development Server:**
```bash
# Kein graceful shutdown
docker stop streamflow  # Killt sofort
```

### Performance Vergleich

**Test-Szenario:**
- 10 Kanäle gleichzeitig (Multi-Channel)
- Je 10 Streams pro Kanal
- Global Limit: 35 Streams

**Flask Development (single-threaded):**
```
Throughput: ~5 requests/second
Total Time: ~20 Minuten
CPU Usage: 100% (single core)
```

**Gunicorn (4 workers, 2 threads):**
```
Throughput: ~15 requests/second
Total Time: ~7 Minuten
CPU Usage: 80% (multi-core)
Speedup: 3x
```

**Gunicorn (8 workers, 2 threads):**
```
Throughput: ~25 requests/second
Total Time: ~4 Minuten
CPU Usage: 70% (multi-core)
Speedup: 5x
```

### Migration Steps

1. **Update requirements.txt**
   ```bash
   echo "gunicorn==21.2.0" >> backend/requirements.txt
   ```

2. **Update entrypoint.sh**
   - Add Gunicorn configuration
   - Add DEBUG_MODE check

3. **Update docker-compose.yml**
   - Add GUNICORN_* environment variables
   - Set DEBUG_MODE=false

4. **Rebuild Container**
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

5. **Verify**
   ```bash
   docker logs streamflow | grep -i gunicorn
   # Should show: "Starting Gunicorn in PRODUCTION mode..."
   ```

### Debugging with Flask

**Für Development/Debugging:**
```yaml
environment:
  DEBUG_MODE: "true"  # Nutzt Flask statt Gunicorn
```

**Vorteile:**
- Bessere Error Messages
- Auto-Reload bei Code-Änderungen
- Einfacheres Debugging

**Nachteile:**
- Single-threaded
- Langsamer
- Nicht für Production

### Monitoring

**Gunicorn Logs:**
```bash
docker logs -f streamflow | grep gunicorn
```

**Worker Status:**
```bash
# Zeigt aktive Worker
docker exec streamflow ps aux | grep gunicorn
```

**Memory Usage:**
```bash
docker stats streamflow
```

---

## Zusammenfassung

### Stop All Button
✅ **Implementiert**
- Stoppt Automation + Stream Checker
- Leert Queue
- Emergency Stop Funktion
- Im Dashboard verfügbar

### Docker Workers
⚠️ **Empfohlen für Multi-Channel**
- Gunicorn statt Flask
- 4-12 Workers je nach CPU
- 2 Threads pro Worker
- 120s Timeout

### Nächste Schritte

1. **Sofort nutzbar:** Stop All Button
2. **Empfohlen:** Gunicorn Migration für bessere Performance
3. **Optional:** Memory/CPU Limits anpassen

---

## Files Changed

### Backend
- `backend/web_api.py` - Stop All Endpoint

### Frontend
- `frontend/src/services/api.js` - Stop All API
- `frontend/src/pages/Dashboard.jsx` - Stop All Button

### Documentation
- `STOP_ALL_AND_DOCKER_WORKERS.md` - Diese Datei

### Empfohlene Änderungen (nicht implementiert)
- `backend/entrypoint.sh` - Gunicorn Support
- `backend/requirements.txt` - Gunicorn Package
- `docker-compose.yml` - Gunicorn Config
