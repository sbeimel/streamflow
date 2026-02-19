# 🔐 Basic Authentication für StreamFlow

StreamFlow unterstützt HTTP Basic Authentication um den Zugriff auf die Web-UI und API zu sichern.

---

## ✅ Features

- HTTP Basic Authentication für Frontend UND Backend
- Konfigurierbar über JSON-Datei oder API
- Enable/Disable ohne Neustart
- Benutzername und Passwort anpassbar
- Browser-Login-Dialog
- Keine zusätzlichen Container nötig!

---

## 🚀 Aktivierung

### Schritt 1: Config-Datei erstellen

**Datei:** `data/auth_config.json`

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

Öffne StreamFlow im Browser → Login-Dialog erscheint!

---

## 🔓 Deaktivierung

### Über Config-Datei:

```json
{
  "basic_auth": {
    "enabled": false
  }
}
```

Dann: `docker-compose restart backend`

### Über API (mit Auth):

```bash
curl -X PUT http://localhost:5000/api/auth/config \
  -u admin:dein-passwort \
  -H "Content-Type: application/json" \
  -d '{
    "basic_auth": {
      "enabled": false
    }
  }'
```

---

## 🌐 Nutzung im Browser

1. Öffne StreamFlow: `http://localhost:3000`
2. Browser zeigt Login-Dialog
3. Gib Benutzername und Passwort ein
4. Browser speichert Credentials für Session

**Logout:** Browser komplett schließen oder Private/Inkognito-Modus verwenden

---

## 🔧 API-Nutzung mit Auth

### cURL:

```bash
# Mit -u Flag
curl -u admin:passwort http://localhost:5000/api/automation/status

# Mit Authorization Header
curl -H "Authorization: Basic YWRtaW46cGFzc3dvcnQ=" \
  http://localhost:5000/api/automation/status
```

### Python:

```python
import requests
from requests.auth import HTTPBasicAuth

response = requests.get(
    'http://localhost:5000/api/automation/status',
    auth=HTTPBasicAuth('admin', 'passwort')
)
```

### JavaScript/Fetch:

```javascript
const response = await fetch('http://localhost:5000/api/automation/status', {
  headers: {
    'Authorization': 'Basic ' + btoa('admin:passwort')
  }
});
```

---

## 🛡️ Sicherheitshinweise

### ⚠️ WICHTIG:

1. **Ändere das Standard-Passwort!**
   - Standard: `changeme`
   - Verwende ein starkes Passwort

2. **HTTPS verwenden in Produktion!**
   - Basic Auth sendet Credentials Base64-kodiert (nicht verschlüsselt)
   - Ohne HTTPS können Credentials abgefangen werden
   - Verwende einen Reverse Proxy (nginx, Traefik) mit SSL/TLS

3. **Passwort-Speicherung:**
   - Passwörter werden aktuell im Klartext gespeichert
   - Datei-Permissions: `chmod 600 data/auth_config.json`
   - Nur für Docker-Benutzer lesbar

### 🔒 Empfohlenes Setup für Produktion:

```
Internet → HTTPS (443) → Nginx/Traefik → HTTP (3000) → StreamFlow
                ↓
           SSL/TLS Zertifikat
           (Let's Encrypt)
```

**Nginx Beispiel:**

