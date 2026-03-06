# Stream Metadata Cache - Detaillierte Erklärung

## Was wird GENAU gecached?

Der Cache speichert die **FFmpeg-Analyse-Ergebnisse** eines Streams. Das sind die Daten, die durch eine aufwändige FFmpeg-Analyse (5-8 Sekunden pro Stream) ermittelt werden.

### Gecachte Daten pro Stream

```python
cache.set(stream_url, {
    'video_codec': result['video_codec'],      # z.B. 'h264', 'hevc', 'mpeg2'
    'audio_codec': result['audio_codec'],      # z.B. 'aac', 'mp3', 'ac3'
    'resolution': result['resolution'],        # z.B. '1920x1080', '1280x720'
    'fps': result['fps'],                      # z.B. 25.0, 30.0, 50.0
    'bitrate_kbps': result['bitrate_kbps'],   # z.B. 5000.0, 8000.0
    'status': result['status']                 # 'OK', 'Timeout', 'Error'
})
```

### Cache-Key

Der Cache-Key ist die **Stream-URL**:
```python
cache_key = stream_url  # z.B. "http://provider.com:8080/live/user/pass/12345.ts"
```

### Cache-Speicherort

```
/app/data/stream_metadata_cache.pkl
```

Persistente Speicherung als Pickle-Datei, überlebt Container-Neustarts.

## Was wird NICHT gecached?

- ❌ **Stream-ID** (ändert sich nicht, braucht kein Caching)
- ❌ **Stream-Name** (ändert sich nicht, braucht kein Caching)
- ❌ **Channel-Zuordnung** (wird in Dispatcharr gespeichert)
- ❌ **Score** (wird jedes Mal neu berechnet basierend auf Metadaten)
- ❌ **M3U Account Info** (wird in Dispatcharr gespeichert)
- ❌ **Profile-Informationen** (wird in Dispatcharr gespeichert)

## Warum nur diese Daten?

Diese Daten sind:
1. **Teuer zu ermitteln**: FFmpeg-Analyse dauert 5-8 Sekunden pro Stream
2. **Relativ stabil**: Codec, Resolution, FPS ändern sich selten bei einem Stream
3. **Wiederverwendbar**: Können für Scoring und Vergleiche genutzt werden

## Cache-Lebenszyklus

### 1. Cache Miss (Stream wird analysiert)

```
User klickt "Check Streams"
  ↓
analyze_stream(stream_url, use_cache=True)
  ↓
Cache-Lookup: stream_url → NICHT GEFUNDEN
  ↓
FFmpeg-Analyse läuft (5-8 Sekunden)
  ↓
Ergebnis: {video_codec: 'h264', resolution: '1920x1080', fps: 25.0, bitrate_kbps: 5000.0}
  ↓
Cache-Write: stream_url → Metadaten (TTL: 24h)
  ↓
Ergebnis zurückgeben
```

**Dauer**: ~6 Sekunden

### 2. Cache Hit (Stream wurde kürzlich analysiert)

```
User klickt "Check Streams" (innerhalb 24h)
  ↓
analyze_stream(stream_url, use_cache=True)
  ↓
Cache-Lookup: stream_url → GEFUNDEN (age: 2h)
  ↓
Validierung: is_stream_dead() → NEIN (valide Daten)
  ↓
Ergebnis direkt aus Cache zurückgeben
```

**Dauer**: ~0.1 Sekunden (60x schneller!)

### 3. Cache Hit mit ungültigen Daten (nach unserem Fix)

```
User klickt "Check Streams"
  ↓
analyze_stream(stream_url, use_cache=True)
  ↓
Cache-Lookup: stream_url → GEFUNDEN
  ↓
Validierung: is_stream_dead() → JA (0x0 resolution)
  ↓
Cache-Invalidierung: stream_url → GELÖSCHT
  ↓
FFmpeg-Analyse läuft (5-8 Sekunden)
  ↓
Neues Ergebnis cachen (wenn valide)
```

**Dauer**: ~6 Sekunden (aber mit korrekten Daten)

