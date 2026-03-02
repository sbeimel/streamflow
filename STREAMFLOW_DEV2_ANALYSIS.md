# StreamFlow-dev2 Vollständige Analyse

## Übersicht

streamflow-dev2 ist eine NEUE VERSION von StreamFlow mit komplett anderen Features. Es ist KEIN Backup, sondern eine Weiterentwicklung mit Event-basiertem Stream Monitoring.

---

## NEUE Backend-Dateien (11 Dateien)

### 1. **automation_config_manager.py** - Profile-basiertes Config Management
**Funktionen:**
- Ersetzt alte Config-Struktur durch Profile-System
- Profile enthalten: m3u_update, stream_matching, stream_checking, scoring_weights
- Channel/Group Assignments zu Profiles
- **NEU:** Automation Periods (Event-Scheduling mit Cron + Interval Support)
- **NEU:** Channel-Period Assignments (Channel → Period → Profile Mapping)
- Migration von Legacy-Config automatisch
- 5-Minuten Cache für Events

**Wichtige Klassen:**
- `AutomationConfigManager` - Singleton für Config-Verwaltung
- Methoden: `create_profile()`, `assign_profile_to_channel()`, `create_period()`, `assign_period_to_channels()`

**Unterschied zu Root:**
- Root hat nur einfache automation_config.json
- dev2 hat komplexes Profile-System mit Periods

---

### 2. **automation_events_scheduler.py** - Event-Scheduling mit Cache
**Funktionen:**
- Berechnet upcoming automation events (24h voraus)
- Unterstützt Interval + Cron Schedules
- 5-Minuten Cache (CACHE_VALIDITY_SECONDS = 300)
- Persistiert Cache auf Disk
- Invalidierung bei Config-Änderungen

**Wichtige Klassen:**
- `AutomationEventsScheduler` - Singleton
- `calculate_upcoming_events()` - Berechnet Events
- `get_cached_events()` - Cached Abruf

**Unterschied zu Root:**
- Root hat kein Event-Scheduling
- dev2 kann Events im Voraus planen

---

### 3. **config_migrator.py** - Automatische Config-Migration
**Funktionen:**
- Erkennt Legacy-Format automatisch
- Migriert zu neuem Profile-System
- Erstellt Backups vor Migration
- Verschiebt deprecated Files nach `legacy_files/`
- Idempotent und sicher

**Migration-Schritte:**
1. Backup erstellen
2. Legacy Configs laden
3. Zu neuem Format konvertieren
4. Neue Config schreiben
5. Alte Files verschieben

**Unterschied zu Root:**
- Root hat keine Migration-Logik
- dev2 kann alte Configs automatisch upgraden

---

### 4. **rollback_config.py** - Config Rollback Tool
**Funktionen:**
- Listet verfügbare Backups
- Interaktiver Rollback-Prozess
- Safety-Backup vor Rollback
- CLI-Tool für manuelle Nutzung

**Unterschied zu Root:**
- Root hat kein Rollback-System
- dev2 kann Migrations-Fehler rückgängig machen

---

### 5. **ffmpeg_stream_monitor.py** - Real-time FFmpeg Monitoring
**Funktionen:**
- Lightweight Stream Monitoring mit FFmpeg null muxer
- Parst FFmpeg Stats: speed, bitrate, fps, resolution
- **NEU:** Multi-Output Routing (2x UDP + null für Stats)
- Port-basiertes Routing für Primary-Sidecar System
- Callback-System für Stats-Updates
- Erkennt Fatal Errors und stoppt automatisch

**Wichtige Klassen:**
- `FFmpegStreamMonitor` - Monitor für einzelnen Stream
- `FFmpegStats` - Dataclass für Stats
- `_parse_stats()` - Parst FFmpeg Output
- `is_buffering()` - Erkennt Buffering

**Unterschied zu Root:**
- Root hat nur stream_check_utils.py (einmalige Checks)
- dev2 hat kontinuierliches Monitoring

---

