# Stream Metadata Cache - Analyse und Empfehlungen

## Aktueller Stand

Der Stream Metadata Cache wurde implementiert, um FFmpeg-Analysen zu beschleunigen:
- **TTL**: 24 Stunden
- **Zweck**: Vermeidung redundanter FFmpeg-Aufrufe
- **Erwartete Hit-Rate**: 60-70%
- **Zeitersparnis**: ~5-8s pro Stream bei Cache-Hit

## Problem: Cache bei manuellen Tests

Bei manuellen Test-Funktionen (z.B. "Discover & Test M3U", "Test All Streams") möchte der Benutzer FRISCHE Ergebnisse, keine gecachten Daten.

### Betroffene Endpoints

1. ✅ **`/api/stream-checker/discover-and-test-m3u/<account_id>`** - FIXED
   - Verwendet jetzt `force_check=True` → `use_cache=False`
   
2. ✅ **`/api/stream-checker/test-m3u-account-streams/<account_id>`** - FIXED
   - Verwendet bereits `force_check=True` → `use_cache=False`
   
3. ✅ **`/api/stream-checker/test-all-m3u-streams/<account_id>`** - FIXED
   - Jetzt `use_cache=False` statt `use_cache=True`

## Cache-Mehrwert Analyse

### Wo Cache SINNVOLL ist:

1. **Automatische Checks (Scheduled)**
   - Läuft alle X Minuten automatisch
   - Viele Streams wurden kürzlich geprüft
   - Cache reduziert Last und beschleunigt Checks
   - **Empfehlung**: Cache aktiviert ✓

2. **Immunity-basierte Checks**
   - Streams mit 2-Stunden-Immunität
   - Nur neue/geänderte Streams werden geprüft
   - Cache für bereits geprüfte Streams sinnvoll
   - **Empfehlung**: Cache aktiviert ✓

3. **Rescore/Resort Operationen**
   - Nur Neuberechnung der Scores
   - Keine neue FFmpeg-Analyse nötig
   - Cache liefert Metadaten für Scoring
   - **Empfehlung**: Cache aktiviert ✓

### Wo Cache NICHT SINNVOLL ist:

1. **Manuelle Test-Buttons**
   - Benutzer will AKTUELLE Ergebnisse
   - "Test" impliziert "jetzt prüfen"
   - Cache würde falsche Erwartung erzeugen
   - **Empfehlung**: Cache deaktiviert ✓

2. **Force Check Operationen**
   - Explizit "erzwungene" Prüfung
   - Umgeht Immunität → sollte auch Cache umgehen
   - **Empfehlung**: Cache deaktiviert ✓

3. **Debugging/Troubleshooting**
   - Admin will echte Stream-Verfügbarkeit prüfen
   - Cache könnte Problem verschleiern
   - **Empfehlung**: Cache deaktiviert ✓

## Implementierte Lösung

### 1. Cache-Steuerung via `force_check`

```python
# In stream_checker_service.py
analyzed = self._analyze_stream_with_profile_failover(
    stream=stream,
    analysis_params=analysis_params,
    udi=udi,
    use_cache=(not force_check)  # Cache aus bei force_check
)
```

### 2. Direkte Cache-Steuerung

```python
# In web_api.py für test_all_m3u_streams
result = analyze_stream(
    stream_url=stream_url,
    stream_id=stream_id,
    stream_name=stream_name,
    # ... andere Parameter ...
    use_cache=False  # Explizit deaktiviert für manuelle Tests
)
```

### 3. Cache-Validierung (Backup)

```python
# In stream_check_utils.py
if cached_data:
    if is_stream_dead(cached_result):
        # Ungültige Daten → Cache invalidieren
        cache.invalidate(stream_url)
    else:
        # Valide Daten → verwenden
        return cached_result
```

## Cache-Mehrwert: Fazit

**JA, der Cache hat Mehrwert für:**
- Automatische, geplante Checks (Hauptanwendungsfall)
- Große Mengen an Streams (1000+)
- Häufige Checks mit Immunität
- Performance-Optimierung bei stabilen Streams

**ABER:**
- Muss bei manuellen Tests deaktiviert werden
- Muss bei force_check deaktiviert werden
- Braucht Validierung gegen ungültige Daten

## Performance-Vergleich

### Ohne Cache (force_check=True)
- 100 Streams × 6s = 600s (10 Minuten)
- Echte, aktuelle Ergebnisse
- Für manuelle Tests akzeptabel

### Mit Cache (automatische Checks)
- 70% Cache-Hit: 70 Streams × 0.1s = 7s
- 30% Cache-Miss: 30 Streams × 6s = 180s
- **Total: 187s (3 Minuten)** statt 600s
- **Zeitersparnis: 69%**

## Empfehlung

**Cache BEHALTEN**, aber:
1. ✅ Bei `force_check=True` deaktivieren
2. ✅ Bei manuellen Test-Endpoints deaktivieren
3. ✅ Cache-Validierung für ungültige Daten
4. ✅ Klare Logging-Meldungen (💾 Symbol)

Der Cache bietet signifikante Performance-Vorteile für den Hauptanwendungsfall (automatische Checks), solange er bei manuellen Tests korrekt deaktiviert wird.

## Geänderte Dateien

- `backend/web_api.py`
  - `test_all_m3u_streams()`: `use_cache=False` statt `True`
  
- `backend/stream_checker_service.py`
  - `check_channel()`: `use_cache=(not force_check)`
  - `_analyze_stream_with_profile_failover()`: Parameter `use_cache` hinzugefügt
  - Alle `analyze_stream()` Aufrufe: `use_cache` Parameter übergeben

- `backend/stream_check_utils.py`
  - Cache-Validierung bei Read und Write

## Streams an Dispatcharr zurückgeben

**Status**: ✅ FUNKTIONIERT BEREITS

Die Streams werden korrekt an Dispatcharr zurückgegeben:

1. **Discovery**: `discover_and_assign_streams()` in `automated_stream_manager.py`
2. **Assignment**: `add_streams_to_channel()` in `api_utils.py`
3. **API Call**: `update_channel_streams()` macht `PATCH` Request an Dispatcharr
4. **Endpoint**: `PATCH /api/channels/channels/{channel_id}/`
5. **Payload**: `{"streams": [stream_ids]}`

```python
# api_utils.py, Zeile 516
url = f"{_get_base_url()}/api/channels/channels/{channel_id}/"
data = {"streams": filtered_stream_ids}
response = patch_request(url, data)
```

Die Streams werden also korrekt an Dispatcharr übertragen und in den Channels gespeichert.
