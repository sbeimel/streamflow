# Multi-Output Routing - Detaillierte Erklärung

## Was ist Multi-Output Routing?

**Multi-Output Routing** bedeutet, dass FFmpeg einen Stream gleichzeitig an mehrere Ziele sendet:

```
                    ┌─────────────────────┐
                    │   Original Stream   │
                    │  (z.B. IPTV-URL)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │      FFmpeg         │
                    │   (1x Input)        │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼────────┐  ┌───▼────────┐  ┌───▼────────┐
    │  UDP Port A      │  │ UDP Port B │  │  null      │
    │  (Primary)       │  │ (Sidecar)  │  │  (Stats)   │
    │  10000+stream_id │  │ 20000+...  │  │            │
    └──────────────────┘  └────────────┘  └────────────┘
```

## Wie funktioniert es?

### 1. **Ohne Multi-Output (Root-Version)**
```bash
ffmpeg -i <stream_url> -c copy -f null -
```
- Stream wird nur analysiert
- Keine Weiterleitung
- Nur Stats werden gesammelt

### 2. **Mit Multi-Output (dev2-Version)**
```bash
ffmpeg -i <stream_url> \
  -map 0 -c copy -f mpegts udp://127.0.0.1:10001 \  # Port A (Primary)
  -map 0 -c copy -f mpegts udp://127.0.0.1:20001 \  # Port B (Sidecar)
  -map 0 -c copy -f null -                          # Stats
```

**Erklärung:**
- `-map 0` = Nimm alle Streams vom Input
- `-c copy` = Kopiere ohne Re-Encoding (sehr schnell!)
- `-f mpegts` = Format für UDP-Transport
- `-f null` = Dummy-Output für Stats

## Warum 3 Outputs?

### Output 1: UDP Port A (Primary Monitor)
- **Port:** `10000 + stream_id` (z.B. Stream 123 → Port 10123)
- **Zweck:** Hauptmonitor liest von hier
- **Nutzen:** Real-time Stats (bitrate, fps, resolution)

### Output 2: UDP Port B (Sidecar Loop Detector)
- **Port:** `20000 + stream_id` (z.B. Stream 123 → Port 20123)
- **Zweck:** Loop Detection liest von hier
- **Nutzen:** Erkennt Content-Loops (fehlerhafte Streams)

### Output 3: null (Stats Collection)
- **Zweck:** FFmpeg generiert Stats im stderr
- **Nutzen:** Parsing von Metadaten

## Primary-Sidecar System

```
┌─────────────────────────────────────────────────────────┐
│                    FFmpeg Monitor                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Input: Original Stream URL                      │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │                                      │
│  ┌────────────────┼─────────────────────────────────┐  │
│  │                │                                  │  │
│  │  ┌─────────────▼──────────┐  ┌─────────────────┐│  │
│  │  │  UDP Port A (Primary)  │  │ UDP Port B      ││  │
│  │  │  - Bitrate Monitoring  │  │ - Loop Detection││  │
│  │  │  - FPS Tracking        │  │ - pHash Compare ││  │
│  │  │  - Resolution Check    │  │ - Sequence Match││  │
│  │  │  - Speed Monitoring    │  │                 ││  │
│  │  └────────────────────────┘  └─────────────────┘│  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Vorteile von Multi-Output Routing

### 1. **Parallele Analyse**
- Primary Monitor: Real-time Stats
- Sidecar: Loop Detection
- Beide laufen gleichzeitig ohne Overhead

### 2. **Kein Re-Encoding**
- `-c copy` = Nur Kopieren, kein Transcoding
- Sehr geringe CPU-Last
- Keine Qualitätsverluste

### 3. **Isolation**
- Primary und Sidecar sind unabhängig
- Wenn Sidecar crasht, läuft Primary weiter
- Separate Prozesse = bessere Fehlertoleranz

### 4. **Skalierbarkeit**
- Jeder Stream bekommt eigene Ports
- Keine Port-Konflikte
- Bis zu 10.000+ Streams möglich

## Code-Beispiel aus dev2

```python
# Port-Berechnung
self.port_a = 10000 + stream_id  # Primary
self.port_b = 20000 + stream_id  # Sidecar

# FFmpeg Command
cmd = [
    'ffmpeg',
    '-hide_banner',
    '-nostdin',
    '-i', self.url,
    '-c', 'copy',
    # Multi-Output Routing:
    '-map', '0', '-c', 'copy', '-f', 'mpegts', f'udp://127.0.0.1:{self.port_a}',
    '-map', '0', '-c', 'copy', '-f', 'mpegts', f'udp://127.0.0.1:{self.port_b}',
    '-map', '0', '-c', 'copy', '-f', 'null', '-'
]
```

## Sidecar Loop Detector

Der Sidecar liest von Port B und analysiert Frames:

```python
# Sidecar FFmpeg Command
cmd = [
    'ffmpeg',
    '-i', f'udp://127.0.0.1:{port_b}',
    '-vf', 'scale=32:32:flags=fast_bilinear,format=gray',
    '-c:v', 'ppm',
    '-f', 'image2pipe',
    'pipe:1'
]

# Loop Detection
detector = SidecarLoopDetector(proc.stdout)
detector.run()  # Analysiert Frames mit pHash
```

## Performance-Vergleich

### Root-Version (Einmalige Checks)
```
Stream Check:
├─ FFmpeg Start: 2-3s
├─ Analyse: 8s
├─ FFmpeg Stop: 1s
└─ Total: ~12s pro Stream

Bei 100 Streams: 20 Minuten (mit 5 Workers)
```

### dev2-Version (Kontinuierlich)
```
Stream Monitor:
├─ FFmpeg Start: 2-3s (einmalig)
├─ Monitoring: ∞ (kontinuierlich)
├─ Stats Update: Jede Sekunde
└─ CPU: ~5% pro Stream (copy mode)

Bei 100 Streams: Permanent aktiv, ~500% CPU
```

## Wann welche Version?

### Root-Version (Interval-basiert)
**Gut für:**
- Reguläre Automation (alle X Stunden)
- Batch-Processing vieler Channels
- Ressourcen-schonend
- Einfache Wartung

**Schlecht für:**
- Live-Events (zu langsam)
- Real-time Monitoring
- Schnelle Reaktion auf Ausfälle

### dev2-Version (Event-basiert)
**Gut für:**
- Live-Events (Fußball, Formel 1, etc.)
- Real-time Monitoring
- Schnelle Failover-Erkennung
- Loop Detection

**Schlecht für:**
- Viele Channels gleichzeitig (CPU-Last)
- Langzeit-Monitoring (Ressourcen)
- Einfache Use Cases

---

## Fazit: Welche Version ist besser?

### ✅ **Root-Version für:**
- Reguläre Automation (dein aktueller Use Case)
- Viele Channels (298 Channels)
- Ressourcen-Effizienz
- Einfachheit

### ✅ **dev2-Version für:**
- Live-Event Monitoring (z.B. Fußball-Spiel)
- Wenige Channels gleichzeitig (1-10)
- Maximale Qualität
- Loop Detection

### 🎯 **Empfehlung:**
**HYBRID-ANSATZ:**
1. **Root als Haupt-System** (reguläre Automation)
2. **dev2 als "Live Event Mode"** (optional aktivierbar)
3. **Portiere Loop Detection** aus dev2 nach Root (als Feature)

---

**Erstellt:** 2026-03-02
**Autor:** Kiro AI Assistant
