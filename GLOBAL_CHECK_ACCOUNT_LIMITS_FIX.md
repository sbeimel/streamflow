# Global Check - Account Limits Fix

## Problem
Global Check testete nur bereits zugeordnete Streams. Mit Account Limits aktiv wurden viele Streams nie getestet, weil sie nicht zugeordnet waren.

### Root Cause
```
1. Discover Streams → Ordnet ALLE matchenden Streams zu
2. Stream Checker testet Channel → Wendet Limits SOFORT an
3. Nächster Discover → Viele Streams sind nicht mehr zugeordnet
4. Diese Streams werden nie getestet
```

## Lösung: Temporäres Limit-Disable während Global Check

### Neuer Workflow

```
1. Save current limit setting
2. Disable account limits temporarily
3. Refresh UDI cache
4. Clear dead stream tracker
5. Update M3U playlists
6. Validate streams against regex
7. Match and assign ALL streams (limits disabled)
8. Queue all channels for checking
9. Re-enable account limits
10. Limits werden mit NEUEN Scores angewendet
```

## Implementierung

### Stream Checker Service (`_perform_global_action`)

**Schritt 1: Limits temporär deaktivieren**
```python
# Save original setting
account_limits_config = self.config.get('account_stream_limits', {})
original_limits_enabled = account_limits_config.get('enabled', True)

# Disable temporarily
if original_limits_enabled:
    logger.info("Temporarily disabling account limits to test ALL streams...")
    account_limits_config['enabled'] = False
    self.config['account_stream_limits'] = account_limits_config
```

**Schritt 2: Discover ALL Streams**
```python
# With limits disabled, ALL matching streams are assigned
assignments = automation_manager.discover_and_assign_streams()
```

**Schritt 3: Test ALL Channels**
```python
# All assigned streams will be tested
self._queue_all_channels(force_check=True)
```

**Schritt 4: Re-enable Limits**
```python
# Limits are re-enabled and will be applied as channels complete
if original_limits_enabled:
    account_limits_config['enabled'] = True
    self.config['account_stream_limits'] = account_limits_config
    logger.info("✓ Account limits re-enabled - will be applied based on NEW quality scores")
```

## Vorteile

### Vorher (FALSCH):
```
Channel "CNN":
- 100 Streams verfügbar
- Account Limit: 5 Streams pro Account
- Discover ordnet 5 Streams zu (basierend auf alten/fehlenden Stats)
- Diese 5 werden getestet
- Die anderen 95 werden NIE getestet
- Beim nächsten Discover: Immer noch die gleichen 5 (weil sie Stats haben)
```

### Nachher (RICHTIG):
```
Channel "CNN":
- 100 Streams verfügbar
- Global Check: Limits temporär deaktiviert
- Discover ordnet ALLE 100 Streams zu
- Alle 100 werden getestet
- Limits werden wieder aktiviert
- Die besten 5 (nach NEUEN Scores) bleiben zugeordnet
- Beim nächsten Discover: Alle 100 haben Stats für korrektes Scoring
```

## Wichtige Details

### Error Handling
```python
try:
    # Disable limits
    # Perform global check
    # Re-enable limits
except Exception as e:
    # Restore original limits on error
    if original_limits_enabled:
        account_limits_config['enabled'] = True
finally:
    # Always clear global_action_in_progress flag
    self.global_action_in_progress = False
```

### Limit Application Timing
- Limits werden NICHT sofort nach Re-Enable angewendet
- Sie werden angewendet, wenn jeder Channel seinen Check abschließt
- Das bedeutet: Während des Checks sind ALLE Streams zugeordnet
- Nach dem Check: Nur die besten bleiben (basierend auf neuen Scores)

## Workflow-Schritte

**Step 1/7:** Refresh UDI cache  
**Step 2/7:** Clear dead stream tracker  
**Step 3/7:** Update M3U playlists  
**Step 4/7:** Validate streams against regex  
**Step 5/7:** Match and assign ALL streams (limits disabled)  
**Step 6/7:** Queue all channels for checking  
**Step 7/7:** Re-enable account limits  

## Testing

**Container neu bauen:**
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

**Global Check ausführen:**
1. Dashboard → "Global Check" Button
2. Logs prüfen:
   - "Temporarily disabling account limits..."
   - "Assigned ALL matching streams..."
   - "Re-enabling account limits..."
3. Warten bis alle Channels getestet sind
4. Prüfen: Nur beste Streams pro Account sind zugeordnet

## Ergebnis

✅ ALLE Streams werden getestet (nicht nur zugeordnete)  
✅ Limits werden mit aktuellen Scores angewendet  
✅ Beste Streams bleiben zugeordnet  
✅ Beim nächsten Discover: Alle Streams haben Stats für korrektes Scoring  

## Files Modified
- `backend/stream_checker_service.py` - `_perform_global_action()` with temporary limit disable
- `backend/automated_stream_manager.py` - Added `ignore_account_limits` parameter (for future use)
