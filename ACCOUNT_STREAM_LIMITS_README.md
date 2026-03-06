# StreamFlow Limits und Kapazitäten

## Zusammenfassung

**Gute Nachricht:** Es gibt **KEINE harten Limits** für die Anzahl der M3U Accounts oder Streams, die gematcht werden können! 🎉

StreamFlow kann theoretisch unbegrenzt viele M3U Accounts und Streams verarbeiten. Die einzigen Limits sind:
1. **Konfigurierbare Limits** (die du selbst setzt)
2. **Hardware-Ressourcen** (CPU, RAM, Netzwerk)
3. **Provider-Limits** (von deinen M3U-Anbietern)

---

## 1. M3U Accounts

### Maximale Anzahl
- **Keine Begrenzung** im Code
- Du kannst beliebig viele M3U Accounts hinzufügen
- Limitiert nur durch:
  - Dispatcharr's Datenbank-Kapazität
  - Verfügbarer RAM für Caching
  - Netzwerk-Bandbreite beim Refresh

### Empfehlung
- **Praktisch:** 5-20 M3U Accounts sind typisch
- **Getestet:** System funktioniert mit 50+ Accounts
- **Performance:** Mehr Accounts = längere Discovery-Zeit

---

## 2. Streams pro M3U Account

### Maximale Anzahl
- **Keine Begrenzung** im Code
- StreamFlow kann M3U Playlists mit 10.000+ Streams verarbeiten
- Limitiert nur durch:
  - M3U Provider (manche haben 5.000-20.000 Streams)
  - RAM für Parsing und Caching
  - Discovery-Zeit (mehr Streams = länger)

### Discovery Performance
```
Beispiel: 10.000 Streams matching
- Chunk Size: 1.000 Streams
- Workers: 8 parallel
- Zeit: ~2-5 Minuten (abhängig von Regex-Komplexität)
```

**Code-Referenz:** `backend/automated_stream_manager.py` Zeile 1177
```python
chunk_size = max(1000, total_streams // ideal_chunks)
```

---

## 3. Streams pro Channel (Assignment)

### Während Discovery/Matching
- **Keine Begrenzung** beim initialen Matching
- Alle passenden Streams werden zugewiesen
- Beispiel: Wenn 500 Streams zum Regex passen, werden alle 500 zugewiesen

### Nach Quality Check
- **Keine harte Begrenzung**
- Streams werden nach Qualität sortiert
- Schlechte Streams werden automatisch entfernt (Dead Stream Detection)

### Im Changelog (nur Anzeige)
- **Display Limit:** 20 Streams pro Channel werden im Changelog angezeigt
- **Grund:** UI-Performance und Übersichtlichkeit
- **Wichtig:** Dies ist NUR eine Anzeige-Begrenzung, nicht eine funktionale Begrenzung!

**Code-Referenz:** `backend/tests/test_changelog_limits.py` Zeile 77
```python
max_streams_per_channel = 20  # Nur für Changelog-Anzeige
```

---

## 4. Concurrent Stream Checking (Parallelität)

### Global Limit
**Konfigurierbar in:** Automation Settings → Concurrent Streams

**Standard-Werte:**
```json
{
  "concurrent_streams": {
    "global_limit": 35,  // Anzahl parallel geprüfter Streams
    "stagger_delay": 1.0  // Verzögerung zwischen Starts (Sekunden)
  }
}
```

**Empfohlene Werte:**
```
4 CPU Cores:  global_limit: 40
8 CPU Cores:  global_limit: 60
16 CPU Cores: global_limit: 100
```

**Zweck:**
- Verhindert Überlastung deines Systems
- Verhindert Überlastung der Stream-Provider
- Optimiert Netzwerk-Bandbreite

### Per-Account Stream Limits
**Konfigurierbar in:** Automation Settings → Account Stream Limits

**Zweck:**
- Respektiert Provider-Limits (z.B. "max 2 concurrent streams")
- Verhindert Account-Sperrungen
- Kann global oder pro Account gesetzt werden

**Beispiel:**
```json
{
  "account_stream_limits": {
    "enabled": true,
    "global_limit": 0,  // 0 = unbegrenzt
    "account_limits": {
      "262": 2,  // Account 262: max 2 parallel
      "150": 5   // Account 150: max 5 parallel
    }
  }
}
```

