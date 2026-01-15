# Provider Diversification Feature

## Übersicht

Provider-Diversifikation sorgt für bessere Redundanz, indem Streams von verschiedenen Providern (M3U-Accounts) abwechselnd angeordnet werden, anstatt alle Streams vom besten Provider zu gruppieren.

**Zwei Modi verfügbar:**
- **Round Robin:** Alphabetische Provider-Reihenfolge (einfach)
- **Priority Weighted:** M3U-Prioritäts-basierte Provider-Reihenfolge (respektiert Prioritäten)

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

### Modus 1: Round Robin (Alphabetisch)

```
Kanal: ARD

Nach Quality Check + Round Robin Diversifikation:
1. Provider A - Score 0.95 ⭐⭐⭐ (bester von A)
2. Provider B - Score 0.92 ⭐⭐ (bester von B)
3. Provider C - Score 0.89 ⭐ (bester von C)
4. Provider A - Score 0.94 ⭐⭐⭐ (zweitbester von A)
5. Provider B - Score 0.91 ⭐⭐ (zweitbester von B)
6. Provider C - Score 0.88 ⭐ (zweitbester von C)
```

**Vorteil:** Einfache alphabetische Rotation, wenn Provider A ausfällt → Provider B übernimmt sofort!

### Modus 2: Priority Weighted (M3U-Prioritäten)

```
Kanal: ARD

Provider-Prioritäten:
- Premium Provider (Prio: 100) → Score-Boost: +50.0
- Basic Provider (Prio: 10) → Score-Boost: +5.0

Nach Quality Check + Priority Boost + Priority Weighted Diversifikation:
1. Premium A - Score 50.95 (0.95 + 50.0) ⭐⭐⭐ (bester Premium)
2. Basic A - Score 5.92 (0.92 + 5.0) ⭐⭐ (bester Basic)
3. Premium B - Score 50.94 (0.94 + 50.0) ⭐⭐⭐ (zweitbester Premium)
4. Basic B - Score 5.91 (0.91 + 5.0) ⭐⭐ (zweitbester Basic)
5. Premium C - Score 50.93 (0.93 + 50.0) ⭐⭐⭐ (drittbester Premium)
```

**Vorteil:** Respektiert M3U-Prioritäten UND sorgt für Diversifikation!

## Funktionsweise

### Modus 1: Round Robin (Alphabetisch)

1. **Gruppierung:** Streams werden nach Provider (M3U-Account) gruppiert
2. **Sortierung:** Innerhalb jeder Provider-Gruppe nach Score sortiert
3. **Provider-Sortierung:** Provider alphabetisch sortiert (A → B → C)
4. **Interleaving:** Streams werden abwechselnd aus jeder Gruppe genommen:
   - Runde 1: Bester Stream von A, B, C
   - Runde 2: Zweitbester Stream von A, B, C
   - Runde 3: Drittbester Stream von A, B, C

### Modus 2: Priority Weighted (M3U-Prioritäten)

1. **Gruppierung:** Streams werden nach Provider (M3U-Account) gruppiert
2. **Sortierung:** Innerhalb jeder Provider-Gruppe nach Score sortiert
3. **Provider-Sortierung:** Provider nach M3U-Priorität sortiert (höchste zuerst)
4. **Interleaving:** Streams werden abwechselnd aus jeder Gruppe genommen:
   - Runde 1: Bester Stream von Premium(100), Basic(10)
   - Runde 2: Zweitbester Stream von Premium(100), Basic(10)
   - Runde 3: Drittbester Stream von Premium(100), Basic(10)

### Pseudo-Code:

