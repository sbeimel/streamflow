# Fix für lokale Streams (10.0.0.168:61095)

## Problem
Streams auf `10.0.0.168:61095` schlagen sofort fehl (0.1-0.2s) mit ffmpeg-Fehlern, obwohl die Streams funktionieren.

## Ursache (GEFUNDEN!)
```
HTTP error 429 TOO MANY REQUESTS
```

Der IPTV-Server auf `:61095` hat ein **Rate Limit** und blockiert zu viele gleichzeitige Stream-Checks. StreamFlow checkt zu viele Streams parallel von diesem Account.

## Lösung 1: Host-Netzwerk verwenden (Empfohlen für lokale Streams)

Ändere `docker-compose.yml`:

```yaml
services:
  stream-checker:
    # ... existing config ...
    network_mode: "host"  # Füge diese Zeile hinzu
    # Entferne oder kommentiere aus:
    # networks:
    #   - streamflow-network
```

Dann:
```bash
docker-compose down
docker-compose up -d
```

**Vorteil**: Container kann alle lokalen IPs erreichen
**Nachteil**: Ports werden direkt auf Host gemappt

## Lösung 2: Extra Hosts hinzufügen

Wenn du Bridge-Netzwerk behalten willst:

```yaml
services:
  stream-checker:
    # ... existing config ...
    extra_hosts:
      - "local-iptv:10.0.0.168"  # Füge diese Zeile hinzu
```

Dann musst du aber die Stream-URLs anpassen (10.0.0.168 → local-iptv).

## Lösung 3: Timeout und Buffer erhöhen

Falls es ein Timeout-Problem ist, erhöhe die Werte in der Automation-Config:

```json
{
  "stream_analysis": {
    "ffmpeg_duration": 30,
    "timeout": 60,
    "stream_startup_buffer": 30,
    "retries": 2,
    "retry_delay": 10
  }
}
```

## Lösung 4: DEBUG_MODE aktivieren

Um die genauen ffmpeg-Fehler zu sehen:

```bash
# In docker-compose.yml bereits gesetzt:
DEBUG_MODE=true

# Logs anschauen:
docker-compose logs -f stream-checker
```

## Test
Nach der Änderung teste einen Stream manuell:

```bash
# Im Container:
docker exec -it streamflow-mod-stream-checker-1 bash
ffmpeg -user_agent "VLC/3.0.14" -i "http://10.0.0.168:61095/jexhammer/vmesa123/[stream_id].ts" -t 5 -f null -

# Oder von außen:
curl -I "http://10.0.0.168:61095/jexhammer/vmesa123/[stream_id].ts"
```

## Empfehlung
Starte mit **Lösung 1 (Host-Netzwerk)** - das ist die einfachste Lösung für lokale IPTV-Server.
