# Profile Failover für Quality Check

## Übersicht

Das Profile-Failover-System stellt sicher, dass Streams nicht fälschlicherweise als tot markiert werden, wenn nur ein bestimmtes Profil eines M3U-Accounts Probleme hat. Stattdessen werden automatisch alle verfügbaren Profile durchprobiert.

## Problem

### Vorher (ohne Profile Failover):

```
Stream: ARD HD
M3U Account: IPTV Provider A
  - Profil 1 (Premium): max_streams = 2, aktuell 2/2 (VOLL)
  - Profil 2 (Free1):   max_streams = 1, aktuell 0/1 (FREI)
  - Profil 3 (Free2):   max_streams = 1, aktuell 0/1 (FREI)

Quality Check:
1. find_available_profile_for_stream() → Profil 2 (erstes freies)
2. analyze_stream() mit Profil 2 → FEHLER (z.B. Profil 2 Server down)
3. ❌ Stream wird als TOT markiert
4. Profil 3 wird NICHT versucht (obwohl es funktionieren würde!)
```

**Resultat:** Stream wird fälschlicherweise aus dem Kanal entfernt, obwohl er über Profil 3 funktionieren würde.

## Lösung: Profile Failover

### Nachher (mit Profile Failover):

```
Stream: ARD HD
M3U Account: IPTV Provider A
  - Profil 1 (Premium): max_streams = 2, aktuell 2/2 (VOLL)
  - Profil 2 (Free1):   max_streams = 1, aktuell 0/1 (FREI)
  - Profil 3 (Free2):   max_streams = 1, aktuell 0/1 (FREI)

Quality Check mit Failover:
1. get_all_available_profiles_for_stream() → [Profil 2, Profil 3]
2. Versuch 1: analyze_stream() mit Profil 2 → FEHLER
   ⚠️ "Stream 123: ❌ FAILED with profile Free1 (ID: 2)"
3. Versuch 2: analyze_stream() mit Profil 3 → ERFOLG ✅
   ✅ "Stream 123: ✅ SUCCESS with profile Free2 (ID: 3)"
4. Stream wird mit Profil 3 Daten gespeichert
```

**Resultat:** Stream bleibt im Kanal, da ein funktionierendes Profil gefunden wurde.

## Funktionsweise

### Max Connections / max_streams Handling

**Wichtig:** Profile Failover **wartet NICHT** auf freie Slots!

```python
Profil 1 (Premium): max_streams = 2, aktuell 2/2 → ÜBERSPRUNGEN ❌
Profil 2 (Free1):   max_streams = 1, aktuell 1/1 → ÜBERSPRUNGEN ❌
Profil 3 (Free2):   max_streams = 1, aktuell 0/1 → VERWENDET ✅
Profil 4 (Backup):  max_streams = 0 (unlimited)  → IMMER VERFÜGBAR ✅
```

**Warum kein Warten?**
- Quality Check läuft im Hintergrund
- Kann Stunden dauern bis Slot frei wird
- Würde den gesamten Check blockieren
- Andere Streams müssen auch geprüft werden

**Priorisierung:**
1. **Unlimited Profiles** (max_streams = 0) - Höchste Priorität
2. **Limited Profiles mit freien Slots** - Normale Priorität
3. **Volle Profiles** - Werden übersprungen

**Logging bei vollen Profiles:**
```
DEBUG - Profile 2 is at capacity (1/1 streams), skipping (no waiting during quality check)
```

### Neue UDI Manager Methode

**Datei:** `backend/udi/manager.py`

```python
def get_all_available_profiles_for_stream(self, stream: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Get all available profiles for a stream, ordered by priority.
    
    Returns ALL available profiles for profile failover during quality checking.
    If one profile fails, the next one can be tried.
    """
```

**Unterschied zu `find_available_profile_for_stream()`:**
- **Alt:** Gibt nur das ERSTE verfügbare Profil zurück
- **Neu:** Gibt ALLE verfügbaren Profile zurück (als Liste)

### Neue Stream Checker Methode

**Datei:** `backend/stream_checker_service.py`

```python
def _analyze_stream_with_profile_failover(self, stream: Dict, analysis_params: Dict, udi) -> Dict:
    """Analyze a stream with automatic profile failover.
    
    If a stream fails with one profile, automatically tries other available profiles
    before marking the stream as dead.
    """
```

**Ablauf:**
1. Hole alle verfügbaren Profile für den Stream
2. Versuche jedes Profil nacheinander
3. Bei Erfolg: Speichere Ergebnis mit Profil-Info
4. Bei Fehler: Versuche nächstes Profil
5. Wenn alle fehlschlagen: Markiere Stream als tot

### Integration

