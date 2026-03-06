# MACstrom vs StreamFlow - Vergleichsanalyse

## Executive Summary

**MACstrom** und **StreamFlow** lösen unterschiedliche, aber komplementäre Probleme im IPTV-Bereich:

- **MACstrom**: MAC-Adressen-Scanner + IPTV-Streaming-Server (Stalker/Ministra-Portale)
- **StreamFlow**: Stream-Quality-Checker + Dispatcharr-Integration (Xtream Codes API)

## Architektur-Vergleich

| Aspekt | MACstrom | StreamFlow |
|--------|----------|------------|
| **Sprache** | Rust (100%) | Python (Backend) + React (Frontend) |
| **Runtime** | Native Binary + WASM | Python 3.x + Node.js |
| **Framework** | Leptos 0.8 (Fullstack) | Flask + Vite/React |
| **Datenbank** | JSON-Dateien | JSON + CSV |
| **Container** | Alpine (musl) | Debian-based |
| **Build-Zeit** | Rust Compiler | Python + npm |
| **Deployment** | Single Binary | Multi-Container |

## Funktionale Unterschiede

### MACstrom: MAC-Scanner + Bridge + Quality-Management

**Kernfunktion**: Entdeckt funktionierende MAC-Adressen auf Stalker/Ministra-Portalen + Stream-Quality-Management

**Unique Features**:

**Scanner**:
- Thompson Sampling mit hierarchischem Blockbaum (intelligente MAC-Suche)
- Portal-Familien mit Präfix-Awareness
- Dual-Mode STB-Emulation (GET/POST)
- Auto-Stream-Test (validiert MACs mit echten Streams)
- Portal-Crawler (urlscan.io Integration)

**Bridge (Streaming-Server)**:
- XC-API-Kompatibilität (TiviMate, Plex, Jellyfin, Emby)
- MPEG-TS → fMP4 Remux mit HEVC→H.264 Transkodierung (in-process FFmpeg)
- **Cross-Portal Channel-Merging** (gleiche Kanäle über mehrere Portale)
- **Automatic Failover** mit QoE-basiertem Ranking
- MAC-Pool-Management mit per-channel Learning
- HDHomeRun-Emulation
- STRM-Endpoint für Kodi/Jellyfin

**Quality-Management** (⭐ Kernfeature):
- **FFmpeg-basierte Quality-Probe** (Resolution, Codec, FPS, Bitrate via PTS)
- **Reference-Bitrate Sigmoid Scoring** (0-100 Quality-Score)
- **Composite QoE Score** (Quality × Reliability × Stalling-Penalty)
- **Dead-Stream-Detection** (<200 kbps = Off-Air)
- **Live Bitrate Feedback** (Updates während Streaming)
- **Probe-Failure-Diagnostics** (Geo-blocked, Server-Error, etc.)
- **Death-Spiral-Prevention** (Error-Frames statt Black-Screen)

**Architektur**:
- Zero-JavaScript (100% Rust → WASM)
- In-process FFmpeg (C-Library via FFI, kein subprocess)

### StreamFlow: Stream-Quality-Checker

**Kernfunktion**: Analysiert und bewertet IPTV-Streams für Dispatcharr

**Unique Features**:
- Dispatcharr-Integration (Xtream Codes API)
- Multi-Profile Failover (automatisches Profil-Switching)
- Stream-Quality-Scoring (Bitrate, Codec, Resolution, FPS)
- Dead-Stream-Tracking mit Immunity-System
- Priority-Channel-Queue
- Concurrent-Stream-Limiter (per-account)
- Automated-Stream-Manager
- Channel-Regex-Assignment
- EPG-Integration
- Web-UI für Konfiguration

## Technische Stärken

### MACstrom Stärken

1. **Performance**: Native Rust, Zero-Copy, jemalloc
2. **Memory Safety**: Rust Ownership-System
3. **Concurrency**: Tokio async runtime
4. **Type Safety**: Compile-time Garantien
5. **Single Binary**: Keine Runtime-Dependencies
6. **WASM Client**: Kein JavaScript, volle Type-Safety im Browser
7. **FFmpeg Integration**: In-process C-Library (kein subprocess)
8. **Smart Search**: Thompson Sampling (ML-basiert)

### StreamFlow Stärken

1. **Rapid Development**: Python = schnelle Iteration
2. **Ecosystem**: Riesiges Python-Ökosystem
3. **Readability**: Python-Code ist leichter zu lesen
4. **Debugging**: Python-Debugging ist einfacher
5. **Community**: Größere Python-Community
6. **Integration**: Einfache Integration mit Python-Tools
7. **Flexibility**: Dynamische Typisierung = schnelle Prototypen
8. **Dispatcharr-Native**: Direkte API-Integration