```python
def apply_provider_diversification(streams, mode='round_robin'):
    # 1. Gruppiere nach Provider
    provider_groups = group_by_provider(streams)
    
    if mode == 'priority_weighted':
        # 2a. Sortiere Provider nach M3U-Priorität
        sorted_providers = sort_by_priority(provider_groups)
    else:
        # 2b. Sortiere Provider alphabetisch
        sorted_providers = sort_alphabetically(provider_groups)
    
    # 3. Round-Robin Interleaving
    result = []
    for round in range(max_streams_per_provider):
        for provider in sorted_providers:
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
| `diversification_mode` | String | `"round_robin"` | Modus: `"round_robin"` (alphabetisch) oder `"priority_weighted"` (M3U-Prioritäten) |

### Modi im Detail:

#### Round Robin Mode (`"round_robin"`)
- **Verwendung:** Einfache, gleichmäßige Verteilung
- **Provider-Reihenfolge:** Alphabetisch (A → B → C)
- **Vorteil:** Einfach, vorhersagbar
- **Ideal für:** Setups ohne klare Provider-Hierarchie

#### Priority Weighted Mode (`"priority_weighted"`)
- **Verwendung:** Respektiert M3U-Account-Prioritäten
- **Provider-Reihenfolge:** Nach M3U-Priorität (100 → 50 → 10)
- **Vorteil:** Kombiniert Diversifikation mit Prioritäten
- **Ideal für:** Premium/Basic Provider-Setups

### UI-Einstellung

**Location:** Stream Checker Seite → "Stream Ordering" Sektion

```jsx
<Card>
  <CardHeader>
    <CardTitle>Provider Diversification</CardTitle>
    <CardDescription>
      Interleave streams from different providers for better redundancy and failover
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Enable/Disable Switch */}
    <div className="flex items-center justify-between">
      <div>
        <Label>Enable Provider Diversification</Label>
        <p className="text-sm text-muted-foreground">
          Distribute streams from different providers evenly instead of grouping by quality
        </p>
      </div>
      <Switch
        checked={config.stream_ordering?.provider_diversification ?? false}
        onCheckedChange={(checked) => updateConfig('stream_ordering.provider_diversification', checked)}
      />
    </div>
    
    {/* Mode Selection (when enabled) */}
    {config.stream_ordering?.provider_diversification && (
      <div className="space-y-3">
        <Label>Diversification Mode</Label>
        
        <div className="flex items-center space-x-2">
          <input type="radio" value="round_robin" 
                 checked={config.stream_ordering?.diversification_mode === 'round_robin'} />
          <Label>Round Robin (Alphabetical)</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input type="radio" value="priority_weighted"
                 checked={config.stream_ordering?.diversification_mode === 'priority_weighted'} />
          <Label>Priority Weighted</Label>
        </div>
      </div>
    )}
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

### Szenario 1: Round Robin Mode (Gleichmäßige Verteilung)

```
Input (3 Provider, je 3 Streams):
Provider A: [0.95, 0.94, 0.93]
Provider B: [0.92, 0.91, 0.90]
Provider C: [0.89, 0.88, 0.87]

Provider-Reihenfolge: A → B → C (alphabetisch)

Output:
[A:0.95, B:0.92, C:0.89, A:0.94, B:0.91, C:0.88, A:0.93, B:0.90, C:0.87]
```

### Szenario 2: Priority Weighted Mode (M3U-Prioritäten)

```
Input (3 Provider mit Prioritäten):
Premium Provider (Prio: 100): [50.95, 50.94, 50.93]  # Scores mit Priority Boost
Basic Provider A (Prio: 10): [5.92, 5.91, 5.90]
Basic Provider B (Prio: 10): [5.89, 5.88, 5.87]

Provider-Reihenfolge: Premium(100) → Basic A(10) → Basic B(10) (nach Priorität)

Output:
[Premium:50.95, BasicA:5.92, BasicB:5.89, Premium:50.94, BasicA:5.91, BasicB:5.88, ...]
```

### Szenario 3: Ungleiche Verteilung

```
Input (3 Provider, unterschiedliche Anzahl):
Provider A: [0.95, 0.94]
Provider B: [0.92, 0.91, 0.90, 0.89]
Provider C: [0.88]

Round Robin Output:
[A:0.95, B:0.92, C:0.88, A:0.94, B:0.91, B:0.90, B:0.89]

Priority Weighted Output (A=100, B=50, C=10):
[A:50.95, B:25.92, C:5.88, A:50.94, B:25.91, B:25.90, B:25.89]
```

### Szenario 4: Mit Account-Limits

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

### Q: Was ist der Unterschied zwischen den Modi?
**A:** 
- **Round Robin:** Einfache alphabetische Provider-Rotation (A → B → C)
- **Priority Weighted:** Respektiert M3U-Prioritäten (Premium → Basic)

### Q: Welchen Modus soll ich wählen?
**A:**
- **Round Robin:** Wenn alle Provider gleichwertig sind
- **Priority Weighted:** Wenn Sie Premium/Basic Provider haben und Prioritäten respektieren möchten

### Q: Was passiert bei nur einem Provider?
**A:** Die Diversifikation wird übersprungen, normale Score-Sortierung wird verwendet.

### Q: Funktioniert das mit Custom Streams?
**A:** Ja, Custom Streams (ohne Provider) werden ans Ende sortiert.

### Q: Kann ich das pro Kanal konfigurieren?
**A:** Aktuell nur global. Pro-Kanal-Konfiguration könnte in Zukunft hinzugefügt werden.

### Q: Beeinflusst das die Performance?
**A:** Minimal. Der Overhead beträgt ~1-2ms pro Kanal.

### Q: Funktioniert Priority Weighted mit M3U Account Priority System?
**A:** Ja! Das M3U Account Priority System boostet die Scores, dann sortiert Priority Weighted die Provider nach ihren M3U-Prioritäten für die Diversifikation.

## Version

- **Feature:** Provider Diversification
- **Version:** 1.0
- **Datum:** 2026-01-14
- **Kompatibilität:** StreamFlow v1.0+
