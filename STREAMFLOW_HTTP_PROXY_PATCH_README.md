# StreamFlow HTTP Proxy Support

## Übersicht

StreamFlow unterstützt HTTP Proxy für M3U Accounts vollständig. Die Proxy-Einstellungen werden automatisch aus der Dispatcharr API gelesen und für Stream Quality Checks verwendet.

## ✅ Implementierte Features

### Automatische Proxy-Integration
- **Dispatcharr API Integration**: Proxy-Einstellungen werden automatisch aus M3U Account Konfiguration gelesen
- **FFmpeg Proxy Support**: Automatische Proxy-Verwendung für alle Stream Quality Checks
- **Per-Account Konfiguration**: Jeder M3U Account kann individuelle Proxy-Einstellungen haben
- **Fallback-Mechanismus**: Bei Proxy-Fehlern wird direkte Verbindung verwendet

### Unterstützte Proxy-Formate
- `http://proxy-server:8080`
- `http://username:password@proxy-server:8080`
- `https://proxy-server:8080`

## Implementation Details

### ✅ Backend Implementation

1. **`get_stream_proxy(stream_id)` Funktion** in `api_utils.py`
   - Holt Proxy-Einstellungen aus UDI Cache
   - Verknüpft Stream mit M3U Account
   - Gibt Proxy URL zurück oder None

2. **Stream Checker Integration** in `stream_checker_service.py`
   - Automatischer Aufruf von `get_stream_proxy()` vor jedem Stream Check
   - FFmpeg wird mit `-http_proxy` Parameter aufgerufen
   - Logging der Proxy-Verwendung

3. **UDI System Integration**
   - M3U Account Daten inklusive Proxy werden aus Dispatcharr API gecacht
   - Automatische Aktualisierung bei Dispatcharr Änderungen

### ✅ Dispatcharr Integration

Die Proxy-Konfiguration erfolgt komplett in Dispatcharr:
1. M3U Account in Dispatcharr bearbeiten
2. HTTP Proxy URL eintragen
3. StreamFlow verwendet automatisch diese Einstellungen

## Verwendung

### In Dispatcharr:
1. Navigiere zu M3U Accounts
2. Bearbeite einen M3U Account
3. Füge die Proxy URL im Format `http://proxy:8080` hinzu
4. Speichere die Änderungen
5. StreamFlow verwendet automatisch den Proxy für Quality Checks

### Keine Frontend-Änderungen nötig:
- Proxy-Konfiguration erfolgt ausschließlich in Dispatcharr
- StreamFlow zeigt keine Proxy-Einstellungen in der UI
- Proxy-Verwendung ist transparent für den Benutzer

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
Das System verwendet FFmpeg's HTTP Proxy Support automatisch:
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

## Status

✅ **Vollständig implementiert und funktionsfähig**
- Backend Integration: ✅ Implementiert
- Dispatcharr API Integration: ✅ Implementiert  
- FFmpeg Proxy Support: ✅ Implementiert
- Fehlerbehandlung: ✅ Implementiert

## Kompatibilität

- **Rückwärtskompatibel**: M3U Accounts ohne Proxy funktionieren normal
- **Optional**: Proxy-Feld kann in Dispatcharr leer gelassen werden
- **FFmpeg Version**: Erfordert FFmpeg mit HTTP Proxy Support (standardmäßig verfügbar)

## Troubleshooting

### Proxy-Verbindung schlägt fehl
- Überprüfe Proxy-URL Format in Dispatcharr
- Teste Proxy-Erreichbarkeit vom StreamFlow Container
- Prüfe Firewall-Einstellungen

### Streams laden nicht über Proxy
- Überprüfe StreamFlow Logs nach `get_stream_proxy` Einträgen
- Teste Proxy mit anderen Tools
- Prüfe Proxy-Authentifizierung

### Performance-Probleme
- Wähle geografisch nahen Proxy
- Teste verschiedene Proxy-Server
- Überwache Proxy-Latenz in den Logs

## Logs überwachen

Proxy-Verwendung wird geloggt:
```
DEBUG - Found proxy 'http://proxy:8080' for stream 12345 from M3U account 1
DEBUG - M3U account 2 has no proxy configured
```