## Performance-Vergleich

| Metrik | MACstrom | StreamFlow |
|--------|----------|------------|
| **Startup-Zeit** | <1s (native) | ~5-10s (Python + Gunicorn) |
| **Memory Footprint** | ~50-100 MB | ~200-500 MB |
| **CPU-Effizienz** | Sehr hoch (Rust) | Mittel (Python GIL) |
| **Concurrency** | Tokio (true parallelism) | Threading (GIL-limited) |
| **FFmpeg** | In-process (FFI) | Subprocess (overhead) |
| **Network I/O** | reqwest + rustls | requests + urllib3 |

## Use-Case-Matrix

| Szenario | Empfehlung | Grund |
|----------|------------|-------|
| **Stalker/Ministra Portale** | MACstrom | Native Unterstützung |
| **Xtream Codes API** | StreamFlow | Dispatcharr-Integration |
| **MAC-Scanning** | MACstrom | Thompson Sampling |
| **Stream-Quality-Check** | StreamFlow | Spezialisiert darauf |
| **Hohe Concurrency** | MACstrom | Rust async |
| **Schnelle Entwicklung** | StreamFlow | Python |
| **Low-Resource-Umgebung** | MACstrom | Geringer Footprint |
| **Dispatcharr-Integration** | StreamFlow | Native API |

## Architektur-Philosophie

### MACstrom: "Zero-Cost Abstractions"

```
Rust → Native Binary → WASM
  ↓
Compile-time Safety
  ↓
Runtime Performance
```

**Vorteile**:
- Keine Runtime-Overhead
- Memory-Safety ohne GC
- True Parallelism
- Type-Safety überall

**Nachteile**:
- Längere Compile-Zeiten
- Steilere Lernkurve
- Kleineres Ecosystem

### StreamFlow: "Batteries Included"

```
Python → Interpreted → Dynamic
  ↓
Rapid Development
  ↓
Rich Ecosystem
```

**Vorteile**:
- Schnelle Entwicklung
- Riesiges Ecosystem
- Einfaches Debugging
- Große Community

**Nachteile**:
- GIL-Limitation
- Höherer Memory-Footprint
- Runtime-Errors
- Subprocess-Overhead

## Konkrete Feature-Vergleiche

### 1. Stream-Quality-Checking

**MACstrom** (⭐ Sehr fortgeschritten):
```rust
// In-process FFmpeg via FFI
// ~2 MB Sample → PTS-basierte Bitrate-Messung
let probe = ffmpeg_sys::probe_video_info_from_ring(ring_buffer)?;
let quality_score = reference_bitrate_sigmoid(
    probe.bitrate, 
    probe.codec, 
    probe.resolution
); // 0-100

// Composite QoE Score
let qoe = quality_score × reliability × (1.0 - stall_rate × 0.5);
```

**Features**:
- PTS-basierte Bitrate (nicht Container-Metadata)
- Reference-Bitrate Sigmoid (codec/resolution-aware)
- Composite QoE (ITU-T P.1203.3 inspiriert)
- Dead-Stream-Detection (<200 kbps)
- Live Bitrate Feedback während Streaming
- Probe-Failure-Diagnostics (Geo-blocked, Server-Error)

**StreamFlow** (✓ Gut):
```python
# Subprocess FFmpeg
result = subprocess.run(['ffmpeg', '-i', url, '-t', '30', ...])
bitrate = parse_ffmpeg_output(result.stderr)
quality_score = calculate_score(bitrate, resolution, codec)
```

**Features**:
- FFmpeg-Output-Parsing
- Bitrate, Resolution, FPS, Codec-Erkennung
- Early-Exit-Optimization (3-5s statt 8s)
- Dead-Stream-Tracking mit Immunity
- Profile-Failover (automatisches Profil-Switching)

**Unterschied**: 
- MACstrom = In-process FFmpeg, PTS-basiert, QoE-Scoring
- StreamFlow = Subprocess FFmpeg, Output-Parsing, simpler Scoring

### 2. Stream-Merging / Cross-Portal-Failover

**MACstrom** (⭐ Native Feature):
```rust
// Automatisches Channel-Merging über Portale
// Failover-Sort: QoE (desc) → cross-portal diversity → failures
struct ChannelGroup {
    sources: Vec<ChannelSource>,  // Mehrere Portale
    effective_qoe: u8,             // Best source QoE
}

// Automatic Failover bei Stream-Failure
if stream_fails {
    try_next_source_by_qoe();  // Nächstes Portal
}
```

