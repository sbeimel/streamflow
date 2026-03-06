# M3U Account Testing Buttons - Implementation

## Übersicht

Zwei neue Buttons im Dashboard für M3U Account Testing:

1. **Test All Streams** (🧪 TestTube Icon)
2. **Discover & Test** (🔍🧪 Search + TestTube Icons)

Beide Buttons bypassen Stream Check Immunity für vollständige Tests.

---

## Button 1: Test All Streams 🧪

### Funktion
Testet **ALLE Streams** vom M3U Account direkt, ohne Channel-Zuordnung.

### Use Cases
- Neuen Provider testen bevor Streams zugeordnet werden
- Qualität aller Streams eines Providers prüfen
- Schneller Test ohne Discovery

### Was passiert
1. Lädt alle Streams vom M3U Account aus UDI
2. Testet jeden Stream direkt mit `check_stream_quality()`
3. Speichert Stats in UDI
4. Startet Stream Checker automatisch falls nicht läuft
5. Limit: Erste 50 Streams (für Sicherheit)

### Backend API
```
POST /api/stream-checker/test-all-m3u-streams/<account_id>
```

**Response:**
```json
{
  "message": "Tested 45 stream(s) from M3U account 5",
  "streams_found": 50,
  "streams_tested": 45,
  "results": [
    {
      "stream_id": 123,
      "stream_name": "Stream Name",
      "status": "success",
      "resolution": "1920x1080",
      "bitrate": 5000
    }
  ],
  "status": "completed"
}
```

### Vorteile
- ✅ Keine Channel-Zuordnung nötig
- ✅ Schneller Test aller Streams
- ✅ Direkte Quality-Checks
- ✅ Bypassed Immunity

### Nachteile
- ⚠️ Limit auf 50 Streams
- ⚠️ Streams werden nicht Channels zugeordnet
- ⚠️ Kann lange dauern bei vielen Streams

---

## Button 2: Discover & Test 🔍🧪

### Funktion
Führt zuerst Stream Discovery aus, dann testet nur die zugeordneten Streams.

### Use Cases
- Provider testen nach automatischer Zuordnung
- Sicherstellen dass Discovery funktioniert
- Nur relevante Streams testen (die Channels zugeordnet wurden)

### Was passiert
1. Führt `discover_and_assign_streams()` aus
2. Ordnet Streams automatisch Channels zu
3. Findet alle Streams vom M3U Account die zugeordnet wurden
4. Queued betroffene Channels mit `force_check=True`
5. Stream Checker arbeitet Queue ab
6. Startet Stream Checker automatisch falls nicht läuft

### Backend API
```
POST /api/stream-checker/discover-and-test-m3u/<account_id>
```

**Response:**
```json
{
  "message": "Discovery completed. Queued 25 stream(s) from M3U account 5 for testing",
  "streams_found": 25,
  "channels_affected": 10,
  "status": "queued",
  "description": "Testing streams from 10 channel(s)"
}
```

### Vorteile
- ✅ Streams werden Channels zugeordnet
- ✅ Nur relevante Streams werden getestet
- ✅ Nutzt normale Stream Checker Queue
- ✅ Bypassed Immunity
- ✅ Kein Limit

### Nachteile
- ⚠️ Discovery kann lange dauern
- ⚠️ Nur Streams die Channels matchen werden getestet
- ⚠️ Asynchron (Queue-basiert)

---

## Vergleich

| Feature | Test All Streams 🧪 | Discover & Test 🔍🧪 |
|---------|---------------------|----------------------|
| Channel-Zuordnung | ❌ Nein | ✅ Ja |
| Discovery | ❌ Nein | ✅ Ja |
| Alle Streams | ✅ Ja (max 50) | ❌ Nur zugeordnete |
| Geschwindigkeit | ⚡ Schnell | 🐌 Langsam |
| Immunity | ❌ Bypassed | ❌ Bypassed |
| Stream Checker | ✅ Auto-Start | ✅ Auto-Start |
| Execution | 🔄 Synchron | ⏳ Asynchron (Queue) |

---

## Frontend Implementation

### Dashboard.jsx

**Neue Handler:**
```javascript
const handleTestAllM3uStreams = async (accountId, accountName) => {
  // Tests all streams directly
  const response = await streamCheckerAPI.testAllM3uStreams(accountId)
}

const handleDiscoverAndTestM3u = async (accountId, accountName) => {
  // Discovers then tests assigned streams
  const response = await streamCheckerAPI.discoverAndTestM3u(accountId)
}
```

**Buttons:**
```jsx
{/* Button 1: Test All Streams */}
<Button
  onClick={() => handleTestAllM3uStreams(playlist.id, playlist.name)}
  disabled={checkingM3uStats === `all-${playlist.id}`}
  title="Test ALL streams from this M3U account"
>
  <TestTube className="h-4 w-4" />
</Button>

{/* Button 2: Discover & Test */}
<Button
  onClick={() => handleDiscoverAndTestM3u(playlist.id, playlist.name)}
  disabled={checkingM3uStats === `discover-${playlist.id}`}
  title="Discover streams for channels, then test assigned streams"
>
  <Search className="h-3 w-3 mr-1" />
  <TestTube className="h-3 w-3" />
</Button>
```

