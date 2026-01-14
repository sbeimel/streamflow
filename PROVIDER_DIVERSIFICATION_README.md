# Provider Diversification Feature

## Übersicht

Provider-Diversifikation sorgt für bessere Redundanz, indem Streams von verschiedenen Providern (M3U-Accounts) abwechselnd angeordnet werden, anstatt alle Streams vom besten Provider zu gruppieren.

## Problem

### Standard-Sortierung (nur nach Qualität):

```
Kanal: ARD

Nach Quality Check:
1. Provider A - Score 0.95 ⭐⭐⭐
2. Provider A - Score 0.94 ⭐⭐⭐
3. Provider A - Score 0.93 ⭐⭐⭐
4. Provider B - Score 0.92 ⭐⭐
5. Provider B - Score 0.91 ⭐⭐
6. Provider B - Score 0.90 ⭐⭐
7. Provider C - Score 0.89 ⭐
8. Provider C - Score 0.88 ⭐
9. Provider C - Score 0.87 ⭐
```

**Problem:** Wenn Provider A ausfällt → Die ersten 3 Streams sind tot!

## Lösung: Provider-Diversifikation

### Mit aktivierter Diversifikation:

```
Kanal: ARD

Nach Quality Check + Diversifikation:
1. Provider A - Score 0.95 ⭐⭐⭐ (bester von A)
2. Provider B - Score 0.92 ⭐⭐ (bester von B)
3. Provider C - Score 0.89 ⭐ (bester von C)
4. Provider A - Score 0.94 ⭐⭐⭐ (zweitbester von A)
5. Provider B - Score 0.91 ⭐⭐ (zweitbester von B)
6. Provider C - Score 0.88 ⭐ (zweitbester von C)
7. Provider A - Score 0.93 ⭐⭐⭐ (drittbester von A)
8. Provider B - Score 0.90 ⭐⭐ (drittbester von B)
9. Provider C - Score 0.87 ⭐ (drittbester von C)
```

**Vorteil:** Wenn Provider A ausfällt → Provider B übernimmt sofort bei Stream 2!

## Funktionsweise

### Round-Robin Algorithmus:

1. **Gruppierung:** Streams werden nach Provider (M3U-Account) gruppiert
2. **Sortierung:** Innerhalb jeder Provider-Gruppe nach Score sortiert
3. **Interleaving:** Streams werden abwechselnd aus jeder Gruppe genommen:
   - Runde 1: Bester Stream von A, B, C
   - Runde 2: Zweitbester Stream von A, B, C
   - Runde 3: Drittbester Stream von A, B, C
   - usw.

### Pseudo-Code:

```python
def apply_provider_diversification(streams):
    # 1. Gruppiere nach Provider
    provider_groups = {
        'Provider A': [stream1, stream2, stream3],  # sortiert nach Score
        'Provider B': [stream4, stream5, stream6],
        'Provider C': [stream7, stream8, stream9]
    }
    
    # 2. Round-Robin Interleaving
    result = []
    for round in range(max_streams_per_provider):
        for provider in providers:
            if provider has stream at round:
                result.append(provider.streams[round])
    
    return result
```

## Konfiguration

### Backend-Konfiguration

**Datei:** `stream_checker_config.json`

```json
{
  "stream_ordering": {
    "provider_diversification": true,
    "diversification_mode": "round_robin"
  }
}
```

### Optionen:

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `provider_diversification` | Boolean | `false` | Aktiviert/deaktiviert Provider-Diversifikation |
| `diversification_mode` | String | `"round_robin"` | Modus: `"round_robin"` oder `"weighted"` (zukünftig) |

### UI-Einstellung

**Location:** Stream Checker Seite → "Stream Ordering" Sektion

```jsx
<Card>
  <CardHeader>
    <CardTitle>Stream Ordering</CardTitle>
    <CardDescription>
      Configure how streams are ordered within channels
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <div>
        <Label>Provider Diversification</Label>
        <p className="text-sm text-muted-foreground">
          Interleave streams from different providers for better redundancy
        </p>
      </div>
      <Switch
        checked={config.stream_ordering?.provider_diversification ?? false}
        onCheckedChange={(checked) => updateConfig('stream_ordering.provider_diversification', checked)}
      />
    </div>
  </CardContent>
</Card>
```

## Vorteile

### ✅ Bessere Redundanz
- Automatisches Failover zu anderen Providern
- Kein Single Point of Failure

### ✅ Lastverteilung
- Verteilt Last auf mehrere Provider
- Verhindert Überlastung einzelner Provider

### ✅ Verbesserte Zuverlässigkeit
- Ausfall eines Providers betrifft nicht alle Top-Streams
- Schnelleres Failover bei Provider-Problemen

### ✅ Transparent
- Funktioniert mit bestehendem Quality Scoring
- Keine Änderung an Score-Berechnung

### ✅ Optional
- Kann jederzeit aktiviert/deaktiviert werden
- Standard: deaktiviert (abwärtskompatibel)

## Anwendungsfälle