**Features**:
- Cross-Portal Channel-Grouping (gleicher Kanalname)
- QoE-basiertes Failover-Ranking
- Automatic MAC-Rotation bei Failure
- Death-Spiral-Prevention (Error-Frames)
- Bad-Stream-Detection (HTML-Response, <200 kbps)

**StreamFlow** (✓ Ähnlich):
```python
# Profile-Failover (verschiedene M3U-Accounts)
# Phase 1: Available Profiles
# Phase 2: Full Profiles mit Polling
for profile in available_profiles:
    result = analyze_stream(stream_url, profile)
    if result['status'] == 'OK':
        return result  # Success
# Alle Profile fehlgeschlagen → Dead
```

**Features**:
- Multi-Profile-Failover (Phase 1 + Phase 2)
- Intelligent Polling (wartet auf freie Slots)
- Profile-Diversification (Provider-Diversity)
- Dead-Stream-Tracking

**Unterschied**:
- MACstrom = Cross-Portal-Merging (gleicher Kanal, verschiedene Portale)
- StreamFlow = Multi-Profile-Failover (gleicher Stream, verschiedene Accounts)

### 3. FFmpeg-Integration

**MACstrom**:
```rust
// In-process FFmpeg via FFI
let probe = ffmpeg_sys::probe_video_info_from_ring(ring)?;
// Zero-Copy, kein subprocess
```

**StreamFlow**:
```python
# Subprocess FFmpeg
process = subprocess.Popen(['ffmpeg', ...], stderr=subprocess.PIPE)
# Subprocess-Overhead, aber Early-Exit-Optimization
```

**Unterschied**: MACstrom = Zero-Copy FFI, StreamFlow = Subprocess mit Optimization

## Integration-Möglichkeiten

### Szenario 1: Parallel-Betrieb

```
MACstrom (Port 8642)
  ↓
  MAC-Scanning + Stalker-Streaming
  
StreamFlow (Port 5000)
  ↓
  Dispatcharr-Integration + Quality-Checking
```

**Vorteil**: Beide Tools für ihre Stärken nutzen

### Szenario 2: StreamFlow → MACstrom Bridge

```
StreamFlow
  ↓
  Entdeckt Stalker-Portale
  ↓
  Übergibt an MACstrom
  ↓
  MACstrom scannt MACs
```

**Vorteil**: StreamFlow als Discovery-Layer

### Szenario 3: Hybrid-Architektur

```
MACstrom (Scanner)
  ↓
  Findet MACs
  ↓
StreamFlow (Quality-Checker)
  ↓
  Bewertet Streams
  ↓
Dispatcharr (Consumer)
```

**Vorteil**: Best-of-Both-Worlds

## Lessons Learned für StreamFlow

### 1. Quality-Scoring-System (⭐ Wichtigste Lektion)

**Von MACstrom lernen**:
- **Reference-Bitrate Sigmoid** statt einfacher Bitrate-Vergleich
- **Codec-Awareness** (HEVC braucht weniger Bitrate als H.264)
- **Composite QoE Score** (Quality × Reliability × Stalling-Penalty)
- **PTS-basierte Bitrate** statt Container-Metadata

**Implementierung für StreamFlow**:
```python
# Aktuell (einfach)
score = bitrate / 1000  # Zu simpel

# Besser (Reference-Bitrate Sigmoid)
REFERENCE_BITRATES = {
    ('h264', '4k'): 35000,
    ('h264', '1080p'): 8000,
    ('h264', '720p'): 4000,
    ('hevc', '4k'): 16000,
    ('hevc', '1080p'): 4500,
    # ...
}

def quality_score(bitrate, codec, resolution):
    ref = REFERENCE_BITRATES.get((codec, resolution), 8000)
    ratio = bitrate / ref
    adequacy = 1 / (1 + math.exp(-3.5 * (ratio - 0.7)))
    ceiling = {'4k': 100, '1080p': 90, '720p': 75, 'sd': 55}
    return round(ceiling[resolution] * adequacy)

def composite_qoe(quality, success_rate, stall_rate):
    reliability = success_rate if attempts >= 3 else 1.0
    stall_factor = max(0.3, 1.0 - stall_rate * 0.5)
    return quality * reliability * stall_factor
```

### 2. Dead-Stream-Detection

**Von MACstrom lernen**:
- Unified Threshold (200 kbps für Probe + Streaming)
- Separate Behandlung von Bad-Streams (kein Stall-Penalty)
- Automatic Re-Probe von Off-Air-Streams

