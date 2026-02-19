# 🔐 Einfaches Basic Auth Setup (OHNE Nginx!)

Schützt Frontend UND Backend mit Basic Auth - alles in einem Container!

---

## ✅ Was wurde geändert:

- `@requires_auth` Decorator zu `/` (Root) hinzugefügt
- `@requires_auth` Decorator zu `/<path:path>` (Catch-All) hinzugefügt
- Alle Frontend-Routen sind jetzt geschützt!

---

## 🚀 Aktivierung

### Schritt 1: Config-Datei erstellen

Erstelle `data/auth_config.json`:

```json
{
  "basic_auth": {
    "enabled": true,
    "username": "admin",
    "password": "dein-sicheres-passwort"
  }
}
```

### Schritt 2: Backend neu starten

```cmd
docker-compose restart backend
```

### Schritt 3: Testen

Öffne: `http://79.76.102.99:5002`

Browser zeigt Login-Dialog! ✅

---

## 🔒 Was ist geschützt?

✅ **Alles geschützt:**
- `/` - Frontend Homepage
- `/dashboard` - Dashboard
- `/stream-checker` - Stream Checker
- `/api/*` - Alle API-Endpunkte
- Alle Frontend-Routen

❌ **Nicht geschützt:**
- `/api/health` - Health Check (für Monitoring)
- `/api/version` - Version Info
- `/api/auth/test` - Auth Status Test
- `/health` - Health Check (nginx)

---

## 🔓 Deaktivierung

Setze in `data/auth_config.json`:

```json
{
  "basic_auth": {
    "enabled": false
  }
}
```

Dann: `docker-compose restart backend`

---

## 🔧 Passwort ändern

Bearbeite `data/auth_config.json`:

```json
{
  "basic_auth": {
    "enabled": true,
    "username": "neuer-user",
    "password": "neues-passwort"
  }
}
```

Dann: `docker-compose restart backend`

---

## 🌐 Wie es funktioniert

```
Browser → http://79.76.102.99:5002
    ↓
Backend (Flask) prüft Basic Auth
    ↓
    ├─→ / (Frontend) ← @requires_auth ✅
    ├─→ /dashboard ← @requires_auth ✅
    ├─→ /api/* ← @requires_auth ✅
    └─→ /health ← KEIN Auth (Monitoring)
```

---

## 🐛 Troubleshooting

### Problem: Login-Dialog erscheint nicht

**Lösung:**
1. Prüfe ob Auth enabled ist:
```cmd
type data\auth_config.json
```

2. Backend neu starten:
```cmd
docker-compose restart backend
```

3. Browser-Cache leeren: `Ctrl + Shift + R`

### Problem: "Authentication required" trotz korrektem Passwort

**Lösung:**
```cmd
# Prüfe Logs
docker-compose logs backend | findstr auth

# Prüfe Config
type data\auth_config.json
```

### Problem: Passwort vergessen

**Lösung:**
```cmd
# Stoppe Backend
docker-compose stop backend

# Bearbeite Config
notepad data\auth_config.json

# Setze neues Passwort oder disable Auth
{
  "basic_auth": {
    "enabled": false
  }
}

# Starte Backend
docker-compose start backend
```

---

## 🎯 Vorteile dieser Lösung

✅ **Einfach:**
- Keine zusätzlichen Container (Nginx)
- Keine extra Config-Dateien
- Alles in einem Container

✅ **Schnell:**
- Nur Config-Datei ändern
- Backend restart
- Fertig!

✅ **Flexibel:**
- Enable/Disable ohne Rebuild
- Passwort ändern ohne Rebuild
- Benutzername ändern ohne Rebuild

---

## ⚠️ Sicherheitshinweise

1. **HTTPS verwenden in Produktion!**
   - Basic Auth sendet Credentials Base64-kodiert
   - Ohne HTTPS können sie abgefangen werden
   - Verwende einen Reverse Proxy mit SSL/TLS

2. **Starke Passwörter verwenden**
   - Mindestens 12 Zeichen
   - Buchstaben, Zahlen, Sonderzeichen

3. **Passwort-Speicherung**
   - Passwörter werden im Klartext gespeichert
   - Datei-Permissions: `chmod 600 data/auth_config.json`

---

## 📝 Vergleich: Einfach vs. Nginx

| Feature | Einfach (Flask) | Nginx |
|---------|----------------|-------|
| Setup | ✅ Sehr einfach | ❌ Komplex |
| Container | 1 | 3 |
| Config-Dateien | 1 | 3 |
| Performance | ✅ Gut | ✅✅ Besser |
| SSL/TLS | ❌ Nein | ✅ Ja |
| Multi-User | ❌ Nein | ✅ Ja |

**Empfehlung:**
- **Entwicklung/Intern:** Einfache Lösung (Flask)
- **Produktion/Internet:** Nginx mit SSL/TLS

---

**Erstellt:** 19. Februar 2026  
**Status:** ✅ Production Ready (mit HTTPS!)

**🔐 Viel Erfolg mit dem geschützten StreamFlow!**
