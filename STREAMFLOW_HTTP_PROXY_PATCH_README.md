# StreamFlow HTTP Proxy Support

## Übersicht

Dieses Patch erweitert StreamFlow um HTTP Proxy Support für M3U Accounts. Dies ermöglicht es, M3U Playlists und Streams über HTTP Proxies zu laden, was besonders nützlich ist für:

- Geo-Blocking Umgehung
- Netzwerk-Routing über spezifische Proxy-Server
- Load Balancing über mehrere Proxy-Server
- Anonymisierung des Traffics

## Features

### M3U Account Proxy Support
- **HTTP Proxy URL Feld** in M3U Account Konfiguration
- **Automatische Proxy-Verwendung** für FFmpeg Stream-Checks
- **Flexible Konfiguration** pro M3U Account
- **Fallback-Mechanismus** bei Proxy-Fehlern

### Unterstützte Proxy-Formate
- `http://proxy-server:8080`
- `http://username:password@proxy-server:8080`
- `https://proxy-server:8080`

## Implementation Details

### Backend Änderungen

1. **M3U Account Model** erweitert um `proxy` Feld
2. **Stream Check Utils** erweitert um Proxy-Support für FFmpeg
3. **API Utils** erweitert um Proxy-Konfiguration für Stream-Checks

### Frontend Änderungen

1. **M3U Account Form** erweitert um Proxy URL Eingabefeld
2. **Validierung** der Proxy URL Format
3. **Benutzerfreundliche Hilfe-Texte**

## Verwendung

### In der UI:
1. Navigiere zu M3U Accounts
2. Bearbeite einen M3U Account
3. Füge die Proxy URL im Format `http://proxy:8080` hinzu
4. Speichere die Änderungen

### Über API:
```bash
curl -X PUT http://localhost:8000/api/m3u-accounts/123 \
  -H "Content-Type: application/json" \
  -d '{"proxy": "http://proxy-server:8080"}'
```

## Proxy-Konfiguration Beispiele

### Einfacher HTTP Proxy:
```
http://proxy.example.com:8080
```

### Proxy mit Authentifizierung:
```
http://username:password@proxy.example.com:8080
```

### HTTPS Proxy:
```
https://secure-proxy.example.com:8080
```

## Technische Details

### FFmpeg Proxy Integration
Das System verwendet FFmpeg's HTTP Proxy Support:
```bash
ffmpeg -http_proxy http://proxy:8080 -i stream_url -t 30 -f null -
```

### Fehlerbehandlung
- **Proxy-Fehler** werden geloggt aber führen nicht zum Abbruch
- **Fallback** auf direkte Verbindung bei Proxy-Problemen
- **Timeout-Handling** für langsame Proxy-Verbindungen

### Sicherheit
- **URL Validierung** verhindert Code-Injection
- **Credential Handling** für Proxy-Authentifizierung
- **Logging** ohne Passwort-Preisgabe

## Installation

1. Patch anwenden: `git apply streamflow_http_proxy_support.patch`
2. Backend neu starten
3. Frontend neu builden (falls erforderlich)

## Kompatibilität

- **Rückwärtskompatibel**: Bestehende M3U Accounts funktionieren ohne Proxy
- **Optional**: Proxy-Feld kann leer gelassen werden
- **FFmpeg Version**: Erfordert FFmpeg mit HTTP Proxy Support

## Troubleshooting

### Proxy-Verbindung schlägt fehl
- Überprüfe Proxy-URL Format
- Teste Proxy-Erreichbarkeit
- Prüfe Firewall-Einstellungen

### Streams laden nicht über Proxy
- Überprüfe FFmpeg Logs
- Teste Proxy mit anderen Tools
- Prüfe Proxy-Authentifizierung

### Performance-Probleme
- Wähle geografisch nahen Proxy
- Teste verschiedene Proxy-Server
- Überwache Proxy-Latenz