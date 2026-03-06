# Stream Check Debug Guide

## Problem
Streams von M3U Account 262 werden zugewiesen, aber alle schlagen beim Quality-Check fehl:
- ffmpeg bricht nach ~0.27s ab (erwartet: ~8s)
- Alle 7 Profile schlagen fehl
- Streams werden als "dead" markiert und entfernt

## Debug-Schritte

### 1. Aktiviere Debug-Modus
```bash
# In docker-compose.yml oder .env
DEBUG_MODE=true
```

### 2. Prüfe einen Stream manuell
```bash
# Hole eine Stream-URL von Account 262
# Teste mit ffmpeg direkt:
ffmpeg -i "STREAM_URL_HIER" -t 10 -f null -

# Oder mit curl:
curl -I "STREAM_URL_HIER"
```

### 3. Prüfe die Profile für Account 262
Die Logs zeigen, dass folgende Profile getestet werden:
- Profile 537 (XUI Default)
- Profile 538 (2)
- Profile 539 (3)
- Profile 540 (4)
- Profile 541 (5)
- Profile 542 (6)
- Profile 543 (7)

**Frage:** Welches Profil sollte für Account 262 verwendet werden?

### 4. Mögliche Probleme

#### A) HTTP-Proxy benötigt
Wenn die Streams einen Proxy benötigen:
```python
# In profile_config.py oder stream_check_utils.py
http_proxy = "http://proxy:port"
```

#### B) Spezielle Header benötigt
Manche Provider benötigen:
- User-Agent
- Referer
- Authorization
- Custom Headers

#### C) Timeout zu kurz
Die Streams brauchen vielleicht länger zum Starten:
```python
# In stream_check_utils.py
STREAM_ANALYSIS_TIMEOUT = 30  # statt 20
```

### 5. Temporäre Lösung: Quality-Check deaktivieren

Wenn du die Streams trotzdem zuweisen willst (ohne Quality-Check):

```python
# In automated_stream_manager.py, Zeile ~1398
# Kommentiere diese Zeile aus:
# self.stream_checker.mark_channels_updated(assigned_channel_ids)
```

**WARNUNG:** Dies weist die Streams zu, aber sie werden nicht auf Qualität geprüft!

### 6. Bessere Lösung: Profil-Konfiguration prüfen

Prüfe in der Datenbank oder Config:
- Welches Profil ist Account 262 zugewiesen?
- Sind die Profil-Parameter korrekt?
- Funktioniert das Profil mit anderen Accounts?

### 7. Log-Analyse

Die wichtigsten Log-Zeilen:
```
⚠ ffmpeg encountered 5-6 error(s) (set DEBUG_MODE=true for details)
```

**Du MUSST DEBUG_MODE=true setzen um die echten Fehler zu sehen!**

## Nächste Schritte

1. Setze `DEBUG_MODE=true` in der Umgebung
2. Starte den Container neu
3. Führe "Discover & Test" erneut aus
4. Schicke mir die detaillierten ffmpeg-Fehler

Dann kann ich dir genau sagen, was das Problem ist!