```nginx
server {
    listen 443 ssl http2;
    server_name streamflow.example.com;
    
    ssl_certificate /etc/letsencrypt/live/streamflow.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/streamflow.example.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 API-Endpunkte

### GET /api/auth/config
Aktuelle Auth-Konfiguration abrufen (ohne Passwort)

**Requires Auth:** Ja (wenn enabled)

**Response:**
```json
{
  "basic_auth": {
    "enabled": true,
    "username": "admin"
  }
}
```

### PUT /api/auth/config
Auth-Konfiguration aktualisieren

**Requires Auth:** Ja (wenn enabled)

**Request:**
```json
{
  "basic_auth": {
    "enabled": true,
    "username": "neuer-user",
    "password": "neues-passwort"
  }
}
```

**Response:**
```json
{
  "message": "Authentication configuration updated successfully"
}
```

### GET /api/auth/test
Auth-Status testen

**Requires Auth:** Nein (gibt Status zurück)

**Response (Auth disabled):**
```json
{
  "authenticated": true,
  "auth_enabled": false,
  "message": "Authentication is disabled"
}
```

**Response (Auth enabled, logged in):**
```json
{
  "authenticated": true,
  "auth_enabled": true,
  "username": "admin"
}
```

**Response (Auth enabled, not logged in):**
```json
{
  "authenticated": false,
  "auth_enabled": true
}
```

---

## 🔍 Geschützte Endpunkte

**Geschützt (wenn Auth enabled):** ✅
- `/` - Frontend Homepage
- `/dashboard` - Dashboard  
- `/stream-checker` - Stream Checker
- Alle Frontend-Routen
- `/api/automation/*` - Alle Automation-Endpunkte
- `/api/channels/*` - Alle Channel-Endpunkte
- `/api/regex-patterns/*` - Regex-Pattern-Management
- `/api/profile-config` - Profile-Konfiguration
- `/api/profiles/*` - Profile-Management
- `/api/changelog` - Changelog
- `/api/dead-streams/*` - Dead Streams Management
- `/api/channel-settings/*` - Channel Settings
- `/api/group-settings/*` - Group Settings
- `/api/channel-order` - Channel Order
- `/api/discover-streams` - Stream Discovery
- `/api/auth/config` - Auth Config Management

**Nicht geschützt:** ❌
- `/api/health` - Health Check (für Monitoring)
- `/api/version` - Version Info
- `/api/auth/test` - Auth Status Test
- `/health` - Health Check (nginx)

---

## 🐛 Troubleshooting

### Problem: "Authentication required" obwohl Auth disabled

**Lösung:**
```bash
# Prüfe Config
cat data/auth_config.json

# Stelle sicher dass enabled: false
# Starte Backend neu
docker-compose restart backend
```

### Problem: Passwort vergessen

**Lösung:**
```bash
# Stoppe Backend
docker-compose stop backend

# Bearbeite Config
nano data/auth_config.json

# Setze neues Passwort oder disable Auth
{
  "basic_auth": {
    "enabled": false
  }
}

# Starte Backend
docker-compose start backend
```

### Problem: Browser fragt nicht nach Login

**Lösung:**
1. Browser-Cache leeren
2. Inkognito-Modus testen
3. Prüfe ob Auth wirklich enabled ist: `curl http://localhost:5000/api/auth/test`

### Problem: 401 Unauthorized trotz korrektem Passwort

**Lösung:**
```bash
# Prüfe Logs
docker-compose logs backend | grep -i auth

# Teste Auth-Status
curl http://localhost:5000/api/auth/test

# Prüfe Config-Datei
cat data/auth_config.json
```

---

## 📝 Changelog

### Version 1.0 (19. Februar 2026)
- ✅ HTTP Basic Authentication implementiert
- ✅ Config-Datei Support (`auth_config.json`)
- ✅ API-Endpunkte für Auth-Management
- ✅ `@requires_auth` Decorator für alle wichtigen Routen
- ✅ Auth-Status Test-Endpunkt
- ✅ Enable/Disable ohne Neustart

---

## 🔮 Geplante Features

- [ ] Passwort-Hashing (bcrypt)
- [ ] Multi-User Support
- [ ] Role-Based Access Control (RBAC)
- [ ] API-Token Authentication
- [ ] Session Management
- [ ] Login-Versuche limitieren
- [ ] 2FA Support

---

## 📞 Support

Bei Problemen oder Fragen:
1. Prüfe diese README
2. Schaue in die Logs: `docker-compose logs backend`
3. Teste Auth-Status: `curl http://localhost:5000/api/auth/test`

---

**Erstellt:** 19. Februar 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready

**🔐 Viel Erfolg mit der gesicherten StreamFlow-Installation!**
