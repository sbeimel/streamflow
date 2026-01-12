# Fallback-Scoring für Streams ohne Bitrate-Information

## Problem

Manche Streams funktionieren einwandfrei, aber FFmpeg kann nicht alle Metadaten extrahieren (insbesondere die Bitrate). Dies kann verschiedene Gründe haben:

- **Korrupte Pakete**: Stream enthält beschädigte Daten, die FFmpeg verwirren
- **Unbekannte Codecs**: Zusätzliche Streams mit unbekannten Formaten
- **Verschlüsselung**: Spezielle Header oder Verschlüsselung
- **Adaptive Bitrate**: Variable Bitrate-Streams
- **Timing-Probleme**: Stream braucht länger zum Starten

## Beispiel eines funktionierenden Streams ohne Bitrate

```
Video stream info - Codec: h264, Resolution: 1280x720, Source FPS: 50.0, Video Bitrate: None kb/s
Stream #0:0: Video: h264 (High), yuv420p(tv, bt709, progressive), 1280x720 [SAR 1:1 DAR 16:9], 50 fps
Stream #0:1(deu): Audio: mp2, 48000 Hz, stereo, fltp, 256 kb/s
```

**Problem**: Ohne Bitrate-Information bekommen diese Streams Score 0 und werden als "schlecht" eingestuft, obwohl sie perfekt funktionieren.

## Lösung: Fallback-Scoring

### Logik

```python
def _calculate_stream_score(self, stream_data: Dict, channel_id: Optional[int] = None) -> float:
    # 1. Tote Streams zuerst abfangen
    if self._is_stream_dead(stream_data):
        return 0.0
    
    # 2. Fallback für Streams ohne Bitrate aber mit Auflösung/FPS
    if (stream_data.get('bitrate_kbps', 0) == 0 and 
        stream_data.get('resolution') not in ['0x0', 'N/A', ''] and
        stream_data.get('fps', 0) > 0):
        
        return 40.0  # Mittlerer Score
    
    # 3. Normale Berechnung für vollständige Streams
    return self._calculate_normal_score(stream_data, channel_id)
```

### Unterscheidung zwischen toten und funktionierenden Streams

| Stream-Typ | Auflösung | FPS | Bitrate | Score | Behandlung |
|------------|-----------|-----|---------|-------|------------|
| **Tot** | `0x0` oder `N/A` | `0` | `0` | `0` | Entfernt |
| **Funktioniert ohne Bitrate** | `1280x720` | `50` | `0` | `40` | Behalten |
| **Vollständig** | `1280x720` | `50` | `5000` | `60-100` | Bevorzugt |

### Score-Hierarchie

- **0**: Tote Streams (werden entfernt)
- **40**: Funktionierende Streams ohne Bitrate-Info (mittlere Priorität)
- **60-100**: Vollständige Streams mit allen Metadaten (höchste Priorität)

## Vorteile

✅ **Funktionsfähige Streams bleiben erhalten**  
✅ **Einfache und robuste Logik**  
✅ **Keine falschen Bitrate-Schätzungen**  
✅ **Klare Score-Hierarchie**  
✅ **Tote Streams werden weiterhin korrekt erkannt**  

## Logging

Das System loggt Fallback-Scoring für bessere Nachverfolgung:

```
DEBUG - Stream without bitrate info but functional: 1280x720@50fps - assigning fallback score: 40
```

## Konfiguration

Das Fallback-Scoring ist automatisch aktiv und benötigt keine zusätzliche Konfiguration. Es greift nur, wenn:

1. Stream ist nicht tot (`_is_stream_dead()` = False)
2. Bitrate ist 0 oder fehlt
3. Auflösung ist vorhanden und gültig
4. FPS ist größer als 0

## Implementierung

- **Datei**: `backend/stream_checker_service.py`
- **Funktion**: `_calculate_stream_score()`
- **Version**: StreamFlow Enhancement v1.0
- **Kompatibilität**: Vollständig rückwärtskompatibel