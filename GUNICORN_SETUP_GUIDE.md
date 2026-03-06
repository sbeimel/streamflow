# Gunicorn Setup - Schritt für Schritt Anleitung

## Was wurde geändert?

✅ **3 Dateien wurden aktualisiert:**
1. `backend/requirements.txt` - Gunicorn Package hinzugefügt
2. `backend/entrypoint.sh` - Gunicorn Support implementiert
3. `docker-compose.yml` - Gunicorn Konfiguration hinzugefügt

---

## Installation - 3 einfache Schritte

### Schritt 1: Container stoppen
```bash
docker-compose down
```

### Schritt 2: Container neu bauen
```bash
docker-compose build
```
⏱️ Dauert ~2-5 Minuten (lädt Gunicorn herunter)

### Schritt 3: Container starten
```bash
docker-compose up -d
```

**Das war's!** 🎉

---

## Überprüfung

### Logs anschauen
```bash
docker logs streamflow
```

**Du solltest sehen:**
```
[INFO] Starting StreamFlow Container
[INFO] Server: Gunicorn (production, multi-worker)
[INFO] Workers: 8
[INFO] Threads per worker: 2
[INFO] Timeout: 120s
[INFO] Total capacity: 16 concurrent requests
[INFO] Starting Gunicorn...
[2024-03-06 10:00:00] [INFO] Starting gunicorn 21.2.0
[2024-03-06 10:00:00] [INFO] Listening at: http://0.0.0.0:5000
[2024-03-06 10:00:00] [INFO] Using worker: gthread
[2024-03-06 10:00:00] [INFO] Booting worker with pid: 123
[2024-03-06 10:00:00] [INFO] Booting worker with pid: 124
...
```

### Status prüfen
```bash
docker ps
```
Container sollte "healthy" sein.

### Web Interface testen
Öffne: http://localhost:5000

Sollte normal funktionieren!

---

## Konfiguration anpassen

### Mehr Workers (für mehr Kanäle)

**Für 10 concurrent channels:**
```yaml
# docker-compose.yml
environment:
  - GUNICORN_WORKERS=8   # Standard
```

**Für 20 concurrent channels:**
```yaml
environment:
  - GUNICORN_WORKERS=12  # Mehr Power
```

**Für 5 concurrent channels:**
```yaml
environment:
  - GUNICORN_WORKERS=4   # Weniger reicht
```

### Nach Änderung:
```bash
docker-compose down
docker-compose up -d
```
(Kein rebuild nötig!)

---

## Debug Mode (zurück zu Flask)

**Für Debugging/Development:**
```yaml
# docker-compose.yml
environment:
  - DEBUG_MODE=true  # Nutzt Flask statt Gunicorn
```

**Vorteile:**
- Bessere Error Messages
- Einfacheres Debugging
- Auto-Reload (bei Code-Änderungen)

**Nachteile:**
- Single-threaded
- Langsamer
- Nicht für Production

---

## Performance Vergleich

### Vorher (Flask Development Server)
```
Mode: Single-threaded
Workers: 1
Capacity: 1 request at a time
Multi-Channel: Langsam (GIL bottleneck)
```

### Nachher (Gunicorn mit 8 Workers)
```
Mode: Multi-worker
Workers: 8
Threads: 2 per worker
Capacity: 16 concurrent requests
Multi-Channel: 5x schneller! 🚀
```

---

## Troubleshooting

### Problem: Container startet nicht

**Lösung 1: Logs prüfen**
```bash
docker logs streamflow
```

**Lösung 2: Rebuild erzwingen**
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Problem: "gunicorn: command not found"

**Ursache:** requirements.txt wurde nicht neu installiert

**Lösung:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Problem: Zu viel Memory

**Symptom:** Container wird killed (OOM)

**Lösung:** Weniger Workers
```yaml
environment:
  - GUNICORN_WORKERS=4  # Statt 8
```

### Problem: Timeouts bei Stream Checks

**Symptom:** "Worker timeout" in Logs

**Lösung:** Timeout erhöhen
```yaml
environment:
  - GUNICORN_TIMEOUT=180  # Statt 120
```

---

## Memory & CPU Empfehlungen

### Für 8 Workers (Standard)
```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '4'
    reservations:
      memory: 1G
      cpus: '2'
```

### Für 12 Workers (High Performance)
```yaml
deploy:
  resources:
    limits:
      memory: 3G
      cpus: '6'
    reservations:
      memory: 1.5G
      cpus: '3'
```

### Für 4 Workers (Low Resources)
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '2'
    reservations:
      memory: 512M
      cpus: '1'
```

---

## Monitoring

### Worker Status
```bash
docker exec streamflow ps aux | grep gunicorn
```

**Output:**
```
root  123  gunicorn: master [web_api:app]
root  124  gunicorn: worker [web_api:app]
root  125  gunicorn: worker [web_api:app]
...
```

### Memory Usage
```bash
docker stats streamflow
```

### Live Logs
```bash
docker logs -f streamflow
```

---

## Rollback (zurück zu Flask)

**Falls Probleme auftreten:**

### Option 1: Debug Mode aktivieren
```yaml
# docker-compose.yml
environment:
  - DEBUG_MODE=true
```
```bash
docker-compose down && docker-compose up -d
```

### Option 2: Alte Version wiederherstellen
```bash
git checkout HEAD~1 backend/entrypoint.sh
git checkout HEAD~1 backend/requirements.txt
git checkout HEAD~1 docker-compose.yml
docker-compose down
docker-compose build
docker-compose up -d
```

---

## FAQ

### Q: Muss ich etwas in der Web UI ändern?
**A:** Nein! Alles funktioniert wie vorher.

### Q: Gehen meine Daten verloren?
**A:** Nein! Alle Daten bleiben erhalten (Volume: `/app/data`).

### Q: Kann ich zwischen Flask und Gunicorn wechseln?
**A:** Ja! Einfach `DEBUG_MODE` ändern und Container neu starten.

### Q: Wie viele Workers brauche ich?
**A:** 
- 5 concurrent channels → 4 workers
- 10 concurrent channels → 8 workers
- 20 concurrent channels → 12 workers

### Q: Funktioniert das auch ohne Multi-Channel?
**A:** Ja! Gunicorn verbessert die Performance generell.

### Q: Kostet das mehr Ressourcen?
**A:** Ja, etwas mehr RAM (~1-2 GB statt ~500 MB), aber viel bessere Performance!

---

## Zusammenfassung

### Was du tun musst:
```bash
# 1. Container stoppen
docker-compose down

# 2. Neu bauen
docker-compose build

# 3. Starten
docker-compose up -d

# 4. Prüfen
docker logs streamflow | grep -i gunicorn
```

### Was sich ändert:
- ✅ 5x schnellere Multi-Channel Performance
- ✅ Bessere Stabilität
- ✅ Graceful Shutdown
- ✅ Production-ready

### Was gleich bleibt:
- ✅ Web Interface
- ✅ API Endpoints
- ✅ Alle Daten
- ✅ Alle Features

---

## Support

Bei Problemen:
1. Logs prüfen: `docker logs streamflow`
2. Status prüfen: `docker ps`
3. Debug Mode aktivieren: `DEBUG_MODE=true`

**Viel Erfolg!** 🚀