### 6. **stream_monitoring_service.py** - Orchestrierung des Monitorings
**Funktionen:**
- Orchestriert FFmpeg Monitors für alle Sessions
- **NEU:** Capped Sliding Window Reliability Scoring
- **NEU:** Quarantine/Review/Stable Lifecycle
- **NEU:** Sidecar Loop Detection
- Auto-Quarantine bei slow speed/timeout/death
- Screenshot Capture Integration
- Sync Enforcement (exclusive channel ownership)
- Stream Reordering in Dispatcharr

**Wichtige Klassen:**
- `StreamMonitoringService` - Singleton
- Worker Threads: `_monitor_worker()`, `_refresh_worker()`, `_screenshot_worker()`
- `_evaluate_session_streams()` - Bewertet und sortiert Streams
- `_manage_quarantine_lifecycle()` - Lifecycle Management

**Thresholds:**
- `SLOW_SPEED_THRESHOLD = 0.3` - Speed unter 0.3x = zu langsam
- `SLOW_SPEED_DURATION = 60.0` - 60s langsam = Quarantine
- `SCORE_SWITCH_THRESHOLD = 10.0` - 10 Punkte Diff für Switch
- `PASS_SCORE_THRESHOLD = 70.0` - 70 Punkte für Review → Stable

**Unterschied zu Root:**
- Root hat nur stream_checker_service.py (einmalige Checks)
- dev2 hat kontinuierliches Monitoring mit Scoring

---

### 7. **stream_screenshot_service.py** - Screenshot/Thumbnail Service
**Funktionen:**
- Captured Screenshots von Streams
- FFmpeg single-frame capture
- Extrahiert Stats aus FFmpeg Output (resolution, fps, bitrate, HDR)
- **NEU:** HDR Detection (HDR10, HLG, Dolby Vision)
- Cleanup alter Screenshots

**Wichtige Klassen:**
- `StreamScreenshotService` - Singleton
- `capture()` - Captured Screenshot + Stats
- `cleanup_old_screenshots()` - Cleanup

**Unterschied zu Root:**
- Root hat keine Screenshot-Funktion
- dev2 kann Thumbnails für UI generieren

---

### 8. **stream_session_manager.py** - Event-basiertes Session Management
**Funktionen:**
- **NEU:** Event-basierte Monitoring Sessions
- **NEU:** EPG Event Attachment (Auto-Stop bei Event-Ende)
- **NEU:** Capped Sliding Window Scoring Algorithm
- **NEU:** Quarantine/Review/Stable Lifecycle
- **NEU:** Exclusive Channel Ownership
- **NEU:** TVG-ID Matching (zusätzlich zu Regex)
- Stream Discovery mit Regex + TVG-ID
- Metrics History Persistence

**Wichtige Klassen:**
- `StreamSessionManager` - Singleton
- `SessionInfo` - Dataclass für Session
- `StreamInfo` - Dataclass für Stream (mit status: review/stable/quarantined)
- `CappedSlidingWindow` - Scoring Algorithm
- `create_session()`, `start_session()`, `stop_session()`

**Lifecycle:**
1. **Review** (60s default) - Neue Streams werden getestet
2. **Stable** - Streams mit Score ≥70 nach Review
3. **Quarantined** (15min) - Tote/langsame Streams

**Unterschied zu Root:**
- Root hat kein Session-System
- dev2 ist Event-driven (z.B. für Live-Events)

---

### 9. **sidecar_loop_detector.py** - Loop Detection
**Funktionen:**
- **NEU:** Erkennt Content-Loops in Streams
- Verwendet pHash (perceptual hashing) für Frame-Vergleich
- Sequence Matching (3 Frames)
- Hamming Distance Tolerance
- Static Image / Black Screen Filter

**Algorithmus:**
1. FFmpeg liefert PPM Frames via Pipe
2. Generiere pHash für jeden Frame
3. Vergleiche aktuelle Sequence mit History
4. Loop erkannt wenn Sequence wiederholt wird

**Thresholds:**
- `SEQUENCE_LENGTH = 3` - 3 Frames für Match
- `HAMMING_TOLERANCE = 5` - Max 5 Bit Unterschied
- `LOOP_DURATION_THRESHOLD = 10.0` - Min 10s Loop

