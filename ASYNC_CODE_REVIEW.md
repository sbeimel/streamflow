# Async Implementation - Code Review

## Status: ⚠️ Ein Problem gefunden

---

## Problem: Flag-Initialisierung fehlt

### Beschreibung
Die async Implementierungen setzen Flags wie `service.rescore_in_progress`, aber diese werden nie initialisiert.

### Betroffene Flags:
1. `service.rescore_in_progress`
2. `service.remove_excluded_in_progress`
3. `service.apply_limits_in_progress`
4. `service.test_streams_in_progress`

### Aktueller Code (Problematisch):
```python
# Check if operation is already running
if hasattr(service, 'rescore_in_progress') and service.rescore_in_progress:
    return jsonify({"message": "Already running"}), 409
```

**Problem**: `hasattr()` prüft ob Attribut existiert, aber es wird nie initialisiert!

### Lösung: Flags im StreamCheckerService initialisieren

**Option 1: Im `__init__` initialisieren** (Empfohlen)
```python
# backend/stream_checker_service.py
class StreamCheckerService:
    def __init__(self):
        # ... existing code ...
        
        # Operation flags for async operations
        self.rescore_in_progress = False
        self.remove_excluded_in_progress = False
        self.apply_limits_in_progress = False
        self.test_streams_in_progress = False
```

**Option 2: Mit `getattr()` und Default** (Funktioniert auch)
```python
# In web_api.py
if getattr(service, 'rescore_in_progress', False):
    return jsonify({"message": "Already running"}), 409
```

**Empfehlung**: Option 1 ist sauberer und expliziter.

---

## Weitere Prüfungen

### ✅ Threading-Sicherheit
- Flags werden nur von einem Thread gesetzt (OK)
- `daemon=True` verhindert Zombie-Threads (OK)
- `finally` Block setzt Flag zurück (OK)

### ✅ Error Handling
- Try-except in Background-Thread (OK)
- Logging bei Fehlern (OK)
- Flag wird immer zurückgesetzt (OK)

### ✅ Response-Codes
- 202 Accepted für async (OK)
- 409 Conflict wenn bereits läuft (OK)
- 400/500 für Fehler (OK)

### ✅ Frontend-Integration
- Handler prüfen auf 202 (OK)
- Toast-Nachrichten (OK)
- Status-Polling (bereits vorhanden) (OK)

---

## Empfohlene Fixes

### Fix 1: Flags initialisieren (KRITISCH)

**Datei**: `backend/stream_checker_service.py`

**Wo**: Im `__init__` der StreamCheckerService-Klasse

**Was hinzufügen**:
```python
# Operation flags for async operations
self.rescore_in_progress = False
self.remove_excluded_in_progress = False
self.apply_limits_in_progress = False
self.test_streams_in_progress = False
```

### Fix 2: Status-Endpoint erweitern (OPTIONAL)

**Datei**: `backend/web_api.py`

**Endpoint**: `GET /api/stream-checker/status`

**Was hinzufügen**:
```python
"rescore_in_progress": getattr(service, 'rescore_in_progress', False),
"remove_excluded_in_progress": getattr(service, 'remove_excluded_in_progress', False),
"apply_limits_in_progress": getattr(service, 'apply_limits_in_progress', False),
"test_streams_in_progress": getattr(service, 'test_streams_in_progress', False),
```

---

## Zusammenfassung

### Kritische Probleme: 1
- ⚠️ Flags nicht initialisiert

### Nicht-kritische Probleme: 0
- ✅ Alles andere ist OK

### Empfehlung:
1. Flags im `__init__` initialisieren
2. Optional: Status-Endpoint erweitern
3. Testen

---

**Status**: ⚠️ Ein Fix nötig, dann ✅ OK
