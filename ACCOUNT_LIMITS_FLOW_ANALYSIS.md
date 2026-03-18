# Account Stream Limits - Flow Analysis

## Zusammenfassung

Account Stream Limits werden **NACH** dem Quality Check angewendet, um die **BESTEN** Streams pro Account zu behalten.

---

## 1. Quality Check (Channel Check)

### Ablauf in `_check_channel_concurrent()`:

```
1. Alle Streams werden geprüft (FFmpeg-Analyse)
   ├─ Quality Check Streams: Normale FFmpeg-Analyse
   ├─ Priority-Only Streams: Nur M3U Priority (keine FFmpeg-Analyse)
   └─ Already-Checked Streams: Cached Stats verwenden

2. Scores werden berechnet
   ├─ _calculate_stream_score() für Quality Check Streams
   └─ _get_m3u_priority_score() für Priority-Only Streams

3. Streams werden nach Score sortiert (höchster zuerst)

4. Provider Diversification (optional)

5. Dead Streams werden entfernt (optional)

6. ❌ KEINE Account Limits hier!
   └─ Alle Streams werden zum Channel hinzugefügt
```

**Ergebnis**: Channel hat ALLE geprüften Streams (sortiert nach Score)

---

## 2. Rescore & Resort

### Ablauf in `rescore_and_resort_all_channels()`:

```
1. Für jeden Channel:
   ├─ Hole alle Streams mit cached Stats
   ├─ Berechne Scores neu (mit aktueller Config)
   └─ Sortiere nach Score (höchster zuerst)

2. Provider Diversification (optional)

3. ✅ Account Limits werden angewendet!
   └─ _apply_account_limits_after_scoring()
       ├─ Behält nur die BESTEN Streams pro Account
       ├─ Entfernt niedrig-bewertete Streams
       └─ Respektiert global_limit und account_specific_limits

4. Channel wird mit gefilterten Streams aktualisiert
```

**Ergebnis**: Channel hat nur die BESTEN Streams pro Account (limitiert)

---

## 3. Discover Streams

### Ablauf in `discover_and_assign_streams()`:

```
1. Regex-Matching: Streams zu Channels zuordnen
   ├─ Parallel oder Sequential
   └─ Berücksichtigt Dead Streams (optional)

2. Streams werden zu Channels hinzugefügt

3. ❌ KEINE Account Limits hier!
   └─ Parameter: ignore_account_limits (default: False)
   └─ Aber: Funktion wendet KEINE Limits an

4. Optional: Quality Check triggern
   └─ skip_check_trigger=False → Trigger Check
```

**Ergebnis**: Channels haben ALLE gematchten Streams (keine Limits)

---

## 4. Wann werden Account Limits angewendet?

### ✅ Angewendet:

1. **Rescore & Resort** (`rescore_and_resort_all_channels`)
   - Manuell vom User getriggert
   - Nach Änderung von M3U Priorities
   - Nach Änderung von Account Limits Config

### ❌ NICHT Angewendet:

1. **Quality Check** (`_check_channel_concurrent`)
   - Alle Streams werden geprüft
   - Alle Streams werden zum Channel hinzugefügt
   - Keine Limits

2. **Discover Streams** (`discover_and_assign_streams`)
   - Alle gematchten Streams werden hinzugefügt
   - Keine Limits

3. **Check Single Channel** (API Endpoint)
   - Ruft `_check_channel_concurrent` auf
   - Keine Limits

---

## 5. Logik von `_apply_account_limits_after_scoring()`

### Funktionsweise:

```python
# Streams sind bereits nach Score sortiert (höchster zuerst)
analyzed_streams = [stream1, stream2, stream3, ...]  # Score: 100, 95, 90, ...

# Für jeden Stream:
for stream in analyzed_streams:
    account_id = stream.m3u_account
    account_limit = get_limit_for_account(account_id)
    
    if account_counts[account_id] < account_limit:
        # Behalten (innerhalb Limit)
        limited_streams.append(stream)
        account_counts[account_id] += 1
    else:
        # Entfernen (Limit überschritten)
        removed_count += 1
```

