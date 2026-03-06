# 🚨 KRITISCHER BUG: Profile Failover testet falsche Stream-URLs

## Problem

**Symptom:** ffmpeg testet komplett falsche URLs von anderen Providern während Quality Checks

**Beispiel aus deinen Logs:**
```
Stream 854825 (DE - DAZN 5 HD) von Account 238 (saw-tech.xyz)
Sollte testen: http://sv1.saw-tech.xyz/live/TURGTC5/Q146JZW/27921...
Testet aber:   http://xruistream.bio:8080/play/live.php?mac=00:1A:79:46:EB:EB&stream=67677...
                ^^^^^^^^^^^^^^^^^ KOMPLETT FALSCHER PROVIDER!
```

## Root Cause

### Problem im Code

**Datei:** `backend/udi/manager.py` Zeile 1461

```python
def apply_profile_url_transformation(self, stream: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> str:
    original_url = stream.get('url', '')  # ❌ PROBLEM HIER!
    if not original_url:
        return original_url
```

### Was passiert:

1. **Stream wird aus Dispatcharr geladen:**
   ```python
   stream = {
       'id': 854825,
       'name': 'DE - DAZN 5 HD',
       'url': 'http://10.0.0.168:61095/jexhammer/vmesa123/...',  # Dispatcharr Proxy URL!
       'm3u_account': 238
   }
   ```

2. **`apply_profile_url_transformation` verwendet diese Proxy-URL:**
   - Die `url` ist NICHT die Original-M3U-URL
   - Es ist die **Dispatcharr-Proxy-URL** eines anderen Profils
   - Diese URL zeigt auf einen **komplett anderen Provider**!

3. **Profile Failover wendet Transformation auf falsche URL an:**
   - Nimmt Proxy-URL von Provider A
   - Wendet Transformation für Provider B an
   - Ergebnis: Komplett kaputte URL oder URL von falschem Provider

### Warum passiert das?

Wenn ein Stream bereits einem Channel zugewiesen ist:
- Dispatcharr speichert die **Proxy-URL** im `url` Feld
- Die **Original-M3U-URL** ist NICHT mehr verfügbar
- Profile Failover kann nicht auf die Original-URL zugreifen

## Auswirkung

**ALLE Quality Checks schlagen fehl wenn:**
1. Stream ist bereits einem Channel zugewiesen
2. Stream verwendet ein Profil mit URL-Transformation
3. Profile Failover versucht andere Profile zu testen

**Resultat:**
- ❌ Streams werden als "dead" markiert obwohl sie funktionieren
- ❌ Profile Failover funktioniert nicht
- ❌ Falsche URLs werden getestet (andere Provider!)
- ❌ HTTP 405, 404, oder andere Fehler

## Lösung

### Option 1: M3U-URL aus M3U Account rekonstruieren (EMPFOHLEN)

Dispatcharr M3U Accounts haben ein URL-Template:
```
http://provider.com/get.php?username={username}&password={password}&type=m3u_plus
```

Streams haben einen `stream_id` oder `channel_id` Parameter.

**Lösung:**
1. Hole M3U Account Details
2. Extrahiere Stream-ID aus aktueller URL oder Stream-Metadaten
3. Rekonstruiere Original-M3U-URL
4. Wende Profile-Transformation auf rekonstruierte URL an

### Option 2: Original-URL in Stream-Metadaten speichern

Dispatcharr könnte `original_m3u_url` Feld hinzufügen:
```python
stream = {
    'id': 854825,
    'url': 'http://10.0.0.168:61095/...',  # Proxy URL
    'original_m3u_url': 'http://sv1.saw-tech.xyz/live/...',  # Original!
    'm3u_account': 238
}
```

**Problem:** Erfordert Änderungen in Dispatcharr (nicht unter unserer Kontrolle)

### Option 3: Streams direkt aus M3U Playlist laden

Statt Streams aus Dispatcharr API zu laden:
1. Lade M3U Playlist direkt vom Provider
2. Parse M3U und finde Stream
3. Verwende Original-URL aus M3U

**Problem:** Performance (muss M3U jedes Mal parsen)

## Empfohlene Lösung: Option 1

### Implementation

**Datei:** `backend/udi/manager.py`