**Wichtig:** Dies limitiert nur die **parallele Prüfung**, nicht die Gesamtanzahl!

---

## 5. Multi-Channel Processing

### Maximale Anzahl paralleler Channels
**Konfigurierbar in:** Automation Settings → Concurrent Streams

```json
{
  "concurrent_streams": {
    "multi_channel_enabled": true,
    "max_concurrent_channels": 10  // Anzahl Channels gleichzeitig
  }
}
```

**Empfohlene Werte:**
```
global_limit / 3 = max_concurrent_channels

Beispiele:
- global_limit: 30 → max_concurrent_channels: 10
- global_limit: 60 → max_concurrent_channels: 20
- global_limit: 90 → max_concurrent_channels: 30
```

---

## 6. Praktische Limits (Hardware)

### RAM-Verbrauch
**Pro M3U Account:**
- ~5-10 MB für 1.000 Streams (gecacht)
- ~50-100 MB für 10.000 Streams

**Während Stream Checking:**
- ~50-100 MB pro parallel geprüftem Stream (ffmpeg)
- Bei `global_limit: 60` → ~3-6 GB RAM

**Empfehlung:**
```
global_limit: 35 → 2 GB RAM minimum
global_limit: 60 → 4 GB RAM minimum
global_limit: 100 → 8 GB RAM minimum
```

### CPU-Auslastung
- **ffmpeg ist I/O-bound**, nicht CPU-bound
- Wartet hauptsächlich auf Netzwerk-Antworten
- Hohe Parallelität (60-100) ist möglich ohne CPU-Überlastung

### Netzwerk-Bandbreite
**Während Stream Checking:**
- ~1-5 Mbit/s pro Stream (abhängig von Stream-Qualität)
- Bei `global_limit: 60` → ~60-300 Mbit/s

**Empfehlung:**
- 100 Mbit/s Upload: `global_limit: 30-40`
- 500 Mbit/s Upload: `global_limit: 60-80`
- 1 Gbit/s Upload: `global_limit: 100+`

---

## 7. Provider-Limits (M3U Anbieter)

### Typische Provider-Limits
```
Budget Provider:  1-2 concurrent streams
Standard Provider: 3-5 concurrent streams
Premium Provider: 10+ concurrent streams
```

### Wie StreamFlow damit umgeht
1. **Account Stream Limits** konfigurieren (siehe Abschnitt 4)
2. **Profile Failover** nutzt automatisch andere Accounts wenn Limit erreicht
3. **Smart Scheduler** verteilt Checks optimal über alle Accounts

**Beispiel:**
```
Account A: max_streams = 2
Account B: max_streams = 5
Channel hat: 10 Streams (5 von A, 5 von B)

StreamFlow prüft parallel:
- 2 Streams von Account A
- 5 Streams von Account B
= 7 Streams gleichzeitig (respektiert beide Limits)
```

---

## 8. Dein spezifischer Fall: M3U Account 262

### Problem-Analyse
Basierend auf deinen Logs:
- ✅ **Streams werden gematcht** (30 Streams zu 17 Channels)
- ✅ **Keine Limit-Probleme** beim Matching
- ❌ **Problem:** Alle Quality Checks schlagen fehl (0.27s statt 8s)

### Wahrscheinliche Ursache
**Nicht ein Limit-Problem, sondern ein Proxy-Problem!**

Account 262 benötigt wahrscheinlich einen HTTP Proxy, aber keiner ist konfiguriert:
1. ffmpeg kann Stream-URLs nicht erreichen
2. Verbindung schlägt sofort fehl (0.27s)
3. Alle 7 Profile scheitern (weil alle dieselben URLs verwenden)

### Lösung
1. **Debug Mode aktivieren:**
   ```
   DEBUG_MODE=true
   ```
   → Zeigt genaue ffmpeg-Fehler

2. **Proxy in Dispatcharr konfigurieren:**
   - Gehe zu M3U Account 262 Settings
   - Füge HTTP Proxy URL hinzu
   - Beispiel: `http://proxy.example.com:8080`

3. **Discovery erneut ausführen**

**Siehe auch:** `M3U_262_DEBUG_ANALYSIS.md` für detaillierte Analyse

---

## 9. Zusammenfassung: Gibt es Limits?