### Beispiel:

```
Account A: limit=2
Streams: [A1(score:100), A2(score:95), B1(score:90), A3(score:85)]

Nach Limits:
✅ A1 (score:100) - behalten (1/2)
✅ A2 (score:95)  - behalten (2/2)
✅ B1 (score:90)  - behalten (kein Limit)
❌ A3 (score:85)  - entfernt (Limit erreicht)

Ergebnis: [A1, A2, B1]
```

---

## 6. Priority M3U bei Quality Check

### Berücksichtigung:

**Ja, korrekt berücksichtigt!**

```python
# In _calculate_stream_score():
score = base_score + priority_boost + quality_boost

# priority_boost kommt von:
priority_boost = _get_priority_boost(stream_id, stream_data)
    └─ Holt M3U Account Priority
    └─ Berechnet Boost basierend auf Priority (0-100)
```

### Ablauf:

1. **Quality Check**:
   - FFmpeg-Analyse → base_score (Bitrate, Resolution, FPS, Codec)
   - M3U Priority → priority_boost
   - Quality Preferences → quality_boost
   - **Gesamt-Score = base_score + priority_boost + quality_boost**

2. **Priority-Only Streams** (Quality Check Exclusions):
   - Keine FFmpeg-Analyse
   - Nur M3U Priority Score
   - `_get_m3u_priority_score(stream)` → Score basiert NUR auf Priority

3. **Rescore & Resort**:
   - Verwendet cached Stats
   - Berechnet Scores neu mit aktueller Priority Config
   - M3U Priority wird berücksichtigt

---

## 7. Alle Streams werden geprüft?

### ✅ Ja, mit Ausnahmen:

**Geprüft werden**:
- Alle neuen/ungeprüften Streams
- Alle Streams bei Force Check
- Quality Check Streams: FFmpeg-Analyse
- Priority-Only Streams: Nur Priority Score

**NICHT geprüft werden** (2-Hour Immunity):
- Streams die in den letzten 2 Stunden geprüft wurden
- Verwendet cached Stats
- Kann mit Force Check überschrieben werden

**Code**:
```python
# In _check_channel_concurrent():
if force_check:
    streams_to_check = streams  # ALLE Streams
else:
    streams_to_check = [s for s in streams if s['id'] not in checked_stream_ids]
    streams_already_checked = [s for s in streams if s['id'] in checked_stream_ids]
```

---

## 8. Test/Missing/Incomplete Stats

### Verhalten:

**Bei Quality Check**:
```python
# Streams mit fehlenden Stats:
if not stream_stats or stream_stats.get('resolution') in ['0x0', 'N/A', '']:
    status = 'Error'
    # Stream wird trotzdem bewertet (niedriger Score)
```

**Bei Rescore & Resort**:
```python
# Streams mit fehlenden Stats:
stream_stats = stream_data.get('stream_stats', {})
if stream_stats is None:
    stream_stats = {}

# Verwendet Default-Werte:
resolution = stream_stats.get('resolution', '0x0')
fps = stream_stats.get('source_fps', 0)
bitrate = stream_stats.get('ffmpeg_output_bitrate', 0)

# Score wird berechnet (niedrig bei fehlenden Stats)
```

**Ergebnis**: Streams mit fehlenden Stats werden NICHT übersprungen, sondern mit niedrigem Score bewertet.

---

## 9. Discover Streams - Account Limits

### ❌ KEINE Account Limits

**Code**:
```python
def discover_and_assign_streams(
    self, 
    force: bool = False, 
    skip_check_trigger: bool = False, 
    enable_parallel_regex: bool = True, 
    ignore_account_limits: bool = False  # ← Parameter existiert
):
    # ... Regex Matching ...
    
    # Streams werden zu Channels hinzugefügt
    # KEINE Account Limits angewendet!
    
    # Optional: Quality Check triggern
    if not skip_check_trigger:
        # Trigger Check (der auch keine Limits anwendet)
```