```python
def get_original_m3u_url_for_stream(self, stream: Dict[str, Any]) -> Optional[str]:
    """Get the original M3U URL for a stream by reconstructing it from M3U account.
    
    Args:
        stream: Stream dictionary with 'm3u_account' and 'id'
        
    Returns:
        Original M3U URL or None if cannot be determined
    """
    m3u_account_id = stream.get('m3u_account')
    if not m3u_account_id:
        return None
    
    # Get M3U account details
    m3u_account = self.get_m3u_account_by_id(m3u_account_id)
    if not m3u_account:
        return None
    
    # Get M3U playlist URL template
    m3u_url_template = m3u_account.get('url')
    if not m3u_url_template:
        return None
    
    # Try to extract stream ID from current URL or stream metadata
    stream_id = self._extract_stream_id_from_url(stream.get('url', ''))
    if not stream_id:
        # Fallback: use stream name or other metadata
        return None
    
    # Reconstruct original stream URL
    # Most M3U providers use format: http://provider.com/username/password/stream_id.ts
    # or: http://provider.com/live/username/password/stream_id.ts
    
    # Parse M3U account credentials from URL
    import re
    from urllib.parse import urlparse, parse_qs
    
    parsed = urlparse(m3u_url_template)
    query_params = parse_qs(parsed.query)
    
    username = query_params.get('username', [''])[0]
    password = query_params.get('password', [''])[0]
    
    if not username or not password:
        return None
    
    # Reconstruct stream URL (common format)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    stream_url = f"{base_url}/live/{username}/{password}/{stream_id}.ts"
    
    return stream_url

def _extract_stream_id_from_url(self, url: str) -> Optional[str]:
    """Extract stream ID from a stream URL.
    
    Args:
        url: Stream URL (either proxy or original)
        
    Returns:
        Stream ID or None
    """
    import re
    
    # Try common patterns
    patterns = [
        r'/(\d+)\.ts',  # /12345.ts
        r'/(\d+)\.m3u8',  # /12345.m3u8
        r'stream=(\d+)',  # stream=12345
        r'channel=(\d+)',  # channel=12345
        r'/live/[^/]+/[^/]+/(\d+)',  # /live/user/pass/12345
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

def apply_profile_url_transformation(self, stream: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> str:
    """Apply search/replace pattern transformation to a stream URL.
    
    FIXED: Now uses original M3U URL instead of Dispatcharr proxy URL
    """
    import re
    
    # Try to get original M3U URL first
    original_url = self.get_original_m3u_url_for_stream(stream)
    
    # Fallback to stream URL if we can't reconstruct original
    if not original_url:
        original_url = stream.get('url', '')
        logger.warning(f"Could not reconstruct original M3U URL for stream {stream.get('id')}, using current URL")
    
    if not original_url:
        return original_url
    
    # Rest of the function remains the same...
    # [existing code]
```

## Temporäre Workaround (SOFORT ANWENDBAR)

Bis der Fix implementiert ist:

### 1. Deaktiviere Profile Failover für betroffene Accounts

**Datei:** Automation Settings → Profile Failover

```json
{
  "profile_failover": {
    "enabled": false  // Temporär deaktivieren!
  }
}
```

### 2. Teste nur Streams ohne Stats

Verwende "Test Streams Without Stats" Button statt "Discover & Test":
- Testet nur neue Streams (die noch keine Proxy-URL haben)
- Vermeidet das Problem mit bereits zugewiesenen Streams

### 3. Lösche und re-assigne betroffene Streams

1. Lösche Streams von betroffenen Channels
2. Führe "Discover & Test" erneut aus
3. Neue Streams haben Original-URLs

## Verification

Nach dem Fix sollten die Logs zeigen:

```
✅ VORHER (FALSCH):
Stream 854825: Trying profile saw-tech Default
Analyzing: http://xruistream.bio:8080/play/live.php?...  ❌ FALSCHE URL!

✅ NACHHER (RICHTIG):
Stream 854825: Trying profile saw-tech Default  
Analyzing: http://sv1.saw-tech.xyz/live/TURGTC5/Q146JZW/27921...  ✅ KORREKTE URL!
```

## Impact Assessment

**Betroffene Systeme:**
- ✅ Alle Installationen mit Profile Failover
- ✅ Alle M3U Accounts mit URL-Transformationen
- ✅ Alle bereits zugewiesenen Streams

**Nicht betroffen:**
- ❌ Neue Streams (noch nicht zugewiesen)
- ❌ Streams ohne Profile
- ❌ Custom Streams (keine M3U URL)

## Priority

**KRITISCH** - Dieser Bug macht Profile Failover komplett unbrauchbar für bereits zugewiesene Streams!

---

**Erstellt:** 2026-03-06  
**Status:** IDENTIFIZIERT - FIX BENÖTIGT  
**Severity:** CRITICAL  
**Affected:** Profile Failover v2.0+
