# Discover Streams Force Check Fix

## Problem

Der "Discover Streams" Button hatte eine Inkonsistenz mit anderen manuellen Aktionen:

- ✅ **Andere manuelle Aktionen** (Test Streams Without Stats, Global Action, Rescore & Resort) verwenden `force_check=True` und umgehen die 2-hour immunity
- ❌ **"Discover Streams"** verwendete normale `mark_channels_updated()` ohne `force_check=True`

## Auswirkung

Wenn "Discover Streams" geklickt wurde und Channels in den letzten 2 Stunden geprüft wurden:
- ✅ Neue Streams wurden korrekt zugeordnet
- ❌ **Quality Check wurde übersprungen** (wegen 2-hour immunity)
- ❌ **Kein Rescoring/Reordering**
- ❌ **Keine Provider Limits angewendet**

## Lösung

### 1. Erweiterte `mark_channels_updated()` Funktion

**Datei:** `backend/stream_checker_service.py`

```python
def mark_channels_updated(self, channel_ids: List[int], timestamp: str = None, 
                         stream_counts: Dict[int, int] = None, force_check: bool = False):
    # ...
    # Mark for force check if requested (bypasses 2-hour immunity)
    if force_check:
        self.mark_channel_for_force_check(channel_id)
```

### 2. "Discover Streams" verwendet jetzt `force_check=True`

**Datei:** `backend/automated_stream_manager.py`

```python
# Vorher:
stream_checker.update_tracker.mark_channels_updated(channel_ids_to_mark, stream_counts=stream_counts)

# Nachher:
stream_checker.update_tracker.mark_channels_updated(channel_ids_to_mark, stream_counts=stream_counts, force_check=True)
```

## Ergebnis

"Discover Streams" verhält sich jetzt konsistent mit anderen manuellen Aktionen:

- ✅ **Umgeht 2-hour immunity**
- ✅ **Führt immer Quality Check durch**
- ✅ **Wendet Rescoring/Reordering an**
- ✅ **Wendet Provider Limits an**

## Rückwärtskompatibilität

- ✅ **Vollständig rückwärtskompatibel**
- ✅ **Bestehende Aufrufe ohne `force_check` funktionieren weiterhin**
- ✅ **Automatische Quality Checks respektieren weiterhin 2-hour immunity**

## Technische Details

### Was ist 2-hour Immunity?

Die 2-hour immunity verhindert, dass Streams zu häufig geprüft werden:
- Streams die in den letzten 2 Stunden geprüft wurden, werden übersprungen
- Spart Ressourcen und verhindert excessive API-Calls
- Wird nur bei automatischen Checks angewendet

### Wann wird `force_check=True` verwendet?

- **Manuelle Aktionen:** Benutzer erwartet sofortige Ausführung
- **Global Actions:** Vollständige System-Überprüfung
- **Debugging/Testing:** Entwickler-Tools

### Wann wird `force_check=False` verwendet?

- **Automatische M3U Updates:** Respektiert immunity für Effizienz
- **Scheduled Checks:** Normale geplante Überprüfungen
- **Background Tasks:** Automatische Hintergrundprozesse

## Status

✅ **Implementiert und getestet**
✅ **In streamflow_enhancements.patch integriert**
✅ **Rückwärtskompatibel**