**Concurrent Check (`_check_channel_concurrent`):**
```python
# Vorher:
analyzed = analyze_stream(stream_url, ...)

# Nachher:
analyzed = self._analyze_stream_with_profile_failover(
    stream=stream,
    analysis_params=analysis_params,
    udi=udi
)
```

**Sequential Check (`_check_channel_sequential`):**
```python
# Gleiche Änderung wie bei Concurrent Check
```

## Logging

### Erfolgreicher Failover

```
INFO - Stream 123 (ARD HD): Trying 3 available profile(s) with failover
INFO - Stream 123: Trying profile 1/3 - Premium (ID: 1)
WARNING - Stream 123: ❌ FAILED with profile Premium (ID: 1) - Status: Error
INFO - Stream 123: Trying profile 2/3 - Free1 (ID: 2)
WARNING - Stream 123: ❌ FAILED with profile Free1 (ID: 2) - Status: Error
INFO - Stream 123: Trying profile 3/3 - Free2 (ID: 3)
INFO - Stream 123: ✅ SUCCESS with profile Free2 (ID: 3)
```

### Alle Profile fehlgeschlagen

```
INFO - Stream 456 (ZDF HD): Trying 2 available profile(s) with failover
INFO - Stream 456: Trying profile 1/2 - Premium (ID: 1)
WARNING - Stream 456: ❌ FAILED with profile Premium (ID: 1) - Status: Timeout
INFO - Stream 456: Trying profile 2/2 - Free1 (ID: 2)
WARNING - Stream 456: ❌ FAILED with profile Free1 (ID: 2) - Status: Error
ERROR - Stream 456 (ZDF HD): ❌ ALL 2 profile(s) FAILED - marking as dead
```

### Kein Failover nötig (Custom Stream)

```
INFO - Stream 789 (Custom Stream): No profiles available, using standard analysis
```

## Vorteile

### ✅ Höhere Zuverlässigkeit
- Streams werden nicht fälschlicherweise als tot markiert
- Automatisches Failover bei Profil-Problemen
- Bessere Nutzung verfügbarer Ressourcen

### ✅ Transparenz
- Detailliertes Logging aller Failover-Versuche
- Profil-Info wird im Ergebnis gespeichert
- Nachvollziehbar welches Profil verwendet wurde

### ✅ Kompatibilität
- Funktioniert mit allen bestehenden Features
- Keine Breaking Changes
- Custom Streams (ohne Profile) funktionieren weiterhin

### ✅ Performance
- Nur minimaler Overhead bei Erfolg im ersten Versuch
- Failover nur bei tatsächlichen Fehlern
- Parallele Checks bleiben parallel

## Zusätzliche Metadaten

Das Analyse-Ergebnis enthält jetzt zusätzliche Informationen:

```python
{
    'stream_id': 123,
    'stream_name': 'ARD HD',
    'resolution': '1920x1080',
    'fps': 50,
    'bitrate_kbps': 5000,
    'score': 0.95,
    'status': 'OK',
    
    # Neue Felder:
    'used_profile_id': 3,                    # Welches Profil erfolgreich war
    'used_profile_name': 'Free2',            # Name des Profils
    'profile_failover_attempts': 3,          # Wie viele Versuche nötig waren
    'all_profiles_failed': False             # Nur bei Fehler: True
}
```

## Anwendungsfälle

### Szenario 1: Profil-Server temporär down

```
Situation: Premium-Profil Server hat Wartung
Ohne Failover: Alle Streams als tot markiert
Mit Failover: Automatischer Wechsel zu Free-Profilen ✅
```

### Szenario 2: Profil-Limit erreicht

```
Situation: Premium-Profil (2 Streams) ist voll
Ohne Failover: Neue Streams können nicht geprüft werden
Mit Failover: Automatische Nutzung von Free-Profilen ✅
```

### Szenario 3: Profil-spezifische Probleme

```
Situation: Ein Profil hat URL-Transformations-Fehler
Ohne Failover: Stream wird als tot markiert
Mit Failover: Anderes Profil mit korrekter URL wird verwendet ✅
```

## Zusammenspiel mit anderen Features

### Provider-Diversifikation

Profile Failover und Provider-Diversifikation arbeiten auf verschiedenen Ebenen:

```
Ebene 1: Profile Failover (innerhalb eines M3U-Accounts)
  Provider A, Profil 1 → Fehler
  Provider A, Profil 2 → Erfolg ✅

Ebene 2: Provider-Diversifikation (zwischen M3U-Accounts)
  Provider A (Profil 2) - Score 0.95
  Provider B (Profil 1) - Score 0.92
  Provider C (Profil 1) - Score 0.89
  → Abwechselnde Sortierung
```

### Dead Stream Removal

Profile Failover verhindert falsche Dead-Stream-Markierungen:

```
Ohne Failover:
  Profil 1 fehlschlägt → Stream als tot markiert → Entfernt

Mit Failover:
  Profil 1 fehlschlägt → Profil 2 versucht → Erfolg → Stream bleibt
```