| Aspekt | Limit | Typ | Konfigurierbar |
|--------|-------|-----|----------------|
| **M3U Accounts** | Keine | - | - |
| **Streams pro M3U** | Keine | - | - |
| **Streams pro Channel** | Keine | - | - |
| **Parallel Checking (Global)** | 35 (Standard) | Soft | ✅ Ja |
| **Parallel Checking (Pro Account)** | 0 (Standard) | Soft | ✅ Ja |
| **Parallel Channels** | 10 (Standard) | Soft | ✅ Ja |
| **Changelog Display** | 20 Streams | UI | Nein |
| **RAM** | Abhängig von Hardware | Hard | Nein |
| **CPU** | Abhängig von Hardware | Hard | Nein |
| **Netzwerk** | Abhängig von Verbindung | Hard | Nein |
| **Provider Concurrent Streams** | Abhängig von Provider | Hard | Nein |

**Legende:**
- **Soft Limit:** Kann in Konfiguration geändert werden
- **Hard Limit:** Physikalische Begrenzung (Hardware/Provider)
- **UI Limit:** Nur Anzeige-Begrenzung, keine funktionale Einschränkung

---

## 10. Best Practices

### Für große M3U Accounts (10.000+ Streams)
1. **Erhöhe `global_limit`** auf 60-100 (wenn Hardware erlaubt)
2. **Aktiviere Multi-Channel Processing** für parallele Channel-Checks
3. **Nutze Gunicorn** statt Flask für bessere Performance
4. **Setze Account Stream Limits** um Provider-Sperren zu vermeiden

### Für viele M3U Accounts (20+)
1. **Konfiguriere Account-spezifische Limits** individuell
2. **Nutze Profile Failover** für automatische Account-Rotation
3. **Plane Global Checks** außerhalb der Hauptnutzungszeit
4. **Überwache RAM-Verbrauch** (Caching von vielen Accounts)

### Für langsame Verbindungen
1. **Reduziere `global_limit`** auf 20-30
2. **Erhöhe `stagger_delay`** auf 2.0 Sekunden
3. **Deaktiviere Multi-Channel** oder reduziere auf 5 Channels
4. **Nutze Quality Check Exclusions** für bekannt gute Streams

---

## 11. Monitoring und Troubleshooting

### Wie erkenne ich Limit-Probleme?

**Symptom 1: Langsame Discovery**
```
Ursache: Zu viele Streams, zu wenig Parallelität
Lösung: Erhöhe global_limit
```

**Symptom 2: System-Überlastung**
```
Ursache: global_limit zu hoch für Hardware
Lösung: Reduziere global_limit, erhöhe RAM
```

**Symptom 3: Provider-Sperren**
```
Ursache: Account Stream Limits nicht konfiguriert
Lösung: Setze account_limits für betroffene Accounts
```

**Symptom 4: Streams werden nicht zugewiesen**
```
Ursache: NICHT ein Limit-Problem!
Lösung: Prüfe Regex, Proxy-Konfiguration, Debug Mode
```

### Logs prüfen
```bash
# Limit-bezogene Logs
grep "limit" /app/data/logs/streamflow.log
grep "exceeded" /app/data/logs/streamflow.log
grep "max_streams" /app/data/logs/streamflow.log

# Account-spezifische Limits
grep "Account.*limit" /app/data/logs/streamflow.log
```

---

## Fazit

**Deine Frage:** "Gibt es eine maximale Anzahl an M3U und Streams die geprüft und gematcht werden können?"

**Antwort:** 
- ❌ **Keine harten Limits** im Code für M3U Accounts oder Streams
- ✅ **Konfigurierbare Limits** für Parallelität (Performance-Optimierung)
- ✅ **Hardware-Limits** (RAM, CPU, Netzwerk) sind die einzige echte Begrenzung
- ✅ **Provider-Limits** müssen respektiert werden (Account Stream Limits)

**Für deinen Fall (M3U 262):**
Das Problem ist NICHT ein Limit, sondern wahrscheinlich fehlende Proxy-Konfiguration!

---

**Erstellt:** 2026-03-06  
**Version:** StreamFlow v2.1+  
**Siehe auch:** 
- `M3U_262_DEBUG_ANALYSIS.md` - Debug-Anleitung für Account 262
- `QUICK_WINS_OPTIMIZATIONS_README.md` - Performance-Optimierungen
- `ADVANCED_PERFORMANCE_OPTIMIZATIONS.md` - Erweiterte Optimierungen
