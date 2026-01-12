# Channel Quality Preferences Feature

## Übersicht

Dieses Feature erweitert StreamFlow um **kanalspezifische Qualitätspräferenzen**, die es ermöglichen, die automatische Stream-Qualitätsbewertung pro Kanal individuell anzupassen.

## Funktionalität

### Verfügbare Quality Preferences:

1. **Default** - Standard-Qualitätsbewertung (4K > Full HD > HD)
2. **Prefer 4K** - 4K-Streams erhalten zusätzliche Bonus-Punkte (+0.5)
3. **Avoid 4K** - 4K-Streams erhalten Malus-Punkte (-0.5), Full HD wird bevorzugt
4. **Max 1080p** - Streams über 1080p werden praktisch ausgeschlossen (-10.0 Punkte)
5. **Max 720p** - Streams über 720p werden praktisch ausgeschlossen (-10.0 Punkte)

### Anwendungsfälle:

- **Bandbreiten-Management**: Bewusst auf 4K verzichten um Bandbreite zu sparen
- **Kompatibilität**: Bestimmte Geräte unterstützen nur bis 1080p
- **Performance**: Schwächere Hardware kann 4K nicht flüssig wiedergeben
- **Präferenz**: Manche Kanäle sehen in 4K besser aus, andere nicht

## Technische Implementation

### Backend-Änderungen:

1. **ChannelSettingsManager** erweitert um `quality_preference` Feld
2. **Web API** erweitert um Quality Preference Validierung und Speicherung
3. **StreamCheckerService** erweitert um `_get_quality_preference_boost()` Methode
4. **Score-Berechnung** berücksichtigt jetzt Channel-spezifische Präferenzen

### Frontend-Änderungen:

1. **Channel Configuration UI** erweitert um Quality Preference Dropdown
2. **Group Inheritance** - Kanäle können Einstellungen von Gruppen erben
3. **Benutzerfreundliche Beschreibungen** für jede Präferenz-Option

### Vererbung:

Quality Preferences folgen der gleichen Vererbungslogik wie andere Channel Settings:
1. **Channel-spezifisch** (höchste Priorität)
2. **Group-Vererbung** (mittlere Priorität)  
3. **Default** (niedrigste Priorität)

## Verwendung

### In der UI:

1. Navigiere zu **Channel Configuration** (`/channels`)
2. Klicke auf **"Edit Regex"** bei einem Kanal
3. Im erweiterten Bereich findest du **"Quality Preference"**
4. Wähle die gewünschte Präferenz aus dem Dropdown

### Über API:

```bash
# Channel Quality Preference setzen
curl -X PUT http://localhost:8000/api/channel-settings/123 \
  -H "Content-Type: application/json" \
  -d '{"quality_preference": "avoid_4k"}'

# Group Quality Preference setzen (mit Vererbung)
curl -X PUT http://localhost:8000/api/group-settings/456 \
  -H "Content-Type: application/json" \
  -d '{"quality_preference": "max_1080p", "cascade_to_channels": true}'
```

## Auswirkungen auf Stream-Scoring

### Beispiel-Szenario:

**Kanal mit "avoid_4k" Präferenz:**
- 4K Stream (3840x2160): Basis-Score 0.85 → **Final-Score 0.35** (-0.5 Malus)
- Full HD Stream (1920x1080): Basis-Score 0.75 → **Final-Score 0.75** (unverändert)
- **Ergebnis**: Full HD wird bevorzugt trotz niedrigerem Basis-Score

**Kanal mit "prefer_4k" Präferenz:**
- 4K Stream (3840x2160): Basis-Score 0.85 → **Final-Score 1.35** (+0.5 Bonus)
- Full HD Stream (1920x1080): Basis-Score 0.75 → **Final-Score 0.75** (unverändert)
- **Ergebnis**: 4K wird noch stärker bevorzugt

## Kompatibilität

- **Rückwärtskompatibel**: Bestehende Kanäle verwenden automatisch "default" Präferenz
- **Bestehende Score-Logik**: Bleibt vollständig erhalten, wird nur erweitert
- **M3U Priority**: Funktioniert weiterhin parallel zu Quality Preferences

## Konfigurationsdateien

Quality Preferences werden gespeichert in:
- **Channel Settings**: `/app/data/channel_settings.json`
- **Group Settings**: `/app/data/group_settings.json`

## Logging

Quality Preference Anwendungen werden geloggt:
```
DEBUG: Applying 4K avoidance penalty (-0.5) to stream for channel 123
DEBUG: Applying max 1080p penalty (-10.0) to stream for channel 456
```

## Installation

1. Patch anwenden: `git apply streamflow_enhancements.patch`
2. Backend neu starten
3. Frontend neu builden
4. Feature ist sofort verfügbar

## Testen

Das Feature kann getestet werden durch:
1. Setzen verschiedener Quality Preferences für Test-Kanäle
2. Ausführen von Quality Checks
3. Überprüfen der Stream-Reihenfolge in der UI
4. Kontrolle der Log-Ausgaben für angewandte Präferenzen