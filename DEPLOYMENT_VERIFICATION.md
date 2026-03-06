# Deployment Verification Guide

## Current Status

### ✅ Container Running
Your logs show the container is running successfully:
- Gunicorn with 12 workers
- 300 channels, 63876 streams, 55 M3U accounts loaded
- API responding correctly

### ⚠️ M3U Polling Fix - Needs Verification

The logs show only ONE call to `/api/m3u-accounts` at startup:
```
217.247.19.115 - jexhammer [06/Mar/2026:10:38:07 +0000] "GET /api/m3u-accounts HTTP/1.1" 200 1802268
```

This is GOOD! But we need to verify it stays this way.

## Verification Steps

### 1. Check M3U Polling (CRITICAL)

Open your browser and go to the Stream Checker page:
```
http://ricotv.goip.de:5002/stream-checker
```

Then watch the Docker logs for 10-15 seconds:
```bash
docker-compose logs -f --tail=50
```

**What to look for:**
- ✅ GOOD: No more `/api/m3u-accounts` calls in logs
- ❌ BAD: `/api/m3u-accounts` appears every 3 seconds

**If you see repeated calls:**
The frontend wasn't rebuilt. Run:
```bash
cd frontend
npm run build
cd ..
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 2. Test M3U Testing Buttons

Go to Dashboard:
```
http://ricotv.goip.de:5002/
```

Find any M3U account and test both buttons:

**Button 1 (Single Test Tube 🧪):**
- Click it
- Check logs for: `Testing X streams from M3U account Y in background`
- Should test ALL streams from provider
- No channel assignment needed

**Button 2 (Search + Test Tube 🔍🧪):**
- Click it
- Check logs for: `Running stream discovery for M3U account Y`
- Should discover streams first, then test assigned ones

### 3. Clear Browser Cache

After verifying, clear your browser cache:
- Press: `Ctrl + Shift + R` (hard refresh)
- Or: `Ctrl + F5`

This ensures you're using the latest frontend code.

## Expected Log Output

### M3U Polling Fix Working:
```
# Only ONE call at page load:
217.247.19.115 - jexhammer [06/Mar/2026:10:38:07 +0000] "GET /api/m3u-accounts HTTP/1.1" 200 1802268

# Then only these calls every 3 seconds:
"GET /api/stream-checker/status HTTP/1.1" 200
"GET /api/stream-checker/progress HTTP/1.1" 200
"GET /api/stream-checker/config HTTP/1.1" 200
```

### Button 1 (Test All Streams):
```
INFO - Testing 1234 streams from M3U account 5 in background
INFO - ▶ Checking Stream Name 1
INFO - ▶ Checking Stream Name 2
...
INFO - Completed testing M3U account 5: 1100/1234 streams successful
```

### Button 2 (Discover & Test):
```
INFO - Running stream discovery for M3U account 5
INFO - Testing 45 stream(s) from M3U account 5
INFO - Queued 12 channels for testing
```

## Network Traffic Comparison

### Before Fix:
- M3U accounts: 1.8 MB every 3 seconds = 600 KB/s
- Status/Progress: 3 KB every 3 seconds = 1 KB/s
- **Total: 601 KB/s**

### After Fix:
- M3U accounts: 1.8 MB once on page load
- Status/Progress: 3 KB every 3 seconds = 1 KB/s
- **Total: 1 KB/s (200x improvement!)**

## Troubleshooting

### If M3U accounts still loading every 3 seconds:

1. **Frontend not rebuilt:**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Docker using old image:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. **Browser cache:**
   - Press `Ctrl + Shift + Delete`
   - Clear "Cached images and files"
   - Or use Incognito/Private mode

### If Button 1 shows error:

Check logs for:
```
ERROR - Error testing all M3U streams: [error message]
```

Common issues:
- UDI Manager not initialized
- Stream checker config not loaded
- Threading error

### If Button 2 shows error:

Check logs for:
```
ERROR - Stream discovery failed: [error message]
```

Common issues:
- Automation manager not available
- Discovery patterns not configured
- Channel matching issues

## Summary

Your container is running correctly! Now verify:
1. ✅ M3U polling fix (watch logs for 10 seconds)
2. ✅ Button 1 tests ALL streams directly
3. ✅ Button 2 discovers + tests assigned streams
4. ✅ Clear browser cache

If M3U accounts are still loading every 3 seconds, rebuild frontend and Docker.
