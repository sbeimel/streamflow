# Was bringt besseres Quality-Scoring?

## TL;DR

**NICHT schneller oder weniger Ressourcen**, sondern **intelligentere Stream-Auswahl**:
- Wählt automatisch den besten Stream (nicht nur den ersten funktionierenden)
- Vermeidet schlechte Streams (Off-Air, Low-Bitrate)
- Berücksichtigt Zuverlässigkeit (nicht nur Qualität)

---

## Problem mit aktuellem StreamFlow-Ansatz

### Aktuell: "Erster funktionierender Stream gewinnt"

```python
# StreamFlow jetzt
for profile in profiles:
    result = check_stream(url, profile)
    if result['status'] == 'OK':
        return result  # ✓ Funktioniert, aber ist es der BESTE?
```

**Problem-Szenarien**:

1. **Szenario 1: Schlechte Qualität wird gewählt**
   ```
   Profile A: 720p @ 2 Mbps (funktioniert) ← GEWÄHLT
   Profile B: 1080p @ 8 Mbps (nicht getestet)
   Profile C: 4K @ 16 Mbps (nicht getestet)
   ```
   → User bekommt 720p, obwohl 1080p verfügbar wäre

2. **Szenario 2: Unzuverlässiger Stream wird gewählt**
   ```
   Profile A: 1080p @ 8 Mbps, aber 50% Erfolgsrate ← GEWÄHLT
   Profile B: 720p @ 4 Mbps, aber 100% Erfolgsrate (nicht getestet)
   ```
   → User bekommt ständig Buffering

3. **Szenario 3: Off-Air-Stream wird gewählt**
   ```
   Profile A: 145 kbps Placeholder (Farbbars) ← GEWÄHLT
   Profile B: 1080p @ 8 Mbps (nicht getestet)
   ```
   → User sieht nur Farbbars

---

## Lösung: Quality-Scoring + QoE

### Mit MACstrom-Ansatz: "Bester Stream gewinnt"

```python
# Mit Quality-Scoring
streams = []
for profile in profiles:
    result = check_stream(url, profile)
    if result['status'] == 'OK':
        # Berechne Quality-Score
        quality = quality_score(result['bitrate'], result['codec'], result['resolution'])
        
        # Berechne QoE (Quality + Reliability)
        qoe = quality * reliability * (1.0 - stall_rate * 0.5)
        
        streams.append({'profile': profile, 'qoe': qoe, 'result': result})

# Sortiere nach QoE (bester zuerst)
streams.sort(key=lambda x: x['qoe'], reverse=True)
return streams[0]  # ✓ BESTER Stream
```

**Vorteile**:

1. **Szenario 1 gelöst: Beste Qualität wird gewählt**
   ```
   Profile A: 720p @ 2 Mbps → QoE: 52
   Profile B: 1080p @ 8 Mbps → QoE: 75 ← GEWÄHLT
   Profile C: 4K @ 16 Mbps → QoE: 81 ← NOCH BESSER
   ```

2. **Szenario 2 gelöst: Zuverlässigkeit zählt**
   ```
   Profile A: 1080p @ 8 Mbps, 50% Success → QoE: 38
   Profile B: 720p @ 4 Mbps, 100% Success → QoE: 52 ← GEWÄHLT
   ```

3. **Szenario 3 gelöst: Off-Air wird erkannt**
   ```
   Profile A: 145 kbps → QoE: 0 (Off-Air)
   Profile B: 1080p @ 8 Mbps → QoE: 75 ← GEWÄHLT
   ```

---

## Konkrete Vorteile für StreamFlow

### 1. Automatische Best-Stream-Selection

**Aktuell**: Dispatcharr bekommt den ersten funktionierenden Stream
**Mit Scoring**: Dispatcharr bekommt den BESTEN Stream

**Beispiel**:
```
Kanal: "ARD HD"
- Stream 1 (Provider A): 720p @ 3 Mbps → Score: 52
- Stream 2 (Provider B): 1080p @ 8 Mbps → Score: 75 ← Automatisch gewählt
- Stream 3 (Provider C): 1080p @ 5 Mbps → Score: 55
```

### 2. Vermeidung von Placeholder-Streams

**Problem**: Viele IPTV-Provider senden 145 kbps Placeholder (Farbbars) wenn Kanal off-air ist

**Aktuell**: StreamFlow erkennt das nicht → Dispatcharr bekommt Farbbars
**Mit Scoring**: Automatisch erkannt und übersprungen

```python
if bitrate < 200:  # kbps
    stream.not_streaming = True
    stream.quality_score = 0
    # Nächster Stream wird versucht
```