**Implementierung**:
```python
NOT_STREAMING_THRESHOLD = 200  # kbps

def is_dead_stream(bitrate):
    return bitrate < NOT_STREAMING_THRESHOLD

def mark_not_streaming(stream_id):
    # Separate von Stall-Tracking
    stream.not_streaming = True
    stream.quality_score = 0
    # MAC bleibt available (kein Cooldown)
```

### 3. Live Bitrate Feedback

**Von MACstrom lernen**:
- Update Quality-Score während Streaming
- Kein Extra-FFmpeg-Call nötig
- Clears stale Off-Air-Flags

**Implementierung**:
```python
# Nach 10s Health-Check
observed_bitrate = (total_bytes * 8) / elapsed_seconds

if stream.has_probe_metadata():
    # Update Quality-Score mit fresh Bitrate
    stream.quality_score = quality_score(
        observed_bitrate,
        stream.codec,
        stream.resolution
    )
    
    # Clear Off-Air-Flag wenn Bitrate OK
    if observed_bitrate >= NOT_STREAMING_THRESHOLD:
        stream.not_streaming = False
```

### 4. Probe-Failure-Diagnostics

**Von MACstrom lernen**:
- Klassifizierte Fehler-Labels statt Generic-Errors
- HTTP 403 = Geo-blocked
- HTTP 5xx = Server-Error
- Connection-Refused = Portal-Unreachable

**Implementierung**:
```python
def classify_probe_error(error):
    if '403' in str(error):
        return "Geo-blocked (403)"
    elif '451' in str(error):
        return "Blocked (451)"
    elif '5' in str(error)[:1]:  # 5xx
        return "Server error"
    elif 'Connection refused' in str(error):
        return "Portal unreachable"
    elif 'No data' in str(error):
        return "No data received"
    else:
        return str(error)
```

### 5. Concurrency-Model

**Von MACstrom lernen**:
- Async/await statt Threading
- asyncio statt ThreadPoolExecutor
- aiohttp statt requests

**Implementierung**:
```python
# Aktuell (Threading)
with ThreadPoolExecutor() as executor:
    futures = [executor.submit(check, s) for s in streams]

# Besser (asyncio)
async def check_all(streams):
    tasks = [check_stream(s) for s in streams]
    return await asyncio.gather(*tasks)
```

### 2. FFmpeg-Integration

**Von MACstrom lernen**:
- FFmpeg-Python-Bindings statt subprocess
- Persistent FFmpeg-Prozesse
- Shared Memory für Frames

**Implementierung**:
```python
# Aktuell (subprocess)
subprocess.run(['ffmpeg', ...])

# Besser (ffmpeg-python)
import ffmpeg
stream = ffmpeg.input(url)
probe = ffmpeg.probe(url)
```

### 3. Type-Safety

**Von MACstrom lernen**:
- Pydantic für Data-Validation
- Type-Hints überall
- mypy für Static-Checking

**Implementierung**:
```python
from pydantic import BaseModel, HttpUrl

class Stream(BaseModel):
    id: int
    url: HttpUrl  # Type-safe URL
    bitrate: Optional[int] = None
```

### 4. Configuration-Management

**Von MACstrom lernen**:
- JSON-Schema-Validation
- Hot-Reload ohne Restart
- Per-Portal-Settings

**Implementierung**:
```python
from jsonschema import validate

config_schema = {
    "type": "object",
    "properties": {
        "max_workers": {"type": "integer"},
        ...
    }
}
validate(config, config_schema)
```

### 5. Error-Handling

**Von MACstrom lernen**:
- Structured Logging
- Error-Classification
- Retry-Strategies

**Implementierung**:
```python
# Aktuell
logger.warning(f"Stream failed: {e}")

# Besser
logger.warning(
    "Stream check failed",
    extra={
        "stream_id": stream_id,
        "error_class": classify_error(e),
        "retry_count": retry_count
    }
)
```

## Empfehlungen für StreamFlow

### Kurzfristig (Quick Wins)

1. **Reference-Bitrate Sigmoid Scoring**: Ersetze einfachen Bitrate-Score
2. **Dead-Stream-Detection**: Unified 200 kbps Threshold
3. **Probe-Failure-Diagnostics**: Klassifizierte Error-Labels
4. **Live Bitrate Feedback**: Update Scores während Streaming
5. **Composite QoE Score**: Quality × Reliability × Stalling

### Mittelfristig

1. **asyncio Migration**: Ersetze ThreadPoolExecutor durch asyncio
2. **Type-Hints**: Füge Pydantic-Models hinzu
3. **FFmpeg-Bindings**: Nutze ffmpeg-python statt subprocess
4. **Structured Logging**: JSON-Logs mit Context
5. **PTS-basierte Bitrate**: Statt Container-Metadata

