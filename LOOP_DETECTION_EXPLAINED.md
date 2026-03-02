# Loop Detection - Detaillierte Erklärung

## Was ist Loop Detection?

**Loop Detection** erkennt, wenn ein Stream **denselben Content wiederholt** (in einer Schleife läuft).

### Beispiel-Szenario:

```
Normaler Stream:
00:00 - Werbung
00:30 - Spielbeginn
01:00 - Tor!
01:30 - Halbzeit
...

Stream mit Loop (FEHLER):
00:00 - Werbung
00:30 - Spielbeginn
01:00 - Tor!
01:30 - Werbung  ← WIEDERHOLT SICH!
02:00 - Spielbeginn
02:30 - Tor!
03:00 - Werbung  ← WIEDER!
...
```

## Warum passiert das?

### Häufige Ursachen:

1. **Fehlerhafte IPTV-Provider**
   - Server spielt alte Aufnahme in Schleife
   - Statt Live-Stream läuft Recording

2. **Proxy-Probleme**
   - Proxy cached alten Content
   - Liefert immer dieselben 30 Sekunden

3. **Stream-Fehler**
   - Verbindung unterbrochen
   - Fallback auf Loop-Content

4. **Test-Streams**
   - Provider testet mit Loop-Video
   - Kein echter Live-Content

## Wie funktioniert Loop Detection?

### Algorithmus (Perceptual Hashing)

```
┌─────────────────────────────────────────────────────┐
│  1. Frame Extraction                                 │
│     FFmpeg → PPM Frames (32x32 Grayscale)          │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  2. pHash Generation                                 │
│     Frame → Perceptual Hash (64-bit)               │
│     Ähnliche Bilder = ähnliche Hashes              │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  3. Sequence Matching                                │
│     Vergleiche aktuelle 3 Frames mit History       │
│     [H0, H-1, H-2] vs [H-t, H-(t+1), H-(t+2)]     │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  4. Loop Detection                                   │
│     Wenn Sequence wiederholt: LOOP DETECTED!       │
│     Duration: t0 - t_match                         │
└─────────────────────────────────────────────────────┘
```

### Perceptual Hash (pHash)

**Was ist pHash?**
- Erzeugt "Fingerabdruck" eines Bildes
- Ähnliche Bilder haben ähnliche Hashes
- Robust gegen kleine Änderungen (Kompression, Helligkeit)

**Beispiel:**
```python
Frame 1: Fußballfeld mit Ball links
pHash: 0b1010110101010101...

Frame 2: Fußballfeld mit Ball rechts (ähnlich)
pHash: 0b1010110101010111...  ← Nur 1 Bit unterschied!

Frame 3: Werbung (komplett anders)
pHash: 0b0101001010101010...  ← Viele Bits unterschiedlich
```

### Hamming Distance

**Vergleich von Hashes:**
```python
Hash A: 0b1010110101010101
Hash B: 0b1010110101010111
        ^^^^^^^^^^^^^^XX^^  ← 2 Bits unterschiedlich

Hamming Distance = 2

Wenn Distance ≤ 5: Frames sind "ähnlich"
```

## Code-Beispiel aus dev2

```python
class SidecarLoopDetector:
    def detect_loop(self) -> Optional[float]:
        # 1. Hole letzte 3 Frames
        recent = list(self.buffer)[-3:]
        h_2, h_1, h0 = [item[1] for item in recent]
        
        # 2. Vergleiche mit History
        for i in range(len(history) - 3 + 1):
            # Match Sequence?
            match_t2 = history[i][1] - h_2 <= 5      # Hamming ≤ 5
            match_t1 = history[i+1][1] - h_1 <= 5
            match_t0 = history[i+2][1] - h0 <= 5
            
            if match_t2 and match_t1 and match_t0:
                # LOOP DETECTED!
                duration = t0 - t_match
                if duration >= 10.0:  # Min 10s Loop
                    return duration
        
        return None
```

## Visualisierung

### Normaler Stream (kein Loop)
```
Time:  0s    5s    10s   15s   20s   25s   30s
Hash:  A  →  B  →  C  →  D  →  E  →  F  →  G
       ✓     ✓     ✓     ✓     ✓     ✓     ✓
       Alle unterschiedlich = OK
```