---

## Backend Implementation

### web_api.py

**Endpoint 1: Test All Streams**
```python
@app.route('/api/stream-checker/test-all-m3u-streams/<int:account_id>', methods=['POST'])
def test_all_m3u_streams(account_id):
    # Get all streams from M3U account
    # Test each stream directly
    # Update stats in UDI
    # Return results
```

**Endpoint 2: Discover & Test**
```python
@app.route('/api/stream-checker/discover-and-test-m3u/<int:account_id>', methods=['POST'])
def discover_and_test_m3u(account_id):
    # Run stream discovery
    # Find assigned streams from M3U account
    # Queue channels for checking
    # Return status
```

---

## API Service

### frontend/src/services/api.js

```javascript
export const streamCheckerAPI = {
  // ... existing methods
  testAllM3uStreams: (accountId) => 
    api.post(`/stream-checker/test-all-m3u-streams/${accountId}`),
  discoverAndTestM3u: (accountId) => 
    api.post(`/stream-checker/discover-and-test-m3u/${accountId}`),
}
```

---

## Workflow Beispiele

### Szenario 1: Neuen Provider testen

1. M3U Account hinzufügen
2. **Test All Streams** Button klicken 🧪
3. Warten auf Ergebnis (synchron)
4. Stats in UDI prüfen
5. Entscheiden ob Provider gut ist

### Szenario 2: Provider nach Discovery testen

1. M3U Account hinzufügen
2. **Discover & Test** Button klicken 🔍🧪
3. Discovery läuft (ordnet Streams zu)
4. Streams werden in Queue eingereiht
5. Stream Checker arbeitet Queue ab
6. Channels haben jetzt getestete Streams

### Szenario 3: Provider-Qualität prüfen

1. Bestehender M3U Account
2. **Test All Streams** Button klicken 🧪
3. Alle Streams werden neu getestet
4. Stats werden aktualisiert
5. Schlechte Streams identifizieren

---

## Technische Details

### Immunity Bypass

Beide Buttons bypassen Stream Check Immunity:

**Test All Streams:**
- Testet direkt ohne Immunity-Check
- Kein `get_checked_stream_ids()` Call

**Discover & Test:**
- Nutzt `force_check=True` beim Queue
- Überschreibt Immunity in `queue_channel()`

### Stream Checker Auto-Start

Beide Buttons starten Stream Checker automatisch:

```python
service = get_stream_checker_service()
if not service.running:
    service.start()
    logger.info("Started stream checker service")
```

### Error Handling

**Test All Streams:**
- Fehler bei einzelnen Streams werden geloggt
- Andere Streams werden weiter getestet
- Ergebnis enthält success/failed/error Status

**Discover & Test:**
- Discovery-Fehler stoppt gesamten Prozess
- Queue-Fehler werden normal behandelt
- Asynchrone Fehler in Stream Checker Logs

---

## Installation

1. **Backend:** Bereits implementiert in `web_api.py`
2. **Frontend API:** Bereits implementiert in `api.js`
3. **Frontend UI:** Bereits implementiert in `Dashboard.jsx`

**Container neu bauen:**
```bash
cd frontend
npm run build
cd ..
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Testing

### Test All Streams Button
```bash
# Manuell testen
curl -X POST http://localhost:5002/api/stream-checker/test-all-m3u-streams/5

# Erwartete Response
{
  "message": "Tested 45 stream(s) from M3U account 5",
  "streams_found": 50,
  "streams_tested": 45,
  "status": "completed"
}
```

### Discover & Test Button
```bash
# Manuell testen
curl -X POST http://localhost:5002/api/stream-checker/discover-and-test-m3u/5

# Erwartete Response
{
  "message": "Discovery completed. Queued 25 stream(s)...",
  "streams_found": 25,
  "channels_affected": 10,
  "status": "queued"
}
```

---

## Troubleshooting

### Button disabled
- Prüfe ob `checkingM3uStats` State korrekt ist
- Browser Console für Fehler prüfen

### Keine Streams gefunden
- **Test All:** M3U Account hat keine Streams
- **Discover & Test:** Keine Streams wurden Channels zugeordnet

### Timeout
- **Test All:** Zu viele Streams (>50 Limit)
- **Discover & Test:** Discovery dauert zu lange

### Stream Checker startet nicht
- Prüfe Backend Logs
- Service könnte bereits laufen
- Permissions prüfen

---

## Zusammenfassung

**Zwei neue Buttons für M3U Account Testing:**

1. 🧪 **Test All Streams** - Schneller Test aller Streams ohne Channel-Zuordnung
2. 🔍🧪 **Discover & Test** - Discovery + Test nur zugeordneter Streams

**Beide:**
- Bypassen Stream Check Immunity
- Starten Stream Checker automatisch
- Funktionieren unabhängig vom Stream Checker Status

**Use Cases:**
- Neuen Provider testen
- Qualität prüfen
- Discovery validieren
- Streams neu bewerten

**Viel Erfolg!** 🎉
