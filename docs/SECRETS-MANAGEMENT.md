# Sichere Secrets-Verwaltung für 4minitz

## Problem
SMTP-Passwörter müssen im Klartext gespeichert werden, da der SMTP-Client sie zum Authentifizieren benötigt. Aber Sie können die **Datei verschlüsseln**, in der sie gespeichert sind!

## 3 Lösungen (von einfach bis professionell)

---

## 🔐 Lösung 1: GPG-Verschlüsselung (EMPFOHLEN für den Start)

**Vorteile:**
- ✅ Einfach zu verstehen und zu verwenden
- ✅ Passwort im Klartext nur während der Laufzeit im RAM
- ✅ Verschlüsselte Datei auf Festplatte
- ✅ Funktioniert auf jedem Linux-System

**So funktioniert es:**

### 1. Secrets verschlüsseln
```bash
cd /home/pi/4minitz-next
./scripts/simple-secrets.sh

# Wählen Sie Option 1: "Neue verschlüsselte Secrets erstellen"
# Geben Sie Ihre SMTP-Daten ein
# Vergeben Sie ein MASTER-PASSWORT (gut merken!)
```

### 2. Für Produktion: Secrets in .env.local entschlüsseln
```bash
./scripts/simple-secrets.sh

# Wählen Sie Option 3: "Secrets in .env.local entschlüsseln"
# Geben Sie Ihr Master-Passwort ein
# Die App lädt die Secrets beim Start aus .env.local
```

### 3. Service neu starten
```bash
sudo systemctl restart 4minitz
```

**Gespeichert in:**
- Verschlüsselt: `~/.4minitz-secrets/smtp.gpg`
- Entschlüsselt: `.env.local` (beim Start geladen)

**Sicherheit:**
- 🔒 Verschlüsselt mit AES256
- 🔒 Dateiberechtigung 600 (nur Sie können lesen)
- 🔒 Master-Passwort erforderlich zum Entschlüsseln
- ⚠️  Nach Entschlüsselung in .env.local im Klartext (aber nur für root/pi lesbar)

---

## 🏢 Lösung 2: systemd Credentials (PROFESSIONELL)

**Vorteile:**
- ✅ Automatische Entschlüsselung beim Service-Start
- ✅ Secrets nie auf Festplatte im Klartext
- ✅ Nur vom Service-Prozess lesbar
- ✅ Hardware-gebundene Verschlüsselung (TPM wenn verfügbar)

**So funktioniert es:**

### 1. Secrets einrichten
```bash
cd /home/pi/4minitz-next
sudo ./scripts/setup-secrets.sh

# Geben Sie Ihre SMTP-Daten ein
# Diese werden mit systemd-creds verschlüsselt
```

### 2. Systemd neu laden und Service starten
```bash
sudo systemctl daemon-reload
sudo systemctl restart 4minitz
```

### 3. Secrets anzeigen (zum Testen)
```bash
sudo systemd-creds cat smtp
```

**Gespeichert in:**
- Verschlüsselt: `/etc/4minitz/secrets/smtp.encrypted`
- Zur Laufzeit: Service hat Zugriff via `$CREDENTIALS_DIRECTORY/smtp`

**Sicherheit:**
- 🔒 Verschlüsselt mit systemd-creds (TPM wenn verfügbar)
- 🔒 An diese Hardware gebunden
- 🔒 Nur von systemd und dem Service lesbar
- 🔒 Automatische Entschlüsselung zur Laufzeit
- ✅ **HÖCHSTE SICHERHEIT**

**Wichtig:** Bei Hardware-Wechsel müssen Secrets neu verschlüsselt werden!

---

## 📝 Lösung 3: Umgebungsvariablen (Einfachste Alternative)

**Für Entwicklung/Test:**

### 1. Secrets in Shell laden
```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER=ihre-email@gmail.com
export SMTP_PASS=ihr-passwort
export FROM_EMAIL=ihre-email@gmail.com
```

### 2. App in dieser Shell starten
```bash
npm run dev
```

**Sicherheit:**
- ⚠️  Nur in dieser Shell verfügbar
- ⚠️  Verschwindet nach Shell-Ende
- ⚠️  Gut für Entwicklung, NICHT für Produktion

---

## 🎯 Empfehlung für Ihren Use Case

### Für Entwicklung/Test:
➡️ **Lösung 1 (GPG)** - Einfach und sicher genug

### Für Produktion:
➡️ **Lösung 2 (systemd)** - Professionell und sicher

### Aktuell:
Ihre `.env.local` hat bereits Postfix konfiguriert (localhost:25, keine Auth).
Wenn Sie externen SMTP nutzen wollen:
1. Verwenden Sie **GPG-Verschlüsselung** (simple-secrets.sh)
2. Oder **systemd credentials** (setup-secrets.sh) für maximale Sicherheit

---

## 📋 Vergleich

| Feature | .env.local | GPG | systemd-creds |
|---------|-----------|-----|---------------|
| Verschlüsselung auf Disk | ❌ | ✅ | ✅ |
| Klartext im RAM | ✅ | ✅ | ✅ |
| Auto-Entschlüsselung | - | ⚠️ | ✅ |
| Master-Passwort | - | ✅ | - |
| Hardware-gebunden | - | ❌ | ✅ |
| Einfachheit | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Sicherheit | ⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## ⚠️ Wichtig zu verstehen

**Das Passwort MUSS im Klartext verfügbar sein**, damit der SMTP-Client sich authentifizieren kann. Das ist bei ALLEN E-Mail-Programmen so (Thunderbird, Outlook, etc.).

**Was wir verbessern können:**
1. ✅ Verschlüsselte Speicherung auf Festplatte
2. ✅ Eingeschränkte Dateiberechtigungen
3. ✅ Widerrufbare App-Passwörter (Gmail)
4. ✅ Automatische Entschlüsselung ohne Klartext-Datei

**Was nicht geht:**
❌ Passwort hashen (SMTP benötigt Klartext)
❌ Passwort komplett verbergen (muss zur Laufzeit verfügbar sein)

---

## 🚀 Quick Start

**Für Gmail mit GPG-Verschlüsselung:**

```bash
# 1. App-Passwort bei Google erstellen
# https://myaccount.google.com/apppasswords

# 2. Secrets verschlüsselt speichern
./scripts/simple-secrets.sh
# → Option 1, Daten eingeben

# 3. In .env.local entschlüsseln
./scripts/simple-secrets.sh
# → Option 3, Master-Passwort eingeben

# 4. App neu starten
sudo systemctl restart 4minitz

# 5. Testen
# http://localhost:3000/admin/email-config
```

**Die verschlüsselte Datei können Sie bedenkenlos in Git committen!**
(Aber NICHT das Master-Passwort oder die entschlüsselte .env.local)

---

## 📞 Support

Bei Fragen:
1. GPG-Verschlüsselung: `man gpg`
2. systemd-creds: `man systemd-creds`
3. Beide Skripte haben eingebaute Hilfe und Fehlermeldungen
