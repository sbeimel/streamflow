# StreamFlow vs MACstrom: Scoring-Vergleich

## TL;DR

**StreamFlow HAT bereits ein Scoring-System**, aber MACstrom's Ansatz ist **wissenschaftlicher und präziser**:

- StreamFlow: Gewichtete Summe (Linear)
- MACstrom: Reference-Bitrate Sigmoid (Nicht-linear, codec-aware)

---

## StreamFlow's Aktuelles Scoring

### Formel (Gewichtete Summe)

```python
score = (
    (bitrate / 8000) * 0.40 +           # Bitrate (0-1)
    resolution_score * 0.35 +            # Resolution (0-1)
    (fps / 60) * 0.15 +                  # FPS (0-1)
    codec_score * 0.10 +                 # Codec (0-1)
    priority_boost +                     # M3U Priority
    quality_preference_boost             # Channel Preference
)
```

### Komponenten

| Komponente | Gewicht | Berechnung |
|------------|---------|------------|
| Bitrate | 40% | `min(bitrate / 8000, 1.0)` |
| Resolution | 35% | 1080p=1.0, 720p=0.7, 576p=0.5, <576p=0.3 |
| FPS | 15% | `min(fps / 60, 1.0)` |
| Codec | 10% | HEVC=1.0, H.264=0.8 (wenn prefer_h265=true) |

### Beispiel-Scores

```python
# Stream 1: 1080p H.264 @ 8 Mbps, 50 FPS
bitrate_score = 8000 / 8000 = 1.0
resolution_score = 1.0
fps_score = 50 / 60 = 0.83
codec_score = 0.8
score = 1.0*0.40 + 1.0*0.35 + 0.83*0.15 + 0.8*0.10 = 0.95

# Stream 2: 720p H.264 @ 4 Mbps, 25 FPS
bitrate_score = 4000 / 8000 = 0.5
resolution_score = 0.7
fps_score = 25 / 60 = 0.42
codec_score = 0.8
score = 0.5*0.40 + 0.7*0.35 + 0.42*0.15 + 0.8*0.10 = 0.61

# Stream 3: Off-Air (145 kbps)
bitrate_score = 145 / 8000 = 0.018
resolution_score = 0.3 (SD)
fps_score = 25 / 60 = 0.42
codec_score = 0.8
score = 0.018*0.40 + 0.3*0.35 + 0.42*0.15 + 0.8*0.10 = 0.26
```

---

## MACstrom's Scoring

### Formel (Reference-Bitrate Sigmoid)

```rust
// 1. Ratio zur Reference-Bitrate
ratio = actual_bitrate / reference_bitrate

// 2. Sigmoid-Adequacy (nicht-linear)
adequacy = 1 / (1 + exp(-3.5 × (ratio - 0.7)))

// 3. Resolution-Ceiling
ceiling = { 4K: 100, 1080p: 90, 720p: 75, SD: 55 }

// 4. FPS-Factor
fps_factor = { ≥48fps: 1.08, 20-48fps: 1.00, <20fps: 0.85 }

// 5. Final Score
score = ceiling × adequacy × fps_factor
```

### Reference-Bitrate-Tabelle (Codec-Aware!)

| Codec | 4K | 1080p | 720p | SD |
|-------|----|-------|------|----|
| H.264 | 35,000 | 8,000 | 4,000 | 1,500 |
| HEVC | 16,000 | 4,500 | 2,500 | 900 |
| AV1 | 12,000 | 3,500 | 2,000 | 700 |

### Beispiel-Scores

```rust
// Stream 1: 1080p H.264 @ 8 Mbps, 50 FPS
ratio = 8000 / 8000 = 1.0
adequacy = 1 / (1 + exp(-3.5 × (1.0 - 0.7))) = 0.83
ceiling = 90
fps_factor = 1.08
score = 90 × 0.83 × 1.08 = 81

// Stream 2: 720p H.264 @ 4 Mbps, 25 FPS
ratio = 4000 / 4000 = 1.0
adequacy = 1 / (1 + exp(-3.5 × (1.0 - 0.7))) = 0.83
ceiling = 75
fps_factor = 1.0
score = 75 × 0.83 × 1.0 = 62

// Stream 3: Off-Air (145 kbps, SD)
ratio = 145 / 1500 = 0.097
adequacy = 1 / (1 + exp(-3.5 × (0.097 - 0.7))) = 0.01
ceiling = 55
fps_factor = 1.0
score = 55 × 0.01 × 1.0 = 0.55 ≈ 0
```

