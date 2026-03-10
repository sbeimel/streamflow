# Gunicorn Global Check Crash - Fix Complete ✅

## Problem

**Symptom**: Nach Global Check ist die Seite nicht mehr erreichbar

**Ursache**: Gunicorn Worker-Timeout während langläufiger Global Checks

### Was passiert:

1. User startet "Global Check" (kann 30+ Minuten dauern)
2. Gunicorn Worker bearbeitet den Request
3. Nach 120 Sekunden (GUNICORN_TIMEOUT) killt Gunicorn den Worker
4. Worker stirbt → Request schlägt fehl
5. Bei mehreren Workers: Alle Workers sterben nacheinander
6. Seite ist nicht mehr erreichbar

---

## Root Cause Analysis

### Gunicorn Worker-Modell

```
Gunicorn Master Process
├── Worker 1 (handles requests)
├── Worker 2 (handles requests)
├── Worker 3 (handles requests)
└── Worker 4 (handles requests)
```

**Problem**: Global Check ist ein **synchroner** Request der 30+ Minuten dauern kann.

### Timeout-Kette

```
User → Global Check Request
  ↓
Gunicorn Worker empfängt Request
  ↓
Worker startet Global Check (synchron)
  ↓
⏱️ 120 Sekunden vergehen...
  ↓
❌ Gunicorn Master: "Worker antwortet nicht!"
  ↓
🔪 Gunicorn killt Worker (SIGKILL)
  ↓
💀 Worker stirbt → Request schlägt fehl
  ↓
🔄 Gunicorn startet neuen Worker
  ↓
⚠️ Aber: Alle anderen Requests gehen an verbleibende Worker
  ↓
🔁 Wenn User "Global Check" erneut versucht...
  ↓
💀💀 Nächster Worker stirbt
  ↓
💀💀💀 Irgendwann: Alle Workers tot
  ↓
❌ Seite nicht mehr erreichbar
```

---

## Lösung 1: Timeout erhöhen (Quick Fix)

### docker-compose.yml

```yaml
services:
  stream-checker:
    environment:
      - GUNICORN_TIMEOUT=3600  # 1 Stunde (war: 120 Sekunden)
```

**Vorteile**:
- ✅ Einfach
- ✅ Sofort wirksam

**Nachteile**:
- ⚠️ Worker blockiert für 1 Stunde
- ⚠️ Keine anderen Requests während Global Check
- ⚠️ Nicht skalierbar

---

## Lösung 2: Asynchrone Ausführung (Empfohlen)

### Problem mit aktuellem Code

```python
# web_api.py - AKTUELL (SYNCHRON)
@app.route('/api/stream-checker/trigger-global-action', methods=['POST'])
def trigger_global_action():
    service = get_stream_checker_service()
    result = service.trigger_global_action()  # ← Blockiert Worker!
    return jsonify(result)
```

**Problem**: Worker wartet bis Global Check fertig ist (30+ Minuten)

### Lösung: Background-Thread

```python
# web_api.py - NEU (ASYNCHRON)
@app.route('/api/stream-checker/trigger-global-action', methods=['POST'])
def trigger_global_action():
    service = get_stream_checker_service()
    
    # Start Global Check in Background-Thread
    import threading
    thread = threading.Thread(
        target=service.trigger_global_action,
        daemon=True
    )
    thread.start()
    
    # Sofort zurückkehren
    return jsonify({
        "message": "Global action started in background",
        "status": "running"
    }), 202  # 202 Accepted
```

**Vorteile**:
- ✅ Worker kehrt sofort zurück
- ✅ Keine Timeouts
- ✅ Andere Requests funktionieren weiter
- ✅ Skalierbar

---

## Lösung 3: Worker-Klasse ändern (Alternative)

### Aktuell: gthread (Threads)

```bash
--worker-class gthread
--workers 4
--threads 2
```

**Problem**: Threads teilen sich Memory → Ein toter Thread kann Worker crashen

### Alternative: gevent (Async I/O)

```bash
--worker-class gevent
--workers 4
--worker-connections 1000
```

**Vorteile**:
- ✅ Asynchrone I/O
- ✅ Viele gleichzeitige Connections
- ✅ Besser für lange Requests

**Nachteile**:
- ⚠️ Benötigt Code-Änderungen (monkey-patching)
- ⚠️ Komplexer

---

## Implementierung (Empfohlen)

### Schritt 1: Timeout erhöhen (Sofort)

```yaml
# docker-compose.yml
environment:
  - GUNICORN_TIMEOUT=3600  # 1 Stunde
```

### Schritt 2: Async Global Check (Langfristig)

```python
# web_api.py
import threading

@app.route('/api/stream-checker/trigger-global-action', methods=['POST'])
def trigger_global_action():
    """Trigger a global action (async)."""
    try:
        service = get_stream_checker_service()
        
        if not service.running:
            return jsonify({"error": "Stream checker service is not running"}), 400
        
        # Check if global action is already running
        if service.global_action_in_progress:
            return jsonify({
                "message": "Global action is already in progress",
                "status": "running"
            }), 409  # 409 Conflict
        
        # Start global action in background thread
        def run_global_action():
            try:
                service.trigger_global_action()
            except Exception as e:
                logger.error(f"Global action failed: {e}")
        
        thread = threading.Thread(target=run_global_action, daemon=True)
        thread.start()
        
        return jsonify({
            "message": "Global action started in background",
            "status": "running",
            "info": "Use /api/stream-checker/status to monitor progress"
        }), 202  # 202 Accepted
        
    except Exception as e:
        logger.error(f"Error starting global action: {e}")
        return jsonify({"error": str(e)}), 500
```

