# Priority Queue - UI Guide

## ✅ Frontend Implementation Complete

Das Priority-Feld wurde zur Channel Configuration hinzugefügt!

---

## Wo findet man es?

### Navigation
1. Öffne **Channel Configuration** Seite
2. Klicke auf **"Edit Regex"** bei einem Channel
3. Das Priority-Feld ist in den **Channel Settings** (4. Spalte)

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Channel Settings                                            │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ Stream       │ Quality      │ Quality      │ Check         │
│ Matching     │ Checking     │ Preference   │ Priority      │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ Enabled/     │ Enabled/     │ Default/     │ 0-100         │
│ Disabled     │ Disabled     │ Prefer 4K/   │ (Input)       │
│              │              │ etc.         │               │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

---

## Wie funktioniert es?

### Priority-Werte
- **0** = Höchste Priorität (wird zuerst geprüft)
- **50** = Standard-Priorität (Default)
- **100** = Niedrigste Priorität (wird zuletzt geprüft)

### Beispiel-Konfiguration

**Sport-Channels (wichtig):**
```
Sky Sport HD → Priority: 0
Sky Bundesliga → Priority: 5
DAZN → Priority: 10
```

**Nachrichten-Channels (mittel):**
```
ARD → Priority: 50
ZDF → Priority: 50
```

**Unwichtige Channels:**
```
Shopping Channel → Priority: 90
Teleshopping → Priority: 95
```

---

## Was passiert beim Stream Check?

### Ohne Priority Queue (vorher)
```
Check-Reihenfolge: Zufällig oder nach Channel-ID
1. Shopping Channel (unwichtig)
2. ARD (mittel)
3. Sky Sport HD (wichtig) ← Muss warten!
4. ZDF (mittel)
```

### Mit Priority Queue (jetzt)
```
Check-Reihenfolge: Nach Priority sortiert
1. Sky Sport HD (Priority: 0) ← Zuerst!
2. Sky Bundesliga (Priority: 5)
3. DAZN (Priority: 10)
4. ARD (Priority: 50)
5. ZDF (Priority: 50)
6. Shopping Channel (Priority: 90) ← Zuletzt
```

---

## UI-Features

### Input-Feld
```jsx
<Input
  type="number"
  min="0"
  max="100"
  value={channelSettings?.priority ?? 50}
  onChange={(e) => {
    const value = parseInt(e.target.value) || 50
    onUpdateSettings(channel.id, { 
      priority: Math.max(0, Math.min(100, value)) 
    })
  }}
/>
```

**Features:**
- ✅ Automatische Validierung (0-100)
- ✅ Default-Wert: 50
- ✅ Sofortiges Speichern beim Ändern
- ✅ Clamping (Werte außerhalb 0-100 werden korrigiert)

### Hilfetext
```
0 = highest priority, 100 = lowest (default: 50)
```

---

## Backend-Integration

### Noch zu tun
Die Priority Queue ist im Backend implementiert (`backend/priority_channel_queue.py`), aber noch nicht in den Stream Checker Service integriert.

**Nächste Schritte:**
1. ✅ Frontend UI (FERTIG)
2. ❌ Backend Integration in `stream_checker_service.py`
3. ❌ Priority-Feld in `channel_settings_manager.py` speichern

**Aufwand:** 1-2 Stunden

---

## Vorteile

### Bessere User-Experience
- ✅ Wichtige Channels werden zuerst geprüft
- ✅ Schnellere Feedback für wichtige Channels
- ✅ Bessere Kontrolle über Check-Reihenfolge

### Keine Performance-Einbußen
- ✅ Keine Zeitersparnis (gleiche Gesamtzeit)
- ✅ Aber: Wichtige Channels sind früher fertig
- ✅ Heap-basierte Queue (O(log n) Operations)

---

## Beispiel-Workflow

### 1. Channel konfigurieren
```
1. Öffne Channel Configuration
2. Klicke "Edit Regex" bei "Sky Sport HD"
3. Setze Priority auf 0
4. Speichern (automatisch)
```

### 2. Stream Check starten
```
1. Gehe zu Stream Checker
2. Klicke "Global Action"
3. Sky Sport HD wird zuerst geprüft!
```

### 3. Ergebnis
```
✅ Sky Sport HD: Fertig nach 2 Minuten
⏳ ARD: Noch in Queue (Priority: 50)
⏳ Shopping: Noch in Queue (Priority: 90)
```

---

## Tipps

### Empfohlene Priorities

**0-20: Sehr wichtig**
- Sport-Channels
- Premium-Channels
- Pay-TV

**21-40: Wichtig**
- Hauptsender (ARD, ZDF, RTL, etc.)
- Nachrichten-Channels

**41-60: Normal (Default)**
- Regionale Sender
- Spartensender

**61-80: Weniger wichtig**
- Shopping-Channels
- Musik-Channels

**81-100: Unwichtig**
- Test-Channels
- Backup-Channels

### Best Practices
1. Nicht alle Channels auf Priority 0 setzen (dann bringt es nichts)
2. Sinnvolle Abstufungen verwenden (0, 10, 20, 30, etc.)
3. Default (50) für die meisten Channels lassen
4. Nur wichtige Channels explizit priorisieren

---

## Troubleshooting

### Priority wird nicht gespeichert
- Prüfe Browser Console auf Fehler
- Prüfe ob `channel_settings_manager.py` das Priority-Feld unterstützt

### Priority hat keine Wirkung
- Backend-Integration fehlt noch
- Priority Queue muss in `stream_checker_service.py` integriert werden

### Alle Channels haben Priority 50
- Das ist normal (Default-Wert)
- Setze explizit andere Werte für wichtige Channels

---

**Erstellt:** 2026-03-02  
**Status:** Frontend Complete, Backend Integration ausstehend  
**Autor:** Kiro AI Assistant
