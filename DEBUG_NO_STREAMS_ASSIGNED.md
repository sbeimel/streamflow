# Debug: "No streams from M3U account 262 were assigned to channels"

## Mögliche Ursachen

### 1. Regex-Patterns matchen nicht

**Symptom**: Stream-Namen passen zu keinem Channel-Pattern

**Prüfen**:
```
Logs suchen nach:
"Processing X streams across Y channels"
"Stream 'NAME' matched channel Z"
```

**Wenn keine Matches**:
- Stream-Namen passen nicht zu den Regex-Patterns
- Prüfe Channel-Regex-Config: `.kiro/channel_regex_config.json`
- Teste Patterns mit "Test Regex Live" Button

**Lösung**:
- Regex-Patterns anpassen
- M3U-Account-Filter in Patterns prüfen

### 2. M3U-Account ist nicht aktiviert

**Symptom**: Streams werden gefiltert

**Prüfen**:
```
Logs suchen nach:
"Filtered out X streams from disabled M3U accounts"
```

**Wenn gefiltert**:
- M3U-Account 262 ist nicht in `enabled_m3u_accounts` Config
- Oder Account ist `is_active=False`

**Lösung**:
```json
// config.ini oder Automation Settings
"enabled_m3u_accounts": [262, ...]
```

### 3. Streams sind bereits zugeordnet

**Symptom**: Discovery findet Matches, aber `add_streams_to_channel()` gibt 0 zurück

**Prüfen**:
```
Logs suchen nach:
"No new streams to add to channel X"
"Stream Y is already in channel X"
```

**Wenn bereits zugeordnet**:
- Streams sind schon in den Channels
- Discovery läuft korrekt, aber nichts Neues zu tun

**Lösung**:
- Das ist OK! Streams sind bereits da
- Prüfe in Dispatcharr UI, ob Streams in Channels sind

### 4. Channel-Matching ist deaktiviert

**Symptom**: Channels werden von Discovery ausgeschlossen

**Prüfen**:
```
Logs suchen nach:
"Excluding X channel(s) with matching disabled"
```

**Wenn ausgeschlossen**:
- Channels haben `matching_mode: disabled`
- Oder Channel-Group hat Matching disabled

**Lösung**:
- Channel Settings: Matching aktivieren
- Oder Group Settings: Matching aktivieren

### 5. Dead Stream Removal aktiv

**Symptom**: Streams werden als tot erkannt und nicht zugeordnet

**Prüfen**:
```
Logs suchen nach:
"Skipping dead stream X"
"Filtered out X dead stream(s)"
```

**Wenn gefiltert**:
- Streams sind im Dead Streams Tracker
- Dead Stream Removal ist aktiviert

**Lösung**:
- Dead Streams Tracker leeren
- Oder Dead Stream Removal temporär deaktivieren

## Debug-Schritte

### Schritt 1: Prüfe M3U-Account Status

```bash
# In Dispatcharr UI:
1. Gehe zu M3U Accounts
2. Finde Account 262
3. Prüfe:
   - is_active: true?
   - Anzahl Streams?
   - Name?
```

### Schritt 2: Prüfe Automation Settings

```bash
# In Automation Settings:
1. Gehe zu "Enabled M3U Accounts"
2. Ist Account 262 in der Liste?
3. Wenn nicht: Hinzufügen
```

### Schritt 3: Prüfe Regex-Patterns

```bash
# In Channel Configuration:
1. Wähle einen Channel
2. Prüfe Regex-Patterns
3. Teste mit "Test Regex Live"
4. Gib Stream-Namen von Account 262 ein
5. Matcht es?
```

### Schritt 4: Prüfe Logs detailliert

```bash
# Suche in Logs nach:
grep "M3U account 262" logs.txt
grep "Filtered out" logs.txt
grep "matched channel" logs.txt
grep "No new streams" logs.txt
```

### Schritt 5: Test mit einzelnem Stream

```bash
# API-Call:
POST /api/test-regex-live
{
  "patterns": [
    {
      "channel_id": "123",
      "regex": ["Sky.*Sport"]
    }
  ],
  "m3u_accounts": [262]
}

# Prüfe Response:
# Werden Streams von Account 262 gematcht?
```

## Häufigste Ursache

**90% der Fälle**: Regex-Patterns matchen nicht!

**Beispiel**:
```
Stream-Name: "VIP SPORT: SKY SPORTS MAIN EVENT (UK)"
Pattern: "Sky Sport.*"  ← MATCHT NICHT! (case-sensitive, Leerzeichen)
```

**Lösung**:
```
Pattern: "(?i)Sky.*Sport.*"  ← MATCHT! (case-insensitive, flexible)
```

## Quick Fix

Wenn du schnell testen willst, ob Account 262 grundsätzlich funktioniert:

1. **Erstelle Test-Channel**:
   - Name: "Test 262"
   - Regex: `.*` (matcht ALLES)
   - M3U Accounts: [262]

2. **Run Discovery**

3. **Erwartung**: ALLE Streams von Account 262 werden zugeordnet

4. **Wenn ja**: Regex-Problem! Patterns anpassen
5. **Wenn nein**: Account-Problem! Config prüfen

## Logs analysieren

Bitte zeige mir die vollständigen Logs von:

```
"Starting stream discovery and assignment..."
bis
"Stream discovery completed"
```

Dann kann ich dir genau sagen, was das Problem ist!

Besonders wichtig:
- `"Processing X streams across Y channels"`
- `"Filtered out X streams from disabled M3U accounts"`
- `"Excluding X channel(s) with matching disabled"`
- `"Stream 'NAME' matched channel Z"`
- `"Added X new streams to channel Y"`
