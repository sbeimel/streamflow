# Cache Deaktivierung für manuelle Stream-Tests

## Problem

Bei manuellen Test-Funktionen wurden gecachte Daten verwendet statt frische Analysen durchzuführen:

1. **"Discover & Test M3U"**: Streams zeigten gecachte Metadaten mit `resolution: '0x0'`
2. **"Test All Streams"**: Verwendete `use_cache=True` statt frische Tests
3. **Benutzer-Erwartung**: Bei "Test" will man AKTUELLE Ergebnisse, keine gecachten Daten

**Grundursache**: Der Metadata-Cache (24h TTL) wurde auch bei expliziten manuellen Tests verwendet. Der Cache ist für automatische Checks sinnvoll (69% Zeitersparnis), aber nicht für manuelle Tests.

## Lösung

Cache wird jetzt bei allen manuellen Test-Operationen deaktiviert:

### 1. "Discover & Test M3U" (web_api.py, Zeile ~3810)

```python
# Queue channels for checking with force_check flag (bypasses immunity)
for channel_id in channels_affected:
    service.queue_channel(channel_id, priority=20, force_check=True)
```

→ `force_check=True` führt zu `use_cache=False` in der Stream-Analyse

### 2. "Test M3U Account Streams" (web_api.py, Zeile ~3615)

```python
# Queue channels for checking with force_check flag
for channel_id in channels_affected:
    service.queue_channel(channel_id, priority=20, force_check=True)
```

→ Bereits korrekt implementiert ✓

### 3. "Test All M3U Streams" (web_api.py, Zeile ~3690)

```python
result = analyze_stream(
    stream_url=stream_url,
    stream_id=stream_id,
    stream_name=stream_name,
    # ... Parameter ...
    use_cache=False  # GEÄNDERT von True zu False
)
```

→ Explizit `use_cache=False` gesetzt

### 4. Stream Checker Service (stream_checker_service.py)

**Zeile ~2663** (Sequential Checking):
```python
analyzed = self._analyze_stream_with_profile_failover(
    stream=stream,
    analysis_params=analysis_params,
    udi=udi,
    use_cache=(not force_check)  # Cache aus bei force_check
)
```

**Zeile ~2171** (Parallel Checking Wrapper):
```python
return self._analyze_stream_with_profile_failover(
    stream=stream,
    analysis_params=analysis_params,
    udi=udi,
    use_cache=(not force_check)  # Cache aus bei force_check
)
```

**Zeile ~3033** (Funktion erweitert):
```python
def _analyze_stream_with_profile_failover(
    self, stream: Dict, analysis_params: Dict, udi, 
    use_cache: bool = True  # Neuer Parameter
) -> Dict:
```

Alle `analyze_stream()` Aufrufe in dieser Funktion übergeben jetzt `use_cache`.

### 5. Cache-Validierung (stream_check_utils.py)

Zusätzlicher Schutz gegen ungültige gecachte Daten:

**Cache Read** (Zeile ~840):
```python
if cached_data:
    if is_stream_dead(cached_result):
        logger.warning(f"Cached data invalid - invalidating and re-checking")
        cache.invalidate(stream_url)
    else:
        return cached_result
```

**Cache Write** (Zeile ~973):
```python
if result['status'] == "OK":
    if not is_stream_dead(result):
        cache.set(stream_url, {...})
    else:
        logger.debug(f"Not caching dead stream data")
```

## Cache-Mehrwert

### JA, Cache ist sinnvoll für:
- **Automatische Checks**: 69% Zeitersparnis (187s statt 600s bei 100 Streams)
- **Immunity-basierte Checks**: Nur neue Streams werden analysiert
- **Rescore/Resort**: Metadaten für Scoring ohne neue FFmpeg-Analyse

### NEIN, Cache nicht sinnvoll für:
- **Manuelle Test-Buttons**: Benutzer will aktuelle Ergebnisse
- **Force Check**: Explizit erzwungene Prüfung
- **Debugging**: Echte Stream-Verfügbarkeit prüfen

## Verhalten nach Fix

### Mit force_check=True oder manuellen Tests
- ❌ Cache wird NICHT verwendet
- ✅ Alle Streams werden frisch mit FFmpeg analysiert
- ✅ Echte, aktuelle Ergebnisse
- ⏱️ Längere Laufzeit, aber korrekte Daten

### Mit automatischen Checks (force_check=False)
- ✅ Cache wird verwendet (24h TTL)
- ⚡ Schnellere Checks für bereits analysierte Streams
- 📊 Performance-Optimierung (69% schneller)
- 💾 Log-Meldungen zeigen Cache-Hits

## Streams an Dispatcharr zurückgeben

**Status**: ✅ FUNKTIONIERT BEREITS KORREKT

Die discovered Streams werden automatisch an Dispatcharr zurückgegeben:

1. **Discovery**: `discover_and_assign_streams()` findet passende Streams
2. **Assignment**: `add_streams_to_channel(channel_id, stream_ids)` wird aufgerufen
3. **API Call**: `update_channel_streams()` macht PATCH Request
4. **Endpoint**: `PATCH /api/channels/channels/{channel_id}/`
5. **Payload**: `{"streams": [stream_ids]}`
6. **Verification**: System prüft, ob Streams korrekt hinzugefügt wurden

```python
# api_utils.py, Zeile 516
url = f"{_get_base_url()}/api/channels/channels/{channel_id}/"
data = {"streams": filtered_stream_ids}
response = patch_request(url, data)
```

Die Streams werden also korrekt an Dispatcharr übertragen und in den Channels gespeichert.

## Testing

Nach diesem Fix:
1. **"Discover & Test M3U"** klicken → Streams werden frisch analysiert
2. **"Test All Streams"** klicken → Alle Streams werden neu getestet
3. **Automatische Checks** → Cache wird weiterhin verwendet (Performance)
4. **Logs prüfen**: 💾 Symbol zeigt Cache-Verwendung an

## Geänderte Dateien

- `backend/web_api.py`
  - `test_all_m3u_streams()`: `use_cache=False` statt `True`
  
- `backend/stream_checker_service.py`
  - `_analyze_stream_with_profile_failover()`: Parameter `use_cache` hinzugefügt
  - `check_channel()`: `use_cache=(not force_check)` bei Aufruf
  - Wrapper für paralleles Checking: `use_cache=(not force_check)` bei Aufruf
  - Alle `analyze_stream()` Aufrufe: `use_cache` Parameter übergeben

- `backend/stream_check_utils.py`
  - Cache Read Validierung: Ungültige Daten werden invalidiert
  - Cache Write Validierung: Nur valide Daten werden gecacht

## Verwandte Issues

- Task 1: "Discover & Test M3U" Endpoint-Fehler behoben (Unpacking-Problem)
- Task 2: Stream-Qualitätsprüfung Fehler behoben (Cache-Deaktivierung + Validierung)
- Task 3: "Test All Streams" Cache-Deaktivierung


