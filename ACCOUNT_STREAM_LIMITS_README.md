# Account Stream Limits Feature

## Übersicht

Dieses Feature erweitert StreamFlow um **Account Stream Limits für Channel-Assignment**, die es ermöglichen, die Anzahl der Streams **pro M3U Account pro Channel** zu begrenzen, die bei der automatischen Kanalzuweisung berücksichtigt werden.

## Funktionalität

### Verfügbare Limit-Optionen:

1. **Global Limit** - Globales Limit für alle M3U Accounts **pro Channel** (0 = unbegrenzt)
2. **Per-Account Limits** - Spezifische Limits für einzelne M3U Accounts **pro Channel** (überschreibt das globale Limit)
3. **Enable/Disable** - Komplette Aktivierung/Deaktivierung der Limit-Funktion

### ⚠️ **WICHTIG: Pro-Channel Zählung**

Die Limits gelten **pro Channel**, nicht global über alle Channels!

**Beispiel mit Global Limit = 2:**
- **3 M3U Accounts** mit je Global Limit = 2
- **Channel A**: Account 1 (2 Streams), Account 2 (2 Streams), Account 3 (2 Streams) = **6 Streams**
- **Channel B**: Account 1 (2 Streams), Account 2 (2 Streams), Account 3 (2 Streams) = **6 Streams**  
- **Channel C**: Account 1 (2 Streams), Account 2 (2 Streams), Account 3 (2 Streams) = **6 Streams**
- **Total**: **18 Streams** (6 pro Channel)

### Anwendungsfälle:

- **Bandbreiten-Management**: Begrenzen der Streams von hochauflösenden Accounts pro Channel
- **Kosten-Kontrolle**: Limitieren teurer Premium-Accounts pro Channel
- **Load Balancing**: Gleichmäßige Verteilung zwischen verschiedenen Providern pro Channel
- **Testing**: Begrenzen von Test-Accounts während der Evaluierung pro Channel
- **Quality Control**: Bevorzugung bestimmter Provider durch Limitierung anderer pro Channel
- **Provider-Gewichtung**: Premium-Provider bekommen mehr Streams pro Channel als Standard-Provider
- **Redundanz-Management**: Backup-Provider bekommen weniger Streams, Haupt-Provider mehr

## Per-M3U Account Limits

### Ja, du kannst für jeden M3U Account individuelle Limits **pro Channel** setzen!

In der **Stream Checker Configuration** → **Account Limits** Tab kannst du:

1. **Globales Limit** setzen (gilt für alle Accounts **pro Channel**)
2. **Per-Account Limits** hinzufügen mit "Add Account Limit"
3. **M3U Account ID** eingeben (findest du in der M3U Accounts Sektion)
4. **Individuelles Limit** pro Account **pro Channel** setzen

### Beispiel-Konfiguration:
- **Global Limit**: 2 Streams **pro Channel**
- **Account 123**: 5 Streams **pro Channel** (Premium Provider)
- **Account 456**: 1 Stream **pro Channel** (Test Account)  
- **Account 789**: 0 Streams **pro Channel** (Unbegrenzt)

**Ergebnis bei 10 Channels:**
- **Account 123**: Maximal 50 Streams total (5 pro Channel × 10 Channels)
- **Account 456**: Maximal 10 Streams total (1 pro Channel × 10 Channels)
- **Account 789**: Unbegrenzt
- **Andere Accounts**: Maximal 20 Streams total (2 pro Channel × 10 Channels)

### Individuelle Gewichtung Beispiel:
**Konfiguration für unterschiedliche Provider-Qualität:**
- **Account A (Premium)**: 3 Streams pro Channel
- **Account B (Standard)**: 2 Streams pro Channel  
- **Account C (Backup)**: 2 Streams pro Channel
- **Global Limit**: 1 Stream pro Channel (für alle anderen)

**Ergebnis pro Channel:**
- Jeder Channel bekommt maximal: 3 + 2 + 2 + X = **7+ Streams**
- **Account A**: Liefert die meisten Streams (Premium-Qualität)
- **Account B & C**: Mittlere Anzahl (Standard-Provider)
- **Andere Accounts**: Nur 1 Stream pro Channel (Fallback)

## Technische Implementation

### Backend-Änderungen:

1. **StreamCheckConfig** erweitert um `account_stream_limits` Sektion
2. **AutomatedStreamManager** erweitert um `_apply_account_stream_limits()` Methode
3. **Web API** erweitert um Validierung der Account Limits Konfiguration
4. **Channel Assignment** berücksichtigt jetzt Account-spezifische Limits

### Frontend-Änderungen:

1. **Stream Checker Configuration** erweitert um "Account Limits" Tab
2. **Benutzerfreundliche UI** für Global- und Per-Account-Limits
3. **Dynamisches Hinzufügen/Entfernen** von Account-spezifischen Limits
4. **Informative Hilfe-Texte** und Erklärungen

### Limit-Logik:

1. **Priorität**: Per-Account Limits > Global Limit > Unbegrenzt
2. **Custom Streams**: Werden nicht von Limits betroffen (haben keine M3U Account ID)
3. **Zählung**: Limits gelten account-übergreifend über alle Kanäle
4. **Reihenfolge**: First-come-first-served Basis bei der Stream-Zuweisung