**Unterschied zu Root:**
- Root hat keine Loop-Detection
- dev2 kann fehlerhafte Streams (Loops) erkennen

---

### 10. **test_m3u_priority.py** - M3U Priority Tests
**Funktionen:**
- Test-Script für M3U Priority Modes
- Mock-Daten für Streams
- Testet: absolute, same_resolution, equal Modes

**Unterschied zu Root:**
- Root hat keine dedizierten Priority-Tests
- dev2 hat Test-Suite

---

### 11. **requirements-dev.txt** - Dev Dependencies
```
pytest
pytest-cov
flake8
black
requests-mock
watchdog
```

**Unterschied zu Root:**
- Root hat nur requirements.txt
- dev2 hat separate Dev-Dependencies

---

## VERGLEICH: Root vs dev2

| Feature | Root (streamflow) | dev2 (streamflow-dev2) |
|---------|-------------------|------------------------|
| **Config System** | Einfache JSON-Dateien | Profile-basiert mit Periods |
| **Automation** | Interval-basiert | Event-basiert (Cron + Interval) |
| **Stream Checking** | Einmalige Checks | Kontinuierliches Monitoring |
| **Scoring** | Einfaches Scoring | Capped Sliding Window Algorithm |
| **Lifecycle** | Keine | Review → Stable → Quarantine |
| **Loop Detection** | Keine | Sidecar Loop Detector |
| **Screenshots** | Keine | Screenshot Service |
| **Session Management** | Keine | Event-basierte Sessions |
| **EPG Integration** | Keine | EPG Event Attachment |
| **Channel Ownership** | Keine | Exclusive Ownership |
| **TVG-ID Matching** | Nur Regex | Regex + TVG-ID |
| **Migration** | Keine | Automatische Config-Migration |
| **Rollback** | Keine | Config Rollback Tool |
| **Testing** | Keine Tests | pytest + Test-Suite |

---

## FUNKTIONALE UNTERSCHIEDE

### 1. **Automation System**
- **Root:** Einfaches Interval-System (alle X Minuten)
- **dev2:** Event-basiert mit Periods, Cron-Support, 5-Min Cache

### 2. **Stream Monitoring**
- **Root:** Einmalige Checks mit stream_checker_service.py
- **dev2:** Kontinuierliches Monitoring mit FFmpeg, Real-time Stats

### 3. **Reliability Scoring**
- **Root:** Einfaches Scoring basierend auf Bitrate/Resolution/FPS
- **dev2:** Capped Sliding Window mit Dampening (reduziert Variance)

### 4. **Stream Lifecycle**
- **Root:** Keine Lifecycle-States
- **dev2:** Review (60s) → Stable (Score ≥70) → Quarantine (15min)

### 5. **Loop Detection**
- **Root:** Keine
- **dev2:** Sidecar Loop Detector mit pHash

### 6. **Screenshots**
- **Root:** Keine
- **dev2:** Screenshot Service mit HDR Detection

### 7. **Session Management**
- **Root:** Keine Sessions
- **dev2:** Event-basierte Sessions mit EPG Attachment

---

## EMPFEHLUNG

**NICHT INTEGRIEREN** - Die beiden Versionen sind zu unterschiedlich:

1. **Architektur:** Root ist Interval-basiert, dev2 ist Event-basiert
2. **Use Case:** Root für reguläre Automation, dev2 für Live-Events
3. **Komplexität:** dev2 ist deutlich komplexer
4. **Breaking Changes:** Migration würde alle Configs brechen

**STATTDESSEN:**
- Root für reguläre Automation behalten
- dev2 als separate "Live Event Monitoring" Feature entwickeln
- Beide parallel laufen lassen (verschiedene Use Cases)

---

## NÄCHSTE SCHRITTE

1. **Entscheidung:** Welche Version soll Haupt-Version werden?
2. **Wenn Root:** dev2 Features selektiv portieren (z.B. Loop Detection)
3. **Wenn dev2:** Root-Features in dev2 integrieren (z.B. Multi-Channel Processing)
4. **Hybrid:** Beide Versionen parallel für verschiedene Use Cases

---

**Erstellt:** 2026-03-02
**Autor:** Kiro AI Assistant
