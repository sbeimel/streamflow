# EPG Authentication Fix

## Problem

EPG-Abruf schlug fehl mit `401 Unauthorized`:
```
ERROR - Error fetching EPG grid: 401 Client Error: Unauthorized for url: http://10.0.0.168:59191/api/epg/grid/
WARNING - Returning stale cached EPG data due to fetch error
```

## Ursache

Der `scheduling_service.py` verwendete **Bearer Token** Authentication:
```python
# ALT (falsch):
headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/json"
}
response = requests.get(url, headers=headers, timeout=30)
```

Aber Dispatcharr verwendet **Basic Auth** (Username/Password), nicht Bearer Tokens!

Alle anderen Services (api_utils, udi/fetcher, etc.) verwenden korrekt:
```python
# RICHTIG:
auth = (username, password)
response = requests.get(url, auth=auth, timeout=30)
```

## Lösung

### 1. `_get_auth_token()` erweitert

Unterstützt jetzt beide Auth-Methoden:

```python
def _get_auth_token(self) -> Optional[str]:
    # 1. Versuche Bearer Token (falls konfiguriert)
    token = os.getenv("DISPATCHARR_TOKEN")
    if token:
        return token
    
    # 2. Fallback zu Basic Auth (Standard für Dispatcharr)
    username = os.getenv("DISPATCHARR_USER")
    password = os.getenv("DISPATCHARR_PASS")
    
    if username and password:
        return f"Basic:{username}:{password}"
    
    return None
```

### 2. `fetch_epg_grid()` erweitert

Erkennt Auth-Methode automatisch:

```python
# Handle different auth methods
headers = {"Accept": "application/json"}
auth = None

if token:
    if token.startswith("Basic:"):
        # Basic Auth (username:password)
        parts = token.split(":", 2)
        username = parts[1]
        password = parts[2]
        auth = (username, password)
    else:
        # Bearer Token
        headers["Authorization"] = f"Bearer {token}"

response = requests.get(url, headers=headers, auth=auth, timeout=30)
```

## Konfiguration

In `.env` oder `docker-compose.yml`:

```bash
# Basic Auth (Standard - empfohlen):
DISPATCHARR_USER=dein_username
DISPATCHARR_PASS=dein_password

# ODER Bearer Token (falls Dispatcharr das unterstützt):
DISPATCHARR_TOKEN=your_bearer_token
```

## Nach dem Fix

1. **Container neu starten:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **Logs prüfen:**
   ```bash
   docker-compose logs -f backend | grep "EPG"
   ```

3. **Erwartetes Ergebnis:**
   ```
   INFO - Fetching EPG grid data from http://10.0.0.168:59191/api/epg/grid/
   INFO - Using Basic Auth for EPG grid request
   INFO - Fetched 5747 programs from EPG grid
   INFO - EPG refresh complete. Fetched 5747 programs.
   ```

## Backward Compatibility

✅ **Ja** - Unterstützt beide Auth-Methoden:
- Basic Auth (DISPATCHARR_USER + DISPATCHARR_PASS) - Standard
- Bearer Token (DISPATCHARR_TOKEN) - Falls vorhanden

## Betroffene Dateien

- `backend/scheduling_service.py`
  - Zeile ~157: `_get_auth_token()` erweitert
  - Zeile ~194: `fetch_epg_grid()` Auth-Handling verbessert

## Testing

Nach dem Deployment sollten die 401-Fehler verschwinden und EPG-Daten korrekt abgerufen werden.