## Verwendung

### In der UI:

1. Navigiere zu **Stream Checker** (`/stream-checker`)
2. Scrolle zu **"Stream Checker Configuration"**
3. Klicke auf **"Edit"**
4. Wähle den **"Account Limits"** Tab
5. Aktiviere **"Enable Account Stream Limits"**
6. Setze **Global Limit** (0 = unbegrenzt)
7. Füge **Per-Account Limits** hinzu mit "Add Account Limit"
8. Gib die **M3U Account ID** ein
9. Setze das **individuelle Limit** für diesen Account

### Über API:

```bash
# Account Stream Limits konfigurieren
curl -X PUT http://localhost:8000/api/stream-checker/config \
  -H "Content-Type: application/json" \
  -d '{
    "account_stream_limits": {
      "enabled": true,
      "global_limit": 50,
      "account_limits": {
        "123": 100,
        "456": 25,
        "789": 0
      }
    }
  }'
```

## Konfigurationsbeispiele

### Beispiel 1: Nur Globales Limit
```json
{
  "account_stream_limits": {
    "enabled": true,
    "global_limit": 2,
    "account_limits": {}
  }
}
```
**Ergebnis**: Alle M3U Accounts sind auf maximal 2 Streams **pro Channel** begrenzt.
**Bei 10 Channels**: Maximal 20 Streams pro Account total.

### Beispiel 2: Gemischte Limits (Empfohlen)
```json
{
  "account_stream_limits": {
    "enabled": true,
    "global_limit": 2,
    "account_limits": {
      "1": 5,
      "2": 1,
      "3": 0
    }
  }
}
```
**Ergebnis pro Channel**: 
- **Account 1**: 5 Streams pro Channel (Premium Provider)
- **Account 2**: 1 Stream pro Channel (Test Account)
- **Account 3**: Unbegrenzt pro Channel (Hauptprovider)
- **Alle anderen**: 2 Streams pro Channel (Standard)

**Bei 10 Channels total**:
- **Account 1**: Maximal 50 Streams total (5 × 10)
- **Account 2**: Maximal 10 Streams total (1 × 10)
- **Account 3**: Unbegrenzt
- **Andere**: Maximal 20 Streams total (2 × 10)

## Auswirkungen auf Stream Assignment

### Vor der Implementierung:
```
Channel A: Account 1 (alle verfügbaren), Account 2 (alle verfügbaren), Account 3 (alle verfügbaren)
Channel B: Account 1 (alle verfügbaren), Account 2 (alle verfügbaren), Account 3 (alle verfügbaren)
Channel C: Account 1 (alle verfügbaren), Account 2 (alle verfügbaren), Account 3 (alle verfügbaren)
```

### Nach der Implementierung (Global Limit: 2 pro Channel):
```
Channel A: Account 1 (max 2), Account 2 (max 2), Account 3 (max 2) = max 6 Streams
Channel B: Account 1 (max 2), Account 2 (max 2), Account 3 (max 2) = max 6 Streams  
Channel C: Account 1 (max 2), Account 2 (max 2), Account 3 (max 2) = max 6 Streams
Total: max 18 Streams (6 pro Channel)
```

### Mit Per-Account Limits (Account 1: 5, Account 2: 1, Account 3: unbegrenzt):
```
Channel A: Account 1 (max 5), Account 2 (max 1), Account 3 (unbegrenzt)
Channel B: Account 1 (max 5), Account 2 (max 1), Account 3 (unbegrenzt)
Channel C: Account 1 (max 5), Account 2 (max 1), Account 3 (unbegrenzt)
```

## Logging

Account Stream Limits werden detailliert geloggt:
```
INFO: Applying account stream limits to channel assignments (per-channel counting)...
INFO: Applied per-channel account stream limits: 45 streams were excluded from assignment across 15 channels
DEBUG: Channel 123 account limits applied:
DEBUG:   Account 1: 2/2 streams assigned
DEBUG:   Account 2: 2/2 streams assigned
DEBUG:   Account 3: 5/5 streams assigned
DEBUG: Stream 12345 from account 1 exceeds per-channel limit (2) for channel 123
```

## Installation

1. Patch anwenden: `git apply streamflow_enhancements.patch`
2. Backend neu starten
3. Frontend neu builden
4. Feature ist sofort in Stream Checker Configuration verfügbar

## Testen

Das Feature kann getestet werden durch:
1. Setzen verschiedener Account Limits in Stream Checker Configuration
2. **Beispiel-Setup für Provider-Gewichtung:**
   - Account A (Premium): 3 Streams pro Channel
   - Account B (Standard): 2 Streams pro Channel
   - Account C (Backup): 1 Stream pro Channel
3. Ausführen von Stream Discovery (Quick Action: "Discover Streams")
4. Überprüfen der Log-Ausgaben für angewandte Limits
5. Kontrolle der tatsächlich zugewiesenen Stream-Anzahl pro Account pro Channel
6. **Verifikation**: Jeder Channel sollte maximal 3+2+1=6 Streams von diesen Accounts bekommen