### 4. Force Check (manuelle Tests)

```
User klickt "Discover & Test M3U"
  ↓
force_check=True → use_cache=False
  ↓
analyze_stream(stream_url, use_cache=False)
  ↓
Cache wird ÜBERSPRUNGEN
  ↓
FFmpeg-Analyse läuft (5-8 Sekunden)
  ↓
Ergebnis zurückgeben (NICHT cachen bei force_check)
```

**Dauer**: ~6 Sekunden (immer frische Daten)

## Cache-Statistiken

Der Cache trackt seine Effizienz:

```python
cache.get_stats() = {
    'hits': 150,              # Anzahl Cache-Hits
    'misses': 50,             # Anzahl Cache-Misses
    'total_requests': 200,    # Gesamt-Anfragen
    'hit_rate': 75.0,         # Hit-Rate in %
    'size': 180               # Anzahl gecachter Streams
}
```

## Beispiel-Szenario

### Szenario 1: Automatischer Check (mit Cache)

```
10:00 Uhr - Erster Check von 100 Streams
  → 100 Cache-Misses
  → 100 × 6s = 600s (10 Minuten)
  → 100 Streams gecacht

12:00 Uhr - Zweiter Check von 100 Streams (2h später)
  → 70 Cache-Hits (70 × 0.1s = 7s)
  → 30 Cache-Misses (30 × 6s = 180s)
  → Total: 187s (3 Minuten)
  → Zeitersparnis: 413s (69%)
```

### Szenario 2: Manueller Test (ohne Cache)

```
User klickt "Discover & Test M3U" (force_check=True)
  → Cache wird ignoriert
  → 30 Streams × 6s = 180s (3 Minuten)
  → Frische, aktuelle Ergebnisse
```

## Cache-Verwaltung

### Automatische Bereinigung

- **TTL**: 24 Stunden
- **Cleanup**: Beim Laden werden abgelaufene Einträge entfernt
- **Speicherung**: Alle 10 neuen Einträge wird Cache auf Disk gespeichert

### Manuelle Verwaltung

```python
# Cache leeren
cache.clear()

# Einzelnen Stream invalidieren
cache.invalidate(stream_url)

# Abgelaufene Einträge entfernen
cache.cleanup_expired()

# Statistiken abrufen
stats = cache.get_stats()
```

## Performance-Vergleich

| Operation | Ohne Cache | Mit Cache (Hit) | Ersparnis |
|-----------|------------|-----------------|-----------|
| 1 Stream | 6s | 0.1s | 98% |
| 10 Streams | 60s | 1s | 98% |
| 100 Streams (70% Hit) | 600s | 187s | 69% |
| 1000 Streams (70% Hit) | 6000s | 1870s | 69% |

## Wann wird Cache verwendet?

### ✅ Cache AKTIV (use_cache=True)

- Automatische, geplante Checks
- Normale Channel-Checks mit Immunität
- Rescore/Resort Operationen
- Background-Prozesse

### ❌ Cache INAKTIV (use_cache=False)

- `force_check=True` (z.B. "Discover & Test M3U")
- Manuelle Test-Buttons ("Test All Streams")
- Debugging/Troubleshooting
- Explizite Neu-Prüfungen

## Zusammenfassung

**Was wird gecacht?**
- Video-Codec (h264, hevc, etc.)
- Audio-Codec (aac, mp3, etc.)
- Resolution (1920x1080, etc.)
- FPS (25.0, 30.0, etc.)
- Bitrate (5000.0 kbps, etc.)
- Status (OK, Timeout, Error)

**Warum?**
- FFmpeg-Analyse ist teuer (5-8s pro Stream)
- Metadaten ändern sich selten
- 69% Zeitersparnis bei automatischen Checks

**Wann nicht?**
- Bei manuellen Tests (force_check=True)
- Bei ungültigen Daten (0x0 resolution)
- Bei expliziten Neu-Prüfungen

Der Cache ist ein Performance-Feature für automatische Checks, wird aber bei manuellen Tests korrekt deaktiviert.