### Langfristig

1. **Cross-Portal-Merging**: Kanäle über mehrere Portale mergen
2. **Death-Spiral-Prevention**: Error-Frames statt Black-Screen
3. **Rust-Rewrite?**: Kritische Pfade in Rust (PyO3)
4. **WASM-Frontend**: React → Leptos/Yew
5. **Native-Binary**: Optional Rust-Binary neben Python

## Konkrete Implementierungs-Roadmap

### Phase 1: Quality-Scoring-Upgrade (1-2 Wochen)

```python
# 1. Reference-Bitrate-Tabelle
REFERENCE_BITRATES = {
    ('h264', '4k'): 35000,
    ('h264', '1080p'): 8000,
    ('h264', '720p'): 4000,
    ('h264', 'sd'): 1500,
    ('hevc', '4k'): 16000,
    ('hevc', '1080p'): 4500,
    ('hevc', '720p'): 2500,
    ('hevc', 'sd'): 900,
}

# 2. Sigmoid-Scoring
def quality_score(bitrate, codec, resolution):
    ref = REFERENCE_BITRATES.get((codec, resolution), 8000)
    ratio = bitrate / ref
    adequacy = 1 / (1 + math.exp(-3.5 * (ratio - 0.7)))
    ceiling = {'4k': 100, '1080p': 90, '720p': 75, 'sd': 55}
    fps_factor = 1.08 if fps >= 48 else 1.0 if fps >= 20 else 0.85
    return round(ceiling[resolution] * adequacy * fps_factor)

# 3. Composite QoE
def effective_qoe(quality, success_rate, stall_rate, attempts):
    reliability = success_rate if attempts >= 3 else 1.0
    stall_factor = max(0.3, 1.0 - stall_rate * 0.5)
    return round(quality * reliability * stall_factor)
```

### Phase 2: Dead-Stream-Detection (1 Woche)

```python
NOT_STREAMING_THRESHOLD = 200  # kbps

def is_dead_stream(bitrate):
    return bitrate < NOT_STREAMING_THRESHOLD

def mark_not_streaming(stream_id):
    stream.not_streaming = True
    stream.quality_score = 0
    # Separate von Stall-Tracking
```

### Phase 3: Live Bitrate Feedback (1 Woche)

```python
# Nach Health-Check
observed_bitrate = (total_bytes * 8) / elapsed_seconds

if stream.has_probe_metadata():
    stream.quality_score = quality_score(
        observed_bitrate,
        stream.codec,
        stream.resolution
    )
```

### Phase 4: Probe-Failure-Diagnostics (3 Tage)

```python
def classify_probe_error(error):
    if '403' in str(error):
        return "Geo-blocked (403)"
    elif '5' in str(error)[:1]:
        return "Server error"
    # ...
```

## Fazit

**MACstrom** und **StreamFlow** sind komplementär, aber MACstrom ist technisch deutlich fortgeschrittener:

**MACstrom-Stärken**:
- ⭐ **Sehr fortgeschrittenes Quality-Management** (Reference-Bitrate Sigmoid, Composite QoE, PTS-basiert)
- ⭐ **Cross-Portal-Merging** mit automatischem Failover
- ⭐ **In-process FFmpeg** (Zero-Copy FFI)
- ⭐ **Death-Spiral-Prevention** (Error-Frames)
- Native Rust Performance
- Zero-JavaScript (WASM)

**StreamFlow-Stärken**:
- ✓ **Dispatcharr-Integration** (native XC-API)
- ✓ **Flexible Python-Entwicklung**
- ✓ **Profile-Failover** (Multi-Account)
- ✓ **Early-Exit-Optimization**
- Größeres Python-Ecosystem

**Beste Strategie**: 
1. Beide parallel nutzen (verschiedene Use-Cases)
2. StreamFlow von MACstrom lernen (Quality-Scoring, Dead-Stream-Detection)
3. Langfristig: Kritische StreamFlow-Pfade in Rust (PyO3)

**StreamFlow sollte prioritär implementieren**:
1. ⭐ Reference-Bitrate Sigmoid Scoring (größter Impact)
2. ⭐ Composite QoE Score (Quality × Reliability × Stalling)
3. ⭐ Dead-Stream-Detection (200 kbps Threshold)
4. Live Bitrate Feedback
5. Probe-Failure-Diagnostics

**MACstrom kann von StreamFlow lernen**:
- Dispatcharr-Integration-Patterns
- Web-UI-Komponenten (React → Leptos)
- CSV-Export-Features
- Channel-Regex-Assignment-Konzepte
