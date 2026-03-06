# Enhanced Quality Scoring - Implementierungsanleitung

## Übersicht

Dieses Upgrade ersetzt StreamFlow's lineares Scoring durch MACstrom's wissenschaftlicheren Ansatz mit:
- Codec-aware Reference-Bitrates
- Sigmoid-Kurve (nicht-linear)
- Off-Air-Detection (< 200 kbps)
- Resolution-Ceiling

## Dateien

### Neu erstellt:
- `backend/quality_scoring.py` - Neues Scoring-Modul

### Zu ändern:
- `backend/stream_checker_service.py` - Integration des neuen Scorings

## Schritt-für-Schritt Integration

### Schritt 1: Neues Modul testen

```bash
# Test das neue Modul
cd backend
python quality_scoring.py
```

**Erwartete Ausgabe**:
```
Quality Scoring Test Results:
============================================================
1080p H.264 @ 8 Mbps, 50 FPS             → Score:  81
1080p HEVC @ 4.5 Mbps, 25 FPS            → Score:  75
720p H.264 @ 4 Mbps, 25 FPS              → Score:  62
720p H.264 @ 8 Mbps, 50 FPS              → Score:  67
Off-Air (145 kbps)                       → Score:   0
============================================================
```

### Schritt 2: Config-Option hinzufügen

In `backend/stream_checker_service.py`, füge zur Config hinzu:

```python
# In __init__ oder load_config
self.config.setdefault('scoring', {
    'method': 'enhanced',  # 'enhanced' oder 'legacy'
    'weights': {  # Nur für legacy
        'bitrate': 0.40,
        'resolution': 0.35,
        'fps': 0.15,
        'codec': 0.10
    },
    'prefer_h265': True
})
```

### Schritt 3: Import hinzufügen

Am Anfang von `stream_checker_service.py`:

```python
from quality_scoring import (
    calculate_stream_score_enhanced,
    calculate_quality_score,
    NOT_STREAMING_THRESHOLD
)
```

### Schritt 4: _calculate_stream_score ersetzen

**Aktuell** (Zeile 3303):
```python
def _calculate_stream_score(self, stream_data: Dict, channel_id: Optional[int] = None) -> float:
    """Calculate a quality score for a stream based on analysis."""
    # Dead streams always get a score of 0
    if self._is_stream_dead(stream_data):
        return 0.0
    
    # ... rest of legacy code ...
```

**Neu**:
```python
def _calculate_stream_score(self, stream_data: Dict, channel_id: Optional[int] = None) -> float:
    """Calculate a quality score for a stream based on analysis.
    
    Supports both enhanced (MACstrom-inspired) and legacy scoring methods.
    """
    # Dead streams always get a score of 0
    if self._is_stream_dead(stream_data):
        return 0.0
    
    # Get scoring method from config
    scoring_method = self.config.get('scoring.method', 'enhanced')
    use_legacy = (scoring_method == 'legacy')
    
    # Calculate base quality score
    if use_legacy:
        # Use legacy scoring
        weights = self.config.get('scoring.weights', {})
        score = calculate_stream_score_enhanced(
            stream_data,
            legacy_weights=weights,
            use_legacy_scoring=True
        )
    else:
        # Use enhanced scoring (MACstrom-inspired)
        score = calculate_stream_score_enhanced(
            stream_data,
            use_legacy_scoring=False
        )
    
    # Apply M3U account priority bonus (unchanged)
    stream_id = stream_data.get('stream_id')
    if stream_id:
        priority_boost = self._get_priority_boost(stream_id, stream_data)
        score += priority_boost
    
    # Apply channel-specific quality preference boost/penalty (unchanged)
    if channel_id:
        quality_boost = self._get_quality_preference_boost(stream_data, channel_id)
        score += quality_boost
    
    return round(score, 2)
```

### Schritt 5: Off-Air-Detection verbessern

In `_is_stream_dead` (oder wo auch immer Dead-Stream-Detection ist):

```python
def _is_stream_dead(self, stream_data: Dict) -> bool:
    """Check if stream is dead/off-air."""
    # Existing checks...
    
    # Add off-air detection
    bitrate = stream_data.get('bitrate_kbps', 0)
    if bitrate > 0 and bitrate < NOT_STREAMING_THRESHOLD:
        logger.debug(f"Stream detected as off-air: {bitrate} kbps < {NOT_STREAMING_THRESHOLD} kbps")
        return True
    
    # ... rest of existing logic ...
```

## Testing

### Test 1: Vergleich Legacy vs Enhanced