### Stream mit Loop
```
Time:  0s    5s    10s   15s   20s   25s   30s
Hash:  A  →  B  →  C  →  A  →  B  →  C  →  A
       ✓     ✓     ✓     ⚠️    ⚠️    ⚠️    🚨
                         └─────┬─────┘
                         LOOP DETECTED!
                         Duration: 15s
```

## Thresholds in dev2

```python
SEQUENCE_LENGTH = 3           # 3 Frames für Match
HAMMING_TOLERANCE = 5         # Max 5 Bit Unterschied
LOOP_DURATION_THRESHOLD = 10.0  # Min 10s Loop
BUFFER_MAXLEN = 300           # 5 Min History (bei 1fps)
```

## Warum 3 Frames?

**1 Frame:** Zu ungenau (False Positives)
```
Frame: A → B → A → C
       ↑       ↑
       Zufall, kein Loop!
```

**3 Frames:** Sehr genau
```
Sequence: [A,B,C] → [D,E,F] → [A,B,C]
                                ↑
                         Definitiv Loop!
```

## Static Image Filter

**Problem:** Schwarzer Bildschirm oder Standbild
```
Time:  0s    5s    10s   15s
Hash:  A  →  A  →  A  →  A
       Alle gleich = Standbild, KEIN Loop!
```

**Lösung:**
```python
# Wenn 3 letzte Frames identisch: Ignorieren
if (h0 - h_1 <= 5) and (h_1 - h_2 <= 5):
    return None  # Static image, not a loop
```

## Performance

### CPU-Last
```
Sidecar FFmpeg:
- Input: UDP Stream (bereits dekodiert)
- Scale: 32x32 (sehr klein!)
- Format: Grayscale (1 Kanal statt 3)
- Output: PPM (einfaches Format)

CPU: ~2-3% pro Stream
```

### Speicher
```
Buffer: 300 Frames × 64 Bit = 2.4 KB
Sehr gering!
```

## Vorteile von Loop Detection

### 1. **Fehlerhafte Streams erkennen**
```
Ohne Loop Detection:
- Stream läuft scheinbar "gut"
- Bitrate OK, FPS OK
- Aber: Zeigt alten Content!
- User beschwert sich

Mit Loop Detection:
- Loop nach 30s erkannt
- Stream automatisch quarantined
- Nächster Stream wird aktiviert
```

### 2. **Automatische Quarantine**
```python
if detected_duration:
    logger.warning(f"LOOP DETECTED: {detected_duration:.2f}s")
    stream_info.status_reason = 'looping'
    self.session_manager.quarantine_stream(session_id, stream_id)
    self._remove_stream_from_dispatcharr(session_id, stream_id, "looping")
```

### 3. **Längere Review-Zeit**
```python
# Normale Review: 60s
# Loop Review: 600s (10 Minuten)

if getattr(info, 'status_reason', None) == 'looping':
    review_limit = self.session_manager.get_loop_review_duration()
```

## Beispiel aus der Praxis

### Szenario: Fußball-Spiel

```
18:00 - Stream startet
18:05 - Werbung läuft
18:10 - Spielbeginn
18:15 - LOOP DETECTED! (Werbung wiederholt sich)
        → Stream quarantined
        → Nächster Stream aktiviert
18:16 - Neuer Stream läuft
18:20 - Tor! (User sieht es live)

Ohne Loop Detection:
18:15 - User sieht alte Werbung in Schleife
18:20 - User verpasst Tor
18:25 - User beschwert sich
```

## Vergleich: Root vs dev2

| Feature | Root | dev2 |
|---------|------|------|
| **Loop Detection** | ❌ Keine | ✅ Ja |
| **Erkennung** | Nur tote Streams | Loops + tote Streams |
| **False Positives** | - | Sehr gering (3-Frame Sequence) |
| **CPU-Last** | - | ~2-3% pro Stream |
| **Reaktionszeit** | - | 10-30 Sekunden |

---

## Fazit

**Loop Detection ist wichtig für:**
- Live-Events (Fußball, Formel 1)
- Fehlerhafte IPTV-Provider
- Automatische Qualitätssicherung

**Aber:**
- Nur in dev2 verfügbar
- Benötigt kontinuierliches Monitoring
- Nicht für Batch-Processing geeignet

**Empfehlung:**
- Für Live-Events: dev2 nutzen
- Für reguläre Automation: Root reicht

---

**Erstellt:** 2026-03-02
**Autor:** Kiro AI Assistant