---

## Hauptunterschiede

### 1. Codec-Awareness

**StreamFlow** (Simpel):
```python
# HEVC bekommt nur 20% Bonus
if codec == 'hevc':
    codec_score = 1.0
elif codec == 'h264':
    codec_score = 0.8
```

**Problem**: 
- 1080p HEVC @ 4.5 Mbps = Score: 0.73
- 1080p H.264 @ 8 Mbps = Score: 0.95
- **HEVC wird bestraft**, obwohl gleiche Qualität!

**MACstrom** (Codec-Aware):
```rust
// Verschiedene Reference-Bitrates pro Codec
ref_h264 = 8000  // 1080p
ref_hevc = 4500  // 1080p

// 1080p HEVC @ 4.5 Mbps
ratio = 4500 / 4500 = 1.0 → Score: 75

// 1080p H.264 @ 8 Mbps
ratio = 8000 / 8000 = 1.0 → Score: 75

// GLEICHER SCORE! ✓
```

### 2. Bitrate-Normalisierung

**StreamFlow** (Linear):
```python
bitrate_score = min(bitrate / 8000, 1.0)

# Beispiele:
2000 kbps → 0.25
4000 kbps → 0.50
6000 kbps → 0.75
8000 kbps → 1.00
16000 kbps → 1.00 (capped)
```

**Problem**: 
- Linear = keine Unterscheidung zwischen "gut genug" und "overkill"
- 16 Mbps bekommt gleichen Score wie 8 Mbps

**MACstrom** (Sigmoid):
```rust
// Nicht-lineare Kurve
adequacy = 1 / (1 + exp(-3.5 × (ratio - 0.7)))

# Beispiele (1080p H.264, ref=8000):
2000 kbps (25%) → adequacy: 0.05 → Score: 5
4000 kbps (50%) → adequacy: 0.27 → Score: 24
6000 kbps (75%) → adequacy: 0.64 → Score: 58
8000 kbps (100%) → adequacy: 0.83 → Score: 75
16000 kbps (200%) → adequacy: 0.99 → Score: 89
```

**Vorteil**: 
- Steile Kurve im kritischen Bereich (40-100% von Reference)
- Diminishing Returns über Reference
- Klare Penalty unter Threshold

### 3. Off-Air-Detection

**StreamFlow**:
```python
# Kein expliziter Threshold
# 145 kbps Off-Air-Stream bekommt:
score = 0.018*0.40 + 0.3*0.35 + 0.42*0.15 + 0.8*0.10 = 0.26
# Immer noch 26% Score!
```

**MACstrom**:
```rust
if bitrate < 200 {  // kbps
    return 0;  // Off-Air
}
```

**Vorteil**: Klare Trennung zwischen "schlecht" und "off-air"

### 4. Resolution-Ceiling

**StreamFlow**:
```python
# Alle Resolutionen können Score 1.0 erreichen
# 720p @ 8 Mbps = 0.95 (fast perfekt)
```

**MACstrom**:
```rust
// Resolution-spezifische Ceilings
4K: max 100
1080p: max 90
720p: max 75
SD: max 55

// 720p kann NIEMALS 1080p schlagen
// Selbst perfekte 720p = 75
// Mittelmäßige 1080p = 60-70
```

**Vorteil**: Resolution-Hierarchie wird respektiert

---

## Vergleich: Gleiche Streams

### Test-Streams

| Stream | Resolution | Codec | Bitrate | FPS |
|--------|-----------|-------|---------|-----|
| A | 1080p | H.264 | 8 Mbps | 50 |
| B | 1080p | HEVC | 4.5 Mbps | 25 |
| C | 720p | H.264 | 4 Mbps | 25 |
| D | 720p | H.264 | 8 Mbps | 50 |
| E | SD | H.264 | 145 kbps | 25 |