### 3. Codec-Awareness

**Problem**: HEVC braucht weniger Bitrate als H.264 für gleiche Qualität

**Aktuell**: 
```
Stream A: 1080p H.264 @ 8 Mbps → "Gut"
Stream B: 1080p HEVC @ 4.5 Mbps → "Schlecht" (niedrigere Bitrate)
```

**Mit Scoring**:
```
Stream A: 1080p H.264 @ 8 Mbps → Score: 75
Stream B: 1080p HEVC @ 4.5 Mbps → Score: 75 (gleich gut!)
```

### 4. Zuverlässigkeit berücksichtigen

**Problem**: Hohe Qualität nützt nichts wenn Stream ständig abbricht

**Aktuell**: Nur Qualität zählt
**Mit QoE**: Qualität × Zuverlässigkeit

```python
# Stream A: Hohe Qualität, aber unzuverlässig
quality_a = 75
reliability_a = 0.5  # 50% Erfolgsrate
qoe_a = 75 * 0.5 = 38

# Stream B: Mittlere Qualität, aber zuverlässig
quality_b = 52
reliability_b = 1.0  # 100% Erfolgsrate
qoe_b = 52 * 1.0 = 52  # ← Besser!
```

---

## Performance-Impact

### Geschwindigkeit: GLEICH oder BESSER

**Warum gleich?**
- FFmpeg-Check dauert gleich lang (8-30s)
- Scoring ist nur Mathematik (< 1ms)
- Keine Extra-Checks nötig

**Warum besser?**
- Dead-Streams (< 200 kbps) werden nach 0.1-0.2s erkannt (statt 8s)
- Weniger Retries wegen besserer Stream-Auswahl

### Ressourcen: GLEICH

- Kein Extra-Memory (nur ein paar Zahlen mehr)
- Kein Extra-CPU (Scoring ist trivial)
- Kein Extra-Network (gleiche FFmpeg-Checks)

### User-Experience: DEUTLICH BESSER

- Bessere Stream-Qualität
- Weniger Buffering
- Keine Placeholder-Streams
- Automatische Best-Stream-Selection

---

## Beispiel: Realer Use-Case

### Kanal: "Sport HD"

**Ohne Quality-Scoring** (aktuell):
```
1. Check Provider A → 720p @ 3 Mbps → OK → GEWÄHLT
   (Provider B mit 1080p @ 8 Mbps wird nie getestet)
```

**Mit Quality-Scoring**:
```
1. Check Provider A → 720p @ 3 Mbps → Score: 52
2. Check Provider B → 1080p @ 8 Mbps → Score: 75
3. Check Provider C → Off-Air (145 kbps) → Score: 0
4. Sortiere nach Score → Provider B GEWÄHLT
```

**Ergebnis**:
- User bekommt 1080p statt 720p
- Kein Extra-Aufwand (alle Checks laufen eh)
- Nur intelligentere Auswahl

---

## Was ändert sich NICHT?

### Gleich bleibt:

1. **FFmpeg-Check-Dauer**: Immer noch 8-30s pro Stream
2. **Anzahl der Checks**: Gleich viele Streams werden getestet
3. **Ressourcen-Verbrauch**: Praktisch identisch
4. **API-Calls**: Keine Extra-Calls

### Was ändert sich:

1. **Entscheidungs-Logik**: Intelligenter
2. **Stream-Auswahl**: Besser
3. **User-Experience**: Deutlich besser
4. **Placeholder-Erkennung**: Automatisch

---

## Zusammenfassung

### Was bringt es?

✅ **Bessere Stream-Auswahl** (bester statt erster)
✅ **Placeholder-Erkennung** (< 200 kbps = Off-Air)
✅ **Codec-Awareness** (HEVC vs H.264)
✅ **Zuverlässigkeit** (nicht nur Qualität)
✅ **Automatische Optimierung** (kein manuelles Tuning)

### Was bringt es NICHT?

❌ Schneller (gleiche Check-Dauer)
❌ Weniger Ressourcen (praktisch gleich)
❌ Weniger Checks (gleiche Anzahl)

### Fazit

**Quality-Scoring ist kein Performance-Feature, sondern ein Intelligence-Feature.**

Es macht StreamFlow nicht schneller, sondern **schlauer** - wählt automatisch den besten Stream statt nur den ersten funktionierenden.

**Analogie**: 
- Ohne Scoring = "Nimm das erste Auto das fährt"
- Mit Scoring = "Nimm das beste Auto (schnellstes, zuverlässigstes, sparsamtes)"

Beide brauchen gleich lang zum Testen, aber das Ergebnis ist besser.
