# Gunicorn Production Server - Implementation Complete

## What Changed

StreamFlow now uses **Gunicorn** as the production server instead of Flask's development server.

## Benefits

✅ **Multi-worker support** - Handle multiple requests simultaneously
✅ **Production-ready** - Stable and battle-tested
✅ **Better performance** - Thread pooling and worker processes
✅ **Graceful shutdowns** - Proper signal handling

## Configuration

### Environment Variables

```bash
# Server Configuration
DEBUG_MODE=false              # false = Gunicorn (production), true = Flask dev server
GUNICORN_WORKERS=4            # Number of worker processes (default: 4)
GUNICORN_THREADS=2            # Threads per worker (default: 2)
GUNICORN_TIMEOUT=120          # Request timeout in seconds (default: 120)

# API Configuration (unchanged)
API_HOST=0.0.0.0
API_PORT=5000
```

### Recommended Settings

**For Production:**
```bash
DEBUG_MODE=false
GUNICORN_WORKERS=4           # CPU cores * 2 + 1 (recommended)
GUNICORN_THREADS=2           # 2-4 threads per worker
GUNICORN_TIMEOUT=120         # Increase if stream checks take longer
```

**For Development:**
```bash
DEBUG_MODE=true              # Uses Flask dev server with auto-reload
```

## Worker Calculation

**Formula:** `workers = (2 * CPU_cores) + 1`

Examples:
- 2 CPU cores → 5 workers
- 4 CPU cores → 9 workers
- 8 CPU cores → 17 workers

**Note:** More workers = more memory usage. Start with 4 and adjust based on load.

## How It Works

### Production Mode (DEBUG_MODE=false)
```
Container Start
    ↓
Gunicorn starts with N workers
    ↓
Each worker runs Flask app
    ↓
Requests distributed across workers
    ↓
Concurrent request handling
```

### Development Mode (DEBUG_MODE=true)
```
Container Start
    ↓
Flask development server
    ↓
Single-threaded
    ↓
Auto-reload on code changes
```

## Deployment

### Docker Compose

```yaml
services:
  streamflow:
    environment:
      - DEBUG_MODE=false
      - GUNICORN_WORKERS=4
      - GUNICORN_THREADS=2
      - GUNICORN_TIMEOUT=120
```

### Rebuild Container

```bash
# Stop container
docker-compose down

# Rebuild with new dependencies
docker-compose build

# Start with Gunicorn
docker-compose up -d
```

## Monitoring

### Check Logs

```bash
# View Gunicorn startup
docker-compose logs streamflow | grep "Starting Gunicorn"

# View worker info
docker-compose logs streamflow | grep "Workers:"

# View access logs
docker-compose logs -f streamflow
```

### Expected Output

```
[INFO] Starting StreamFlow Container
[INFO] Server: Gunicorn (production)
[INFO] Workers: 4
[INFO] Threads per worker: 2
[INFO] Timeout: 120s
[INFO] Starting Gunicorn...
[INFO] Listening at: http://0.0.0.0:5000
[INFO] Using worker: gthread
[INFO] Booting worker with pid: 123
[INFO] Booting worker with pid: 124
[INFO] Booting worker with pid: 125
[INFO] Booting worker with pid: 126
```

## Troubleshooting

### Workers Crashing

**Symptom:** Workers restart frequently

**Solution:**
- Reduce `GUNICORN_WORKERS`
- Increase container memory
- Check for memory leaks

### Slow Responses

**Symptom:** Requests timeout

**Solution:**
- Increase `GUNICORN_TIMEOUT`
- Add more workers
- Check stream check duration

### High Memory Usage

**Symptom:** Container uses too much RAM

**Solution:**
- Reduce `GUNICORN_WORKERS`
- Reduce `GUNICORN_THREADS`
- Monitor with `docker stats`

## Performance Comparison

### Before (Flask Dev Server)
- ❌ Single-threaded
- ❌ 1 request at a time
- ❌ Not production-ready
- ⚠️ Slow under load

### After (Gunicorn)
- ✅ Multi-worker (4 workers default)
- ✅ Multi-threaded (2 threads per worker)
- ✅ 8 concurrent requests (4 workers × 2 threads)
- ✅ Production-ready
- ✅ Fast under load

## Retry Configuration

### Frontend Update

The frontend now allows setting **Retries to 0** (recommended with Profile Failover):

```
Retry Attempts: 0 (min: 0, recommended with Profile Failover)
```

### Why Retries = 0 with Profile Failover?

**Without Profile Failover:**
- Retries = 1 → Test same stream 2 times
- If stream fails, retry same URL

**With Profile Failover:**
- Retries = 0 → Test each profile once
- Phase 1: Test 3 available profiles
- Phase 2: Test 4 additional profiles
- = 7 attempts with different URLs!

**Result:** Faster + better redundancy

## Files Changed

1. `backend/requirements.txt` - Added gunicorn
2. `backend/entrypoint.sh` - Added Gunicorn support with DEBUG_MODE switch
3. `frontend/src/pages/StreamChecker.jsx` - Already supports min={0} for retries

## Next Steps

1. Rebuild Docker container
2. Set `DEBUG_MODE=false` in production
3. Adjust `GUNICORN_WORKERS` based on CPU cores
4. Monitor performance and adjust as needed
5. Consider setting Retries=0 with Profile Failover enabled

---

**Implementation Date:** 2026-03-06
**Status:** ✅ Complete and ready for deployment
