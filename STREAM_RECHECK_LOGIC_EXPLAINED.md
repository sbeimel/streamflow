# Stream Recheck Logik - Detaillierte Erklärung

## Kurze Antwort

**JA, Streams mit Stats werden bei jeder Automation erneut geprüft!**

**ABER:** Es gibt eine **2-Stunden-Immunität** die das verhindert.

---

## Wie funktioniert die 2-Stunden-Immunität?

### Update Tracker System

```python
# In stream_checker_service.py:

# 1. Beim ersten Check:
checked_stream_ids = []  # Leer

# 2. Alle Streams werden geprüft:
streams_to_check = [s for s in streams if s['id'] not in checked_stream_ids]
# → Alle Streams werden geprüft

# 3. Nach dem Check werden IDs gespeichert:
self.update_tracker.mark_channel_checked(
    channel_id,
    stream_count=len(streams),
    checked_stream_ids=[s['id'] for s in streams]
)

# 4. Beim nächsten Check (innerhalb 2h):
checked_stream_ids = [123, 456, 789, ...]  # Gefüllt!

streams_to_check = [s for s in streams if s['id'] not in checked_stream_ids]
# → Nur NEUE Streams werden geprüft!

streams_already_checked = [s for s in streams if s['id'] in checked_stream_ids]
# → Alte Streams werden ÜBERSPRUNGEN!
```

---

## Visualisierung

### Szenario: Channel mit 10 Streams

```
Tag 1, 00:00 Uhr - Automation läuft:
├─ Check 1: Alle 10 Streams werden geprüft
├─ Dauer: 5 Minuten
└─ Update Tracker: Speichert IDs [1,2,3,4,5,6,7,8,9,10]

Tag 1, 01:00 Uhr - Automation läuft:
├─ Check 2: 0 Streams werden geprüft (alle innerhalb 2h)
├─ Dauer: 0 Sekunden
└─ Log: "All 10 streams have been recently checked, using cached scores"

Tag 1, 02:00 Uhr - Automation läuft:
├─ Check 3: 0 Streams werden geprüft (noch innerhalb 2h)
├─ Dauer: 0 Sekunden
└─ Log: "Channel unchanged since last check - skipping reorder"

Tag 1, 02:01 Uhr - 2 Stunden sind vorbei!
├─ Update Tracker: Löscht IDs (Immunität abgelaufen)

Tag 1, 03:00 Uhr - Automation läuft:
├─ Check 4: Alle 10 Streams werden wieder geprüft
├─ Dauer: 5 Minuten
└─ Update Tracker: Speichert IDs wieder
```

---

## Code-Analyse

### 1. Check ob Streams übersprungen werden können

```python
# stream_checker_service.py Zeile ~1960

# Hole bereits geprüfte Stream-IDs
checked_stream_ids = self.update_tracker.get_checked_stream_ids(channel_id)

# Identifiziere welche Streams geprüft werden müssen
streams_to_check = [s for s in streams if s['id'] not in checked_stream_ids]
streams_already_checked = [s for s in streams if s['id'] in checked_stream_ids]

if streams_to_check:
    logger.info(f"Found {len(streams_to_check)} new/unchecked streams")
else:
    logger.info(f"All {len(streams)} streams have been recently checked, using cached scores")
```

### 2. Optimierung: Skip komplett wenn nichts geändert

```python
# stream_checker_service.py Zeile ~1975

# Wenn ALLE Bedingungen erfüllt:
# 1. Keine neuen Streams
# 2. Stream-Anzahl gleich
# 3. Stream-IDs identisch
if (current_stream_count == previous_stream_count and 
    set(current_stream_ids) == set(checked_stream_ids)):
    
    logger.info(f"Channel {channel_name} unchanged since last check - skipping reorder")
    # SKIP! Keine Prüfung, keine Sortierung
    return
```

---

## Wann werden Streams DOCH geprüft?

### 1. **Nach 2 Stunden**
```python
# Update Tracker löscht IDs nach 2h
# → Alle Streams werden wieder geprüft
```

### 2. **Neue Streams hinzugefügt**
```python
# Discover Streams findet neue Streams
# → Nur NEUE Streams werden geprüft
# → Alte Streams bleiben ungeprüft (innerhalb 2h)
```

### 3. **Force Check**
```python
# Manueller "Force Check" Button
# → Alle Streams werden geprüft (ignoriert 2h-Immunität)

if force_check:
    streams_to_check = streams  # ALLE!
    logger.info("Force check enabled: analyzing all streams (bypassing 2-hour immunity)")
```

