#!/bin/bash

# Email Configuration Script for Protokoll-APP
# This script helps configure SMTP settings securely

set -e

echo "========================================"
echo "  📧 Protokoll-APP Email-Konfiguration"
echo "========================================"
echo ""

# Check if .env.local exists (determine script dir reliably)
# Use BASH_SOURCE so the script finds the correct directory even when
# executed via `bash script.sh` or `sudo`.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Fehler: $ENV_FILE nicht gefunden!"
    echo "Bitte erstellen Sie zuerst eine .env.local Datei im Projekt-Root ($PROJECT_ROOT)."
    exit 1
fi

echo "Wählen Sie Ihren E-Mail-Anbieter:"
echo ""
echo "1) Gmail / Google Workspace"
echo "2) Outlook / Office 365"
echo "3) Custom SMTP Server"
echo "4) Lokaler Postfix (bereits konfiguriert)"
echo ""
read -p "Ihre Wahl (1-4): " choice

case $choice in
    1)
        echo ""
        echo "📮 Gmail Konfiguration"
        echo "─────────────────────────────────"
        echo "WICHTIG: Sie benötigen ein App-Passwort!"
        echo ""
        echo "So erstellen Sie ein Gmail App-Passwort:"
        echo "1. Google Account → Sicherheit"
        echo "2. 2-Faktor-Authentifizierung aktivieren"
        echo "3. App-Passwörter → Mail auswählen"
        echo "4. Passwort generieren und kopieren"
        echo ""
        
        read -p "Gmail-Adresse: " email
        read -sp "App-Passwort: " password
        echo ""
        
        SMTP_HOST="smtp.gmail.com"
        SMTP_PORT="587"
        SMTP_SECURE="false"
        SMTP_USER="$email"
        SMTP_PASS="$password"
        FROM_EMAIL="$email"
        ;;
        
    2)
        echo ""
        echo "📮 Outlook Konfiguration"
        echo "─────────────────────────────────"
        
        read -p "Outlook-Adresse: " email
        read -sp "Passwort: " password
        echo ""
        
        SMTP_HOST="smtp-mail.outlook.com"
        SMTP_PORT="587"
        SMTP_SECURE="false"
        SMTP_USER="$email"
        SMTP_PASS="$password"
        FROM_EMAIL="$email"
        ;;
        
    3)
        echo ""
        echo "📮 Custom SMTP Server"
        echo "─────────────────────────────────"
        
        read -p "SMTP Host: " SMTP_HOST
        read -p "SMTP Port (z.B. 587): " SMTP_PORT
        read -p "SSL verwenden? (true/false): " SMTP_SECURE
        read -p "Benutzername (leer lassen für keine Auth): " SMTP_USER
        
        if [ -n "$SMTP_USER" ]; then
            read -sp "Passwort: " SMTP_PASS
            echo ""
        else
            SMTP_PASS=""
        fi
        
        read -p "Absender-Email: " FROM_EMAIL
        ;;
        
    4)
        echo ""
        echo "📮 Lokaler Postfix"
        echo "─────────────────────────────────"
        echo "Verwendet den bereits installierten Postfix-Server"
        
        SMTP_HOST="localhost"
        SMTP_PORT="25"
        SMTP_SECURE="false"
        SMTP_USER=""
        SMTP_PASS=""
        read -p "Absender-Email (z.B. noreply@ihredomain.de): " FROM_EMAIL
        ;;
        
    *)
        echo "Ungültige Auswahl!"
        exit 1
        ;;
esac

echo ""
echo "🔄 Aktualisiere $ENV_FILE..."

# Backup existing file
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Remove old email settings
sed -i '/^SMTP_HOST=/d' "$ENV_FILE"
sed -i '/^SMTP_PORT=/d' "$ENV_FILE"
sed -i '/^SMTP_SECURE=/d' "$ENV_FILE"
sed -i '/^SMTP_USER=/d' "$ENV_FILE"
sed -i '/^SMTP_PASS=/d' "$ENV_FILE"
sed -i '/^FROM_EMAIL=/d' "$ENV_FILE"

# Add new settings
echo "" >> "$ENV_FILE"
echo "# Email Configuration (SMTP)" >> "$ENV_FILE"
echo "SMTP_HOST=$SMTP_HOST" >> "$ENV_FILE"
echo "SMTP_PORT=$SMTP_PORT" >> "$ENV_FILE"
echo "SMTP_SECURE=$SMTP_SECURE" >> "$ENV_FILE"

if [ -n "$SMTP_USER" ]; then
    echo "SMTP_USER=$SMTP_USER" >> "$ENV_FILE"
    echo "SMTP_PASS=$SMTP_PASS" >> "$ENV_FILE"
fi

echo "FROM_EMAIL=$FROM_EMAIL" >> "$ENV_FILE"

echo ""
echo "✅ Email-Konfiguration gespeichert!"
echo ""
echo "⚠️  WICHTIG: Stellen Sie sicher, dass .env.local NICHT ins Git committed wird!"
echo ""
echo "📋 Ihre Konfiguration:"
echo "────────────────────────"
echo "SMTP Host: $SMTP_HOST"
echo "SMTP Port: $SMTP_PORT"
echo "SSL/TLS: $SMTP_SECURE"
echo "Absender: $FROM_EMAIL"

if [ -n "$SMTP_USER" ]; then
    echo "Auth: Ja (User: $SMTP_USER)"
else
    echo "Auth: Nein"
fi

echo ""
echo "🔄 Starten Sie die Anwendung neu, um die Änderungen zu übernehmen:"
echo "   sudo systemctl restart nxtminutes"
echo ""
echo "🧪 Testen Sie die Konfiguration unter:"
echo "   http://localhost:3000/settings/email"
echo ""