### Account Stream Limits

Profile Failover respektiert Account-Limits:

```
Account A:
  - Profil 1: max_streams = 2, aktuell 2/2 (VOLL) → Übersprungen
  - Profil 2: max_streams = 1, aktuell 0/1 (FREI) → Verwendet ✅
```

## Konfiguration

**Keine zusätzliche Konfiguration erforderlich!**

Das Feature ist automatisch aktiv und funktioniert out-of-the-box.

## Performance-Impact

### Bester Fall (Profil 1 funktioniert):
- **Overhead:** ~0ms (keine Änderung)
- **Versuche:** 1

### Durchschnitt (Profil 2 funktioniert):
- **Overhead:** ~30-60 Sekunden (1 fehlgeschlagener Versuch)
- **Versuche:** 2

### Schlechtester Fall (alle Profile fehlschlagen):
- **Overhead:** ~60-120 Sekunden (mehrere fehlgeschlagene Versuche)
- **Versuche:** Anzahl verfügbarer Profile
- **Resultat:** Stream wird korrekt als tot markiert

**Hinweis:** Der Overhead tritt nur bei tatsächlichen Fehlern auf. Bei funktionierenden Streams gibt es keine Verzögerung.

## Vergleich mit Dispatcharr

### Dispatcharr (Playback):
- Profile Failover während des Playbacks
- Wechselt Profile bei Stream-Fehlern
- Trackt `(stream_id, profile_id)` Kombinationen
- Verhindert Playback-Unterbrechungen

### StreamFlow (Quality Check):
- Profile Failover während des Quality Checks
- Probiert alle Profile vor Dead-Markierung
- Speichert erfolgreiches Profil im Ergebnis
- Verhindert falsche Dead-Stream-Markierungen

**Beide Systeme ergänzen sich perfekt!**

## Technische Details

### Code-Locations

**Backend: `backend/udi/manager.py`**
- Zeile ~1222: `find_available_profile_for_stream()` (bestehend)
- Zeile ~1290: `get_all_available_profiles_for_stream()` (NEU)

**Backend: `backend/stream_checker_service.py`**
- Zeile ~2330: Integration in `_check_channel_concurrent()`
- Zeile ~2460: Integration in `_check_channel_sequential()`
- Zeile ~2690: `_analyze_stream_with_profile_failover()` (NEU)

### Zeitkomplexität

- **get_all_available_profiles_for_stream():** O(n) - n = Anzahl Profile
- **_analyze_stream_with_profile_failover():** O(n * t) - n = Anzahl Profile, t = Analyse-Zeit pro Profil
- **Worst Case:** Alle Profile werden versucht
- **Best Case:** Erstes Profil funktioniert (wie vorher)

## FAQ

### Q: Wird bei vollen Profilen gewartet?
**A:** Nein! Quality Check wartet nicht auf freie Slots. Volle Profile werden übersprungen. Das ist wichtig, weil:
- Quality Check im Hintergrund läuft
- Warten würde den gesamten Check blockieren
- Andere Streams müssen auch geprüft werden
- Es kann Stunden dauern bis ein Slot frei wird

**Empfehlung:** Nutze mindestens ein Profil mit `max_streams = 0` (unlimited) als Backup!

### Q: Was passiert wenn alle Profile voll sind?
**A:** Der Stream wird mit der Standard-URL (ohne Profil-Transformation) geprüft. Wenn das auch fehlschlägt, wird er als tot markiert.

### Q: Wird das bei jedem Stream angewendet?
**A:** Ja, aber nur wenn der Stream ein M3U-Account mit mehreren Profilen hat. Custom Streams nutzen die Standard-Analyse.

### Q: Verlängert das den Quality Check?
**A:** Nur bei Fehlern. Wenn das erste Profil funktioniert, gibt es keine Verzögerung.

### Q: Was passiert wenn alle Profile fehlschlagen?
**A:** Der Stream wird korrekt als tot markiert, genau wie vorher.

### Q: Funktioniert das mit Concurrent Checking?
**A:** Ja! Jeder Stream wird parallel geprüft, mit Failover innerhalb jedes Threads.

### Q: Kann ich das deaktivieren?
**A:** Aktuell nicht, aber das Feature hat keine Nachteile. Es verbessert nur die Zuverlässigkeit.

### Q: Wird das gespeichert welches Profil verwendet wurde?
**A:** Ja, im Analyse-Ergebnis werden `used_profile_id` und `used_profile_name` gespeichert.

## Version

- **Feature:** Profile Failover für Quality Check
- **Version:** 1.0
- **Datum:** 2026-01-14
- **Kompatibilität:** StreamFlow v1.0+

---

**Dieses Feature macht StreamFlow noch zuverlässiger! 🎉**