### StreamFlow-Scores

```python
A: 0.95  # 1080p H.264 @ 8 Mbps, 50 FPS
B: 0.73  # 1080p HEVC @ 4.5 Mbps, 25 FPS ← HEVC bestraft!
C: 0.61  # 720p H.264 @ 4 Mbps, 25 FPS
D: 0.88  # 720p H.264 @ 8 Mbps, 50 FPS ← 720p schlägt 1080p HEVC!
E: 0.26  # SD @ 145 kbps ← Off-Air bekommt 26%!
```

**Problem**: Stream D (720p) schlägt Stream B (1080p HEVC)!

### MACstrom-Scores

```rust
A: 81  # 1080p H.264 @ 8 Mbps, 50 FPS
B: 75  # 1080p HEVC @ 4.5 Mbps, 25 FPS ← Gleich gut wie A!
C: 62  # 720p H.264 @ 4 Mbps, 25 FPS
D: 67  # 720p H.264 @ 8 Mbps, 50 FPS ← Kann 1080p nicht schlagen
E: 0   # SD @ 145 kbps ← Off-Air = 0
```

**Vorteil**: Korrekte Hierarchie (1080p > 720p, HEVC-Effizienz erkannt)

---

## Was StreamFlow verbessern sollte

### 1. Codec-Aware Reference-Bitrates

**Aktuell**:
```python
bitrate_score = min(bitrate / 8000, 1.0)  # Immer 8000
```

**Besser**:
```python
REFERENCE_BITRATES = {
    ('h264', '1080p'): 8000,
    ('hevc', '1080p'): 4500,
    ('h264', '720p'): 4000,
    ('hevc', '720p'): 2500,
    # ...
}

ref = REFERENCE_BITRATES.get((codec, resolution), 8000)
bitrate_score = min(bitrate / ref, 1.0)
```

### 2. Sigmoid statt Linear

**Aktuell**:
```python
bitrate_score = min(bitrate / 8000, 1.0)  # Linear
```

**Besser**:
```python
ratio = bitrate / ref
adequacy = 1 / (1 + math.exp(-3.5 * (ratio - 0.7)))
bitrate_score = adequacy
```

### 3. Off-Air-Threshold

**Aktuell**:
```python
# Kein expliziter Threshold
```

**Besser**:
```python
if bitrate < 200:  # kbps
    return 0.0  # Off-Air
```

### 4. Resolution-Ceiling

**Aktuell**:
```python
# Alle Resolutionen gleichwertig
```

**Besser**:
```python
CEILINGS = {
    '4k': 1.00,
    '1080p': 0.90,
    '720p': 0.75,
    'sd': 0.55
}

score = base_score * CEILINGS[resolution]
```

---

## Zusammenfassung

### StreamFlow's Scoring (Aktuell)

✅ **Gut**:
- Funktioniert
- Berücksichtigt alle wichtigen Faktoren
- Konfigurierbare Gewichte
- M3U-Priority-Integration

❌ **Probleme**:
- Nicht codec-aware (HEVC wird bestraft)
- Linear (keine Sigmoid-Kurve)
- Kein Off-Air-Threshold
- 720p kann 1080p schlagen

### MACstrom's Scoring

✅ **Besser**:
- Codec-aware (verschiedene Reference-Bitrates)
- Sigmoid-Kurve (nicht-linear)
- Off-Air-Threshold (< 200 kbps)
- Resolution-Ceiling (Hierarchie)
- Wissenschaftlich fundiert (ITU-T P.1203.3)

### Empfehlung

**StreamFlow sollte upgraden auf**:
1. Codec-aware Reference-Bitrates (größter Impact!)
2. Sigmoid statt Linear
3. Off-Air-Threshold (200 kbps)
4. Resolution-Ceiling

**Aufwand**: ~1-2 Tage Implementierung
**Benefit**: Deutlich bessere Stream-Auswahl
