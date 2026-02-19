# 🚀 Quick Start: Basic Auth aktivieren

## Schritt 1: Config-Datei erstellen

Erstelle die Datei `data/auth_config.json`:

```json
{
  "basic_auth": {
    "enabled": true,
    "username": "admin",
    "password": "dein-sicheres-passwort"
  }
}
```

## Schritt 2: Backend neu starten

```cmd
docker-compose restart backend
```

## Schritt 3: Testen

Öffne `http://localhost:3000` im Browser.

Du solltest jetzt einen Login-Dialog sehen!

---

## ✅ Das war's!

- Benutzername: `admin`
- Passwort: `dein-sicheres-passwort`

---

## 🔓 Deaktivieren

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

Siehe `BASIC_AUTH_README.md` für Details!
