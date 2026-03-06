# Gunicorn Auto-Start Fix ✅

## Problem

Stream Checker Service startet nicht wenn Gunicorn verwendet wird.

**Fehlermeldung:**
```
Stream checker service is not running
```

### Root Cause

Der Auto-Start-Code war in `if __name__ == '__main__':` Block:

```python
if __name__ == '__main__':
    # Auto-start services
    service.start()
    # ...
    app.run()
```

**Problem:** Gunicorn lädt die App als Modul, NICHT als `__main__`. Daher wird dieser Block NIE ausgeführt!

**Folge:**
- Flask Development Server: ✅ Services starten (weil `__main__` ausgeführt wird)
- Gunicorn Production Server: ❌ Services starten NICHT (weil `__main__` übersprungen wird)

## Lösung

Auto-Start-Code in eine Funktion verschoben die beim **Modul-Import** ausgeführt wird:

### Vorher (Broken mit Gunicorn)
```python
app = Flask(__name__)
CORS(app)

# ... viele Endpoints ...

if __name__ == '__main__':
    # Auto-start services ❌ Wird bei Gunicorn NICHT ausgeführt
    service.start()
    app.run()
```

### Nachher (Fixed)
```python
app = Flask(__name__)
CORS(app)

# Auto-start function
def _auto_start_services():
    """Auto-start services when the application loads."""
    # Check wizard complete
    if not check_wizard_complete():
        return
    
    # Start stream checker service
    service = get_stream_checker_service()
    service.start()
    
    # Start automation service
    manager = get_automation_manager()
    manager.start_automation()
    
    # Start processors
    start_scheduled_event_processor()
    start_epg_refresh_processor()

# Call immediately when module loads ✅ Funktioniert mit Gunicorn!
_auto_start_services()

# ... Endpoints ...

if __name__ == '__main__':
    # Nur für Flask dev server
    app.run()
```

## Was wird auto-gestartet?

1. **Stream Checker Service**
   - Nur wenn Wizard complete
   - Nur wenn Automation enabled
   - Nur wenn `enabled: true` in Config

2. **Automation Service**
   - Nur wenn Wizard complete
   - Nur wenn Automation enabled

3. **Scheduled Event Processor**
   - Nur wenn Wizard complete

4. **EPG Refresh Processor**
   - Nur wenn Wizard complete

## Vorteile

✅ **Funktioniert mit Gunicorn** - Services starten automatisch
✅ **Funktioniert mit Flask Dev Server** - Wie bisher
✅ **Keine doppelten Starts** - Wird nur einmal beim Import ausgeführt
✅ **Fehlerbehandlung** - Try/Catch für jeden Service
✅ **Logging** - Klare Meldungen was gestartet wurde

## Testing

### 1. Mit Gunicorn (Production)
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

**Erwartete Logs:**
```
Stream checker service auto-started
Automation service auto-started
Scheduled event processor auto-started
EPG refresh processor auto-started
```

### 2. Mit Flask Dev Server (Debug)
```bash
DEBUG_MODE=true docker-compose up
```

**Erwartete Logs:**
```
Stream checker service auto-started
Automation service auto-started
...
```

### 3. Service Status prüfen
```bash
curl http://localhost:5000/api/stream-checker/status
```

**Erwartete Response:**
```json
{
  "running": true,
  "status": "idle",
  ...
}
```

### 4. Test Incomplete Stats Button
1. Öffne Stream Checker Seite
2. Klicke "Test Incomplete Stats"
3. Sollte funktionieren (kein "service not running" Fehler mehr)

## Geänderte Dateien

- `backend/web_api.py`
  - `_auto_start_services()` Funktion hinzugefügt (Zeile ~90)
  - Aufruf beim Modul-Import (Zeile ~155)

## Status

✅ **Auto-Start für Gunicorn implementiert**
✅ **Keine Syntax-Fehler**
✅ **Rückwärtskompatibel mit Flask Dev Server**
✅ **Bereit zum Testen**