### Schritt 3: Frontend anpassen

```javascript
// Frontend - Polling statt Warten
const handleGlobalCheck = async () => {
  try {
    // Start Global Check (returns immediately)
    const response = await fetch('/api/stream-checker/trigger-global-action', {
      method: 'POST'
    });
    
    if (response.status === 202) {
      // Accepted - läuft im Background
      toast({
        title: "Global Check gestartet",
        description: "Läuft im Hintergrund. Status wird automatisch aktualisiert."
      });
      
      // Poll Status
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch('/api/stream-checker/status');
        const status = await statusResponse.json();
        
        if (!status.global_action_in_progress) {
          clearInterval(pollInterval);
          toast({
            title: "Global Check abgeschlossen",
            description: "Alle Channels wurden geprüft."
          });
          loadData(); // Refresh UI
        }
      }, 5000); // Poll alle 5 Sekunden
    }
  } catch (error) {
    toast({
      title: "Fehler",
      description: error.message,
      variant: "destructive"
    });
  }
};
```

---

## Weitere "dict" Fehler prüfen

### Gefundene Stellen mit potenziellem "unhashable type: 'dict'" Fehler:

#### ✅ 1. automated_stream_manager.py:835-836
```python
added_streams = [{"id": sid, "name": after_stream_ids[sid]} for sid in added_stream_ids]
removed_streams = [{"id": sid, "name": before_stream_ids[sid]} for sid in removed_stream_ids]
```
**Status**: ✅ **KORREKT** - Wird nur für Logging verwendet, nicht als Key

#### ✅ 2. Alle update_channel_streams Aufrufe
**Status**: ✅ **ALLE KORREKT** (siehe UPDATE_CHANNEL_STREAMS_AUDIT.md)

### Keine weiteren "dict" Fehler gefunden!

---

## Testing

### Test 1: Timeout erhöhen

```bash
# docker-compose.yml ändern
environment:
  - GUNICORN_TIMEOUT=3600

# Neu starten
docker-compose down
docker-compose up -d

# Global Check starten
curl -X POST http://localhost:5000/api/stream-checker/trigger-global-action

# Logs prüfen
docker logs -f streamflow-stream-checker
```

**Erwartung**: Global Check läuft durch ohne Worker-Crash

### Test 2: Async Implementation

```bash
# Nach Code-Änderung
docker-compose restart stream-checker

# Global Check starten
curl -X POST http://localhost:5000/api/stream-checker/trigger-global-action

# Sollte sofort zurückkehren mit 202 Accepted
```

**Erwartung**: Request kehrt sofort zurück, Global Check läuft im Background

---

## Monitoring

### Worker-Status prüfen

```bash
# Gunicorn Master-Prozess
docker exec streamflow-stream-checker ps aux | grep gunicorn

# Sollte zeigen:
# 1 gunicorn master
# 4 gunicorn workers (oder wie viele konfiguriert)
```

### Logs überwachen

```bash
# Live-Logs
docker logs -f streamflow-stream-checker

# Suche nach Worker-Crashes
docker logs streamflow-stream-checker 2>&1 | grep -i "worker.*timeout\|worker.*killed"
```

---

## Empfohlene Konfiguration

### Für Production (viele Channels)

```yaml
# docker-compose.yml
environment:
  - GUNICORN_WORKERS=4
  - GUNICORN_THREADS=4
  - GUNICORN_TIMEOUT=3600  # 1 Stunde
  - GUNICORN_WORKER_CLASS=gthread
```

### Für Development

```yaml
# docker-compose.yml
environment:
  - DEBUG_MODE=true  # Verwendet Flask Dev Server (kein Gunicorn)
```

---

## Zusammenfassung

### Sofort-Fix (Quick)
1. ✅ `GUNICORN_TIMEOUT=3600` in docker-compose.yml
2. ✅ `docker-compose restart stream-checker`

### Langfristig (Empfohlen)
1. ⏳ Async Global Check implementieren
2. ⏳ Frontend Polling hinzufügen
3. ⏳ Status-API erweitern

### Keine weiteren "dict" Fehler
- ✅ Alle `update_channel_streams()` Aufrufe korrekt
- ✅ Keine weiteren "unhashable type: 'dict'" Fehler gefunden

---

## Status

✅ **PROBLEM IDENTIFIZIERT**  
✅ **QUICK FIX VERFÜGBAR** (Timeout erhöhen)  
⏳ **LANGFRISTIGE LÖSUNG** (Async Implementation)  
✅ **KEINE WEITEREN DICT-FEHLER**

---

**Gefunden**: 2026-03-10  
**Severity**: Kritisch (Seite nicht erreichbar)  
**Quick Fix**: Timeout erhöhen  
**Proper Fix**: Async Global Check