### 1. Multi-Provider Setup
```
Szenario: 3 IPTV-Provider (A, B, C)
Problem: Provider A hat beste Qualität, aber manchmal Ausfälle
Lösung: Diversifikation aktivieren → Bei Ausfall von A springt B ein
```

### 2. Geo-Redundanz
```
Szenario: Provider aus verschiedenen Ländern
Problem: Lokale Netzwerkprobleme betreffen einen Provider
Lösung: Diversifikation sorgt für geografische Verteilung
```

### 3. Load Balancing
```
Szenario: Viele gleichzeitige Zuschauer
Problem: Ein Provider wird überlastet
Lösung: Last wird automatisch auf mehrere Provider verteilt
```

## Logging

### Erfolgreiche Diversifikation:
```
INFO - Channel 123 (ARD): Applied provider diversification - 3 providers interleaved
```

### Übersprungen (nur 1 Provider):
```
DEBUG - Channel 456 (ZDF): Only 1 provider(s), skipping diversification
```

### Übersprungen (keine Provider-Info):
```
DEBUG - Channel 789 (RTL): No provider information available, skipping diversification
```

## Kompatibilität

### ✅ Funktioniert mit:
- Account Stream Limits
- Dead Stream Removal
- Quality Scoring
- M3U Account Priorities
- Channel Quality Preferences
- Alle Automation Modi

### ⚠️ Hinweise:
- Benötigt mindestens 2 verschiedene Provider pro Kanal
- Streams ohne Provider-Info (Custom Streams) werden ans Ende sortiert
- Funktioniert nur bei aktiviertem Quality Checking

## Technische Details

### Implementierung

**Datei:** `backend/stream_checker_service.py`

**Methode:** `_apply_provider_diversification(analyzed_streams, channel_id)`

**Aufgerufen in:**
1. `_check_channel_concurrent()` - Nach Score-Sortierung
2. `_check_channel_sequential()` - Nach Score-Sortierung
3. `apply_account_limits_to_existing_channels()` - Nach Score-Sortierung

### Ablauf:

```
1. Quality Check
   ↓
2. Streams nach Score sortieren
   ↓
3. Provider-Diversifikation anwenden (wenn aktiviert)
   ↓
4. Account-Limits anwenden
   ↓
5. Tote Streams entfernen
   ↓
6. Kanal aktualisieren
```

### Performance:

- **Zeitkomplexität:** O(n) - Linear mit Anzahl Streams
- **Speicherkomplexität:** O(n) - Temporäre Gruppierung
- **Overhead:** Minimal (~1-2ms pro Kanal)

## Beispiel-Szenarien

### Szenario 1: Gleichmäßige Verteilung

```
Input (3 Provider, je 3 Streams):
Provider A: [0.95, 0.94, 0.93]
Provider B: [0.92, 0.91, 0.90]
Provider C: [0.89, 0.88, 0.87]

Output:
[A:0.95, B:0.92, C:0.89, A:0.94, B:0.91, C:0.88, A:0.93, B:0.90, C:0.87]
```

### Szenario 2: Ungleiche Verteilung

```
Input (3 Provider, unterschiedliche Anzahl):
Provider A: [0.95, 0.94]
Provider B: [0.92, 0.91, 0.90, 0.89]
Provider C: [0.88]

Output:
[A:0.95, B:0.92, C:0.88, A:0.94, B:0.91, B:0.90, B:0.89]
```

### Szenario 3: Mit Account-Limits

```
Input (3 Provider, je 3 Streams, Limit: 2 pro Provider):
Provider A: [0.95, 0.94, 0.93]
Provider B: [0.92, 0.91, 0.90]
Provider C: [0.89, 0.88, 0.87]

Nach Diversifikation:
[A:0.95, B:0.92, C:0.89, A:0.94, B:0.91, C:0.88, A:0.93, B:0.90, C:0.87]

Nach Account-Limits (2 pro Provider):
[A:0.95, B:0.92, C:0.89, A:0.94, B:0.91, C:0.88]
```

## FAQ

### Q: Wird die Qualität schlechter?
**A:** Nein! Der erste Stream ist immer noch der beste verfügbare. Die Diversifikation ändert nur die Reihenfolge der nachfolgenden Streams.

### Q: Was passiert bei nur einem Provider?
**A:** Die Diversifikation wird übersprungen, normale Score-Sortierung wird verwendet.

### Q: Funktioniert das mit Custom Streams?
**A:** Ja, Custom Streams (ohne Provider) werden ans Ende sortiert.

### Q: Kann ich das pro Kanal konfigurieren?
**A:** Aktuell nur global. Pro-Kanal-Konfiguration könnte in Zukunft hinzugefügt werden.

### Q: Beeinflusst das die Performance?
**A:** Minimal. Der Overhead beträgt ~1-2ms pro Kanal.

## Version

- **Feature:** Provider Diversification
- **Version:** 1.0
- **Datum:** 2026-01-14
- **Kompatibilität:** StreamFlow v1.0+
