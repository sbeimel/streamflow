# M3U Account 262 - Debug-Analyse

## Problem-Zusammenfassung

**Symptome:**
- ✅ 30 Streams werden erfolgreich zu 17 Channels zugeordnet
- ❌ ALLE Streams schlagen beim Quality-Check fehl (nach ~0.27s)
- ❌ Alle 7 Profile werden getestet, alle schlagen fehl
- ❌ Streams werden als "dead" markiert und wieder entfernt

**Fehler-Pattern:**
```
⚠ Failed to detect bitrate from ffmpeg output (analyzed for 0.27s, expected ~8s)
⚠ ffmpeg completed in 0.27s (expected ~8s)
⚠ ffmpeg encountered 5-6 error(s) (set DEBUG_MODE=true for details)
```

## Warum werden 7 Profile getestet?

Das System hat **Profile-Failover mit 2 Phasen**:

### Phase 1: Available Profiles
- Testet Profile die noch Kapazität haben
- Bei M3U 262: Wahrscheinlich nur "XUI Default" (Profile 537)

### Phase 2: All Profiles (Fallback)
- Wenn Phase 1 fehlschlägt, testet es ALLE Profile
- Auch Profile die bereits voll sind
- Bei M3U 262: Profile 537-543 (7 Profile total)

**Das ist NICHT das Problem!** Das Problem ist, dass ffmpeg mit ALLEN Profilen sofort abbricht.

## Root Cause Analysis

### Mögliche Ursachen (in Reihenfolge der Wahrscheinlichkeit):

#### 1. ⚠️ PROXY FEHLT (Wahrscheinlichste Ursache)
**Symptom:** ffmpeg bricht nach 0.27s ab
**Ursache:** M3U Account 262 benötigt einen Proxy, aber keiner ist konfiguriert

**Prüfen:**
```sql
-- In Dispatcharr Datenbank:
SELECT id, name, proxy FROM m3u_accounts WHERE id = 262;
```

**Lösung:**
1. In Dispatcharr: M3U Account 262 bearbeiten
2. HTTP Proxy URL eintragen (z.B. `http://proxy:8080`)
3. Speichern
4. StreamFlow neu starten oder UDI Cache refreshen

#### 2. ⚠️ STREAM-URLs UNGÜLTIG
**Symptom:** ffmpeg kann Stream nicht öffnen
**Ursache:** Die URLs von M3U 262 sind temporär oder ungültig

**Prüfen:**
```bash
# Teste eine Stream-URL manuell:
curl -I "STREAM_URL_VON_M3U_262"
```

#### 3. ⚠️ AUTHENTIFIZIERUNG FEHLT
**Symptom:** HTTP 401/403 Fehler
**Ursache:** Streams benötigen spezielle Header oder Token

**Prüfen:**
- Logs nach "401", "403", "Unauthorized" durchsuchen
- M3U Account Credentials prüfen

#### 4. ⚠️ TIMEOUT ZU KURZ
**Symptom:** Streams brauchen länger zum Starten
**Ursache:** Langsamer Provider oder Netzwerk

**Lösung:**
```python
# In stream_check_utils.py
STREAM_ANALYSIS_TIMEOUT = 30  # statt 20
```

#### 5. ⚠️ FFMPEG CODEC-PROBLEM
**Symptom:** Exit Code 8 (siehe Logs)
**Ursache:** Stream-Format nicht unterstützt

**Prüfen:**
```bash
ffmpeg -i "STREAM_URL" -t 5 -f null -
```

## Sofort-Maßnahmen

### Schritt 1: Debug-Modus aktivieren
```bash
# In docker-compose.yml oder .env:
DEBUG_MODE=true
```

Dann Container neu starten und "Discover & Test" erneut ausführen.

### Schritt 2: Proxy prüfen
```bash
# In Dispatcharr UI:
1. Navigiere zu M3U Accounts
2. Finde Account 262
3. Prüfe ob "HTTP Proxy" Feld ausgefüllt ist
4. Wenn leer: Füge Proxy hinzu (z.B. http://proxy:8080)
```

### Schritt 3: Stream-URL manuell testen
```bash
# Hole eine Stream-URL von Account 262 aus den Logs
# Teste mit curl:
curl -v -I "STREAM_URL_HIER"

# Teste mit ffmpeg:
ffmpeg -i "STREAM_URL_HIER" -t 10 -f null -
```

### Schritt 4: Logs analysieren
Suche in den Logs nach:
```
get_stream_proxy
Found proxy
M3U account 262 has no proxy configured
```

## Temporäre Workarounds

### Option A: Quality-Check überspringen (NICHT EMPFOHLEN)
```python
# In automated_stream_manager.py, Zeile ~1398
# Kommentiere aus:
# self.stream_checker.mark_channels_updated(assigned_channel_ids)
```

**WARNUNG:** Streams werden zugewiesen aber nicht geprüft!

### Option B: Längere Timeouts
```python
# In stream_check_utils.py
STREAM_ANALYSIS_TIMEOUT = 45  # statt 20
```

### Option C: Retry-Logik erhöhen
```python
# In stream_checker_service.py
'retries': 3,  # statt 1
'retry_delay': 15,  # statt 10
```

## Nächste Schritte

1. ✅ Setze `DEBUG_MODE=true`
2. ✅ Prüfe ob M3U 262 einen Proxy braucht
3. ✅ Führe "Discover & Test" erneut aus
4. ✅ Schicke mir die detaillierten ffmpeg-Fehler aus den Logs

Mit den Debug-Logs kann ich dir genau sagen, was das Problem ist!

## Erwartete Log-Ausgabe mit DEBUG_MODE=true

```
DEBUG - get_stream_proxy called with stream_id=1037002
DEBUG - Stream 1037002 found in UDI cache
DEBUG - M3U account 262 has no proxy configured  <-- HIER IST DAS PROBLEM!
DEBUG - Using HTTP proxy for FFmpeg: None
ERROR - ffmpeg stderr: Connection refused
ERROR - ffmpeg stderr: HTTP error 403 Forbidden
```

Oder wenn Proxy konfiguriert ist:
```
DEBUG - Found proxy 'http://proxy:8080' for stream 1037002 from M3U account 262
DEBUG - Using HTTP proxy for FFmpeg: http://proxy:8080
```