```python
# Test-Script erstellen: test_scoring_comparison.py
from quality_scoring import calculate_stream_score_enhanced

test_streams = [
    {
        'name': '1080p H.264 @ 8 Mbps',
        'bitrate_kbps': 8000,
        'video_codec': 'h264',
        'resolution': '1920x1080',
        'fps': 50,
        'status': 'OK'
    },
    {
        'name': '1080p HEVC @ 4.5 Mbps',
        'bitrate_kbps': 4500,
        'video_codec': 'hevc',
        'resolution': '1920x1080',
        'fps': 25,
        'status': 'OK'
    },
    {
        'name': '720p H.264 @ 8 Mbps',
        'bitrate_kbps': 8000,
        'video_codec': 'h264',
        'resolution': '1280x720',
        'fps': 50,
        'status': 'OK'
    },
    {
        'name': 'Off-Air (145 kbps)',
        'bitrate_kbps': 145,
        'video_codec': 'h264',
        'resolution': '720x576',
        'fps': 25,
        'status': 'OK'
    },
]

legacy_weights = {
    'bitrate': 0.40,
    'resolution': 0.35,
    'fps': 0.15,
    'codec': 0.10
}

print("Scoring Comparison: Legacy vs Enhanced")
print("=" * 80)
print(f"{'Stream':<30} {'Legacy':>10} {'Enhanced':>10} {'Difference':>10}")
print("-" * 80)

for stream in test_streams:
    legacy_score = calculate_stream_score_enhanced(
        stream, 
        legacy_weights=legacy_weights, 
        use_legacy_scoring=True
    )
    enhanced_score = calculate_stream_score_enhanced(
        stream, 
        use_legacy_scoring=False
    )
    diff = enhanced_score - legacy_score
    
    print(f"{stream['name']:<30} {legacy_score:>10.2f} {enhanced_score:>10.2f} {diff:>+10.2f}")

print("=" * 80)
```

**Erwartete Ausgabe**:
```
Scoring Comparison: Legacy vs Enhanced
================================================================================
Stream                         Legacy   Enhanced Difference
--------------------------------------------------------------------------------
1080p H.264 @ 8 Mbps             0.95       0.81      -0.14
1080p HEVC @ 4.5 Mbps            0.73       0.75      +0.02  ← HEVC jetzt besser!
720p H.264 @ 8 Mbps              0.88       0.67      -0.21  ← Kann 1080p nicht mehr schlagen
Off-Air (145 kbps)               0.26       0.00      -0.26  ← Off-Air erkannt!
================================================================================
```

### Test 2: Rescore bestehende Channels

```bash
# API-Call zum Rescore
curl -X POST http://localhost:5000/api/stream-checker/rescore-resort
```

## Rollback-Plan

Falls Probleme auftreten:

1. **Config ändern**:
   ```json
   {
     "scoring": {
       "method": "legacy"
     }
   }
   ```

2. **Oder Code zurücksetzen**:
   ```bash
   git checkout backend/stream_checker_service.py
   ```

## Migration-Strategie

### Option 1: Sofort umstellen (Empfohlen)

```json
{
  "scoring": {
    "method": "enhanced"
  }
}
```

### Option 2: Parallel-Betrieb (Testing)

Beide Scores berechnen und vergleichen:

```python
def _calculate_stream_score(self, stream_data: Dict, channel_id: Optional[int] = None) -> float:
    # Calculate both
    legacy_score = calculate_stream_score_enhanced(stream_data, legacy_weights=weights, use_legacy_scoring=True)
    enhanced_score = calculate_stream_score_enhanced(stream_data, use_legacy_scoring=False)
    
    # Log difference
    if abs(legacy_score - enhanced_score) > 0.1:
        logger.info(f"Score difference: Legacy={legacy_score:.2f}, Enhanced={enhanced_score:.2f}")
    
    # Use enhanced
    return enhanced_score + priority_boost + quality_boost
```

### Option 3: Schrittweise Migration

1. **Woche 1**: Parallel-Betrieb, nur Logging
2. **Woche 2**: Enhanced als Default, Legacy als Fallback
3. **Woche 3**: Nur Enhanced, Legacy-Code entfernen

## Performance-Impact

### Geschwindigkeit

**Legacy**:
```python
# ~10 Operationen (Addition, Multiplikation)
score = bitrate_score * 0.40 + resolution_score * 0.35 + ...
```

**Enhanced**:
```python
# ~15 Operationen (+ 1x exp(), 1x round())
adequacy = 1 / (1 + exp(-3.5 * (ratio - 0.7)))
score = ceiling * adequacy * fps_factor
```

**Unterschied**: < 0.1ms pro Stream (vernachlässigbar)

### Memory

**Zusätzlich**: ~5 KB für Reference-Bitrate-Tabellen (einmalig)

## Vorteile nach Migration

1. **HEVC wird korrekt bewertet**: 1080p HEVC @ 4.5 Mbps = 1080p H.264 @ 8 Mbps
2. **Resolution-Hierarchie**: 720p kann niemals 1080p schlagen
3. **Off-Air-Detection**: 145 kbps Placeholder = Score 0
4. **Wissenschaftlich fundiert**: Basiert auf ITU-T P.1203.3

## Troubleshooting

### Problem: Alle Scores sind 0

**Ursache**: Off-Air-Threshold zu hoch

**Lösung**:
```python
# In quality_scoring.py
NOT_STREAMING_THRESHOLD = 100  # Statt 200
```

### Problem: Scores zu niedrig

**Ursache**: Sigmoid zu streng

**Lösung**:
```python
# In sigmoid_adequacy()
return 1.0 / (1.0 + math.exp(-2.5 * (ratio - 0.6)))  # Weniger streng
```

### Problem: Legacy-Scores waren besser

**Ursache**: Subjektive Präferenz

**Lösung**: Zurück zu Legacy-Scoring
```json
{"scoring": {"method": "legacy"}}
```

## Zusammenfassung

**Aufwand**: ~2-3 Stunden
**Risiko**: Niedrig (Rollback jederzeit möglich)
**Benefit**: Deutlich bessere Stream-Auswahl

**Nächste Schritte**:
1. `quality_scoring.py` testen
2. Integration in `stream_checker_service.py`
3. Rescore bestehende Channels
4. Monitoring für 1-2 Tage
5. Legacy-Code entfernen (optional)
