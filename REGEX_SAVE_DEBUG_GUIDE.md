# Regex Pattern Save - Debug Guide

## Problem
Regex Patterns werden nicht gespeichert.

## Debug Steps

### 1. Browser Console öffnen
- F12 drücken
- "Console" Tab öffnen

### 2. Pattern speichern versuchen
- Pattern eingeben
- "Add Pattern" oder "Update Pattern" klicken
- Console Logs prüfen

### 3. Was zu prüfen ist:

#### Console Logs:
```javascript
// Sollte erscheinen:
Saving pattern: {
  channel_id: 123,
  name: "Channel Name",
  regex: [{pattern: ".*test.*", m3u_accounts: null}],
  enabled: true
}

// Dann:
Save response: {data: {message: "Pattern added/updated successfully"}}
```

#### Mögliche Fehler:

**Error 1: "normalizePatternData is not defined"**
```
Solution: Function ist nach handleSavePattern definiert
```

**Error 2: "regex must be a list"**
```
Backend erwartet Array, bekommt aber etwas anderes
```

**Error 3: "Invalid regex pattern"**
```
Pattern ist ungültig (z.B. unescaped special characters)
```

**Error 4: Network Error**
```
Backend ist nicht erreichbar oder antwortet nicht
```

### 4. Backend Logs prüfen

```bash
# Docker Logs:
docker logs streamflow-backend

# Suche nach:
"Added/updated X pattern(s) for channel"
"Error adding regex pattern"
"Validation error adding regex pattern"
```

## Mögliche Ursachen

### 1. Format-Problem
**Symptom**: Pattern wird nicht gespeichert, keine Fehlermeldung

**Ursache**: Backend erwartet anderes Format

**Lösung**: 
```javascript
// Aktuelles Format (sollte funktionieren):
regex: [{pattern: ".*test.*", m3u_accounts: null}]

// Alternatives Format (falls nötig):
regex: [".*test.*"]
m3u_accounts: null  // Separates Feld
```

### 2. Reload-Problem
**Symptom**: Pattern wird gespeichert, aber UI zeigt es nicht

**Ursache**: `loadData()` lädt Patterns nicht korrekt

**Lösung**: 
- Browser Refresh (F5)
- Prüfe ob Pattern im Backend gespeichert wurde

### 3. State-Problem
**Symptom**: Pattern verschwindet nach Dialog schließen

**Ursache**: State wird nicht korrekt aktualisiert

**Lösung**:
- `handleCloseDialog()` wird zu früh aufgerufen
- `await loadData()` muss abgeschlossen sein

## Quick Fix

Falls nichts funktioniert, hier ist eine vereinfachte Version:

```javascript
const handleSavePattern = async () => {
  if (!newPattern.trim() || !editingChannelId) {
    toast({
      title: "Error",
      description: "Pattern cannot be empty",
      variant: "destructive"
    })
    return
  }

  try {
    const channelPatterns = patterns[editingChannelId] || patterns[String(editingChannelId)]
    const channel = channels.find(ch => ch.id === editingChannelId)
    
    // Get existing patterns as simple strings
    let existingPatterns = []
    if (channelPatterns?.regex) {
      existingPatterns = channelPatterns.regex
    } else if (channelPatterns?.regex_patterns) {
      existingPatterns = channelPatterns.regex_patterns.map(p => 
        typeof p === 'string' ? p : p.pattern
      )
    }
    
    // Update or add pattern
    let updatedPatterns = []
    if (editingPatternIndex !== null) {
      updatedPatterns = [...existingPatterns]
      updatedPatterns[editingPatternIndex] = newPattern
    } else {
      updatedPatterns = [...existingPatterns, newPattern]
    }

    // Send as simple string array
    await regexAPI.addPattern({
      channel_id: editingChannelId,
      name: channel?.name || '',
      regex: updatedPatterns,
      enabled: channelPatterns?.enabled !== false,
      m3u_accounts: selectedM3uAccounts.length > 0 ? selectedM3uAccounts : null
    })

    toast({
      title: "Success",
      description: editingPatternIndex !== null ? "Pattern updated successfully" : "Pattern added successfully"
    })

    await loadData()
    handleCloseDialog()
  } catch (err) {
    console.error('Save error:', err)
    toast({
      title: "Error",
      description: err.response?.data?.error || "Failed to save pattern",
      variant: "destructive"
    })
  }
}
```

## Testing

### Test 1: Add New Pattern
1. Channel auswählen
2. "Add Pattern" klicken
3. Pattern eingeben: `.*test.*`
4. "Add Pattern" klicken
5. Prüfen: Pattern erscheint in der Liste

### Test 2: Edit Existing Pattern
1. Pattern in Liste finden
2. Edit-Button klicken
3. Pattern ändern: `.*test2.*`
4. "Update Pattern" klicken
5. Prüfen: Pattern ist aktualisiert

### Test 3: With M3U Accounts
1. Pattern eingeben
2. M3U Account auswählen
3. "Add Pattern" klicken
4. Prüfen: Pattern mit Account-Filter gespeichert

## Workaround

Falls Save immer noch nicht funktioniert:

1. **Backend direkt testen**:
```bash
curl -X POST http://localhost:5000/api/regex-patterns \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": 123,
    "name": "Test Channel",
    "regex": [".*test.*"],
    "enabled": true
  }'
```

2. **Config-Datei direkt bearbeiten**:
```bash
# In Docker Container:
docker exec -it streamflow-backend bash
vi /app/data/channel_regex_config.json
```

3. **Frontend neu laden**:
```bash
# Clear Browser Cache
Ctrl+Shift+R (Hard Reload)
```

---

**Nächste Schritte**:
1. Console Logs prüfen
2. Backend Logs prüfen
3. Network Tab prüfen (F12 → Network)
4. Fehler hier posten für weitere Hilfe