### 4. **Channel-Zusammensetzung ändert sich**
```python
# Streams wurden hinzugefügt/entfernt
# → Reordering wird durchgeführt
# → ABER: Nur neue Streams werden geprüft!

if current_stream_count != previous_stream_count:
    logger.info("Channel composition changed - will reorder")
    # Reorder mit cached Stats für alte Streams
```

---

## Beispiel aus deinen Logs

### Was ist passiert?

```
2026-03-02 11:44:42 - INFO - Completed smart parallel analysis of 45 streams
```

**Frage:** Wurden alle 45 Streams geprüft?

**Antwort:** Wahrscheinlich JA, weil:
1. Erster Check nach Automation-Start
2. Oder 2h-Immunität war abgelaufen
3. Oder Force Check wurde ausgelöst

---

## Zeitersparnis durch 2h-Immunität

### Ohne Immunität (jede Stunde prüfen)
```
00:00 - Prüfe 100 Streams (50 Min)
01:00 - Prüfe 100 Streams (50 Min)
02:00 - Prüfe 100 Streams (50 Min)
03:00 - Prüfe 100 Streams (50 Min)
...
24h: 24 × 50 Min = 20 Stunden!
```

### Mit 2h-Immunität
```
00:00 - Prüfe 100 Streams (50 Min)
01:00 - Skip (innerhalb 2h)
02:00 - Skip (innerhalb 2h)
03:00 - Prüfe 100 Streams (50 Min)
04:00 - Skip (innerhalb 2h)
05:00 - Skip (innerhalb 2h)
06:00 - Prüfe 100 Streams (50 Min)
...
24h: 12 × 50 Min = 10 Stunden (50% gespart!)
```

---

## Konfiguration

### Wo wird die 2h-Immunität definiert?

```python
# In stream_checker_service.py:

class UpdateTracker:
    def __init__(self):
        self.immunity_duration = 7200  # 2 Stunden in Sekunden
    
    def is_immune(self, channel_id: int) -> bool:
        """Prüft ob Channel noch immun ist"""
        if channel_id not in self.last_check_times:
            return False
        
        elapsed = time.time() - self.last_check_times[channel_id]
        return elapsed < self.immunity_duration
```

### Kann man das ändern?

**Ja!** Du könntest die Immunität anpassen:

```python
# Kürzere Immunität (1 Stunde):
self.immunity_duration = 3600

# Längere Immunität (4 Stunden):
self.immunity_duration = 14400

# Keine Immunität (immer prüfen):
self.immunity_duration = 0
```

---

## Test Streams Without Stats

### Was macht dieser Button?

```python
# web_api.py Zeile 3235

def test_streams_without_stats():
    """Test all streams that have no quality stats (never been checked)."""
    
    # Findet Streams wo stream_stats = null
    for stream in streams:
        stream_data = udi.get_stream_by_id(stream_id)
        
        # Prüfe ob Stats vorhanden
        stream_stats = stream_data.get('stream_stats')
        if not stream_stats or stream_stats == {}:
            # Stream hat KEINE Stats → Prüfen!
            streams_to_test.append(stream)
```

**Zweck:**
- Prüft nur Streams die noch NIE geprüft wurden
- Ignoriert 2h-Immunität
- Nützlich nach "Discover Streams"

---

## Zusammenfassung

| Situation | Werden Streams geprüft? | Grund |
|-----------|------------------------|-------|
| **Erster Check** | ✅ Ja, alle | Keine IDs im Tracker |
| **Innerhalb 2h** | ❌ Nein | 2h-Immunität aktiv |
| **Nach 2h** | ✅ Ja, alle | Immunität abgelaufen |
| **Neue Streams** | ✅ Ja, nur neue | Neue IDs nicht im Tracker |
| **Force Check** | ✅ Ja, alle | Ignoriert Immunität |
| **Test Without Stats** | ✅ Ja, nur ohne Stats | Spezielle Funktion |

---

## Empfehlung

**Die 2h-Immunität ist PERFEKT so!**

**Warum?**
- Spart 50% Zeit bei stündlicher Automation
- Streams ändern sich nicht so schnell
- Force Check für Notfälle verfügbar
- Neue Streams werden sofort geprüft

**Ändern nur wenn:**
- Du sehr dynamische Streams hast (ändern sich oft)
- Du seltener als alle 2h Automation laufen lässt
- Du mehr Kontrolle brauchst

---

**Erstellt:** 2026-03-02
**Autor:** Kiro AI Assistant