**Warum?**
- Discover Streams ist für **Stream-Matching** zuständig
- Account Limits werden später bei **Rescore & Resort** angewendet
- So können alle Streams getestet werden, bevor Limits angewendet werden

---

## 10. Zusammenfassung - Antworten auf deine Fragen

### ❓ "accountstreamlimit also wieviele streams je m3u account dem channel zugeordnet werden soll passiert aber erst nach dem quality check auch bei resort korrekt?"

✅ **JA, KORREKT!**
- Quality Check: KEINE Limits, alle Streams werden geprüft
- Rescore & Resort: Account Limits werden angewendet

### ❓ "bis auf test/missing incomplete stats und resort werden auch immer alle streams geprüft korrekt?"

✅ **JA, mit 2-Hour Immunity!**
- Alle neuen/ungeprüften Streams werden geprüft
- Streams mit fehlenden Stats werden NICHT übersprungen (niedriger Score)
- Bereits geprüfte Streams (< 2h) verwenden cached Stats
- Force Check überschreibt Immunity

### ❓ "discover streams werden auch limitaccountstream erst am ende gemacht richtig?"

❌ **NEIN, GAR NICHT!**
- Discover Streams wendet KEINE Account Limits an
- Alle gematchten Streams werden hinzugefügt
- Account Limits werden nur bei Rescore & Resort angewendet

### ❓ "priority m3u bei qualitycheck bzw bei resort berücksichtigt korrekt?"

✅ **JA, KORREKT!**
- Quality Check: M3U Priority → priority_boost im Score
- Priority-Only Streams: Nur M3U Priority Score (keine FFmpeg)
- Rescore & Resort: M3U Priority wird neu berechnet mit aktueller Config

---

## 11. Empfohlener Workflow

### Für optimale Ergebnisse:

```
1. Discover Streams
   └─ Alle Streams werden zu Channels gematcht
   └─ KEINE Limits

2. Quality Check (automatisch oder manuell)
   └─ Alle Streams werden geprüft
   └─ Scores werden berechnet (inkl. M3U Priority)
   └─ KEINE Limits

3. Rescore & Resort (nach Config-Änderungen)
   └─ Scores werden neu berechnet
   └─ Account Limits werden angewendet
   └─ Nur BESTE Streams pro Account bleiben
```

### Wann Rescore & Resort triggern?

- Nach Änderung von M3U Account Priorities
- Nach Änderung von Account Stream Limits Config
- Nach Änderung von Quality Preferences
- Nach Änderung von Scoring Weights
- Nach Änderung von Provider Diversification Settings

---

## 12. Code-Referenzen

### Account Limits anwenden:
- `backend/stream_checker_service.py:4225` - `_apply_account_limits_after_scoring()`
- `backend/stream_checker_service.py:4007` - `rescore_and_resort_all_channels()`

### Quality Check (KEINE Limits):
- `backend/stream_checker_service.py:1960` - `_check_channel_concurrent()`
- `backend/stream_checker_service.py:3043` - `_analyze_stream_with_profile_failover()`

### Discover Streams (KEINE Limits):
- `backend/automated_stream_manager.py:937` - `discover_and_assign_streams()`

### M3U Priority Scoring:
- `backend/stream_checker_service.py:3304` - `_calculate_stream_score()`
- `backend/stream_checker_service.py:3370` - `_get_priority_boost()`
- `backend/stream_checker_service.py:1885` - `_get_m3u_priority_score()`

---

**Fazit**: Das System ist korrekt implementiert. Account Limits werden nur bei Rescore & Resort angewendet, um die besten Streams zu behalten. Quality Check und Discover Streams wenden keine Limits an.
