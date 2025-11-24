#!/bin/bash

# simple-secrets.sh - Simple encrypted secrets using GPG
# This provides an alternative if systemd-creds is too complex

set -e

SECRETS_DIR="$HOME/.4minitz-secrets"
ENCRYPTED_FILE="$SECRETS_DIR/smtp.gpg"
PLAIN_FILE="$SECRETS_DIR/smtp.env"

echo "=========================================="
echo "  4Minitz Simple Encrypted Secrets"
echo "=========================================="
echo ""
echo "Diese Lösung verwendet GPG zur Verschlüsselung."
echo ""

# Check if GPG is available
if ! command -v gpg &> /dev/null; then
    echo "❌ GPG nicht gefunden. Installieren Sie es mit:"
    echo "   sudo apt-get install gnupg"
    exit 1
fi

echo "✅ GPG gefunden"
echo ""

# Create secrets directory
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Menu
echo "Was möchten Sie tun?"
echo "1) Neue verschlüsselte Secrets erstellen"
echo "2) Bestehende Secrets anzeigen"
echo "3) Secrets in .env.local entschlüsseln (für Entwicklung)"
echo "4) Verschlüsselte Secrets in Umgebungsvariablen laden"
echo ""
read -p "Auswahl (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Bitte geben Sie Ihre SMTP-Zugangsdaten ein:"
        echo ""
        
        read -p "SMTP Host: " SMTP_HOST
        read -p "SMTP Port: " SMTP_PORT
        read -p "SMTP Secure (true/false): " SMTP_SECURE
        read -p "SMTP Benutzername: " SMTP_USER
        read -sp "SMTP Passwort: " SMTP_PASS
        echo ""
        read -p "Von E-Mail-Adresse: " FROM_EMAIL
        
        # Create plain text file
        cat > "$PLAIN_FILE" <<EOF
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
FROM_EMAIL=$FROM_EMAIL
EOF
        
        # Encrypt with GPG
        echo ""
        echo "🔒 Verschlüssele mit GPG..."
        echo "   Bitte geben Sie ein MASTER-PASSWORT ein:"
        echo "   (Merken Sie sich dieses gut - Sie brauchen es zum Entschlüsseln!)"
        
        gpg --symmetric --cipher-algo AES256 --output "$ENCRYPTED_FILE" "$PLAIN_FILE"
        
        # Secure delete plain file
        shred -u "$PLAIN_FILE" 2>/dev/null || rm -f "$PLAIN_FILE"
        
        chmod 600 "$ENCRYPTED_FILE"
        
        echo ""
        echo "✅ Secrets erfolgreich verschlüsselt!"
        echo "   Gespeichert in: $ENCRYPTED_FILE"
        echo ""
        echo "⚠️  WICHTIG: Merken Sie sich Ihr Master-Passwort!"
        ;;
        
    2)
        if [ ! -f "$ENCRYPTED_FILE" ]; then
            echo "❌ Keine verschlüsselten Secrets gefunden."
            echo "   Führen Sie zuerst Option 1 aus."
            exit 1
        fi
        
        echo ""
        echo "🔓 Entschlüssele Secrets..."
        gpg --decrypt "$ENCRYPTED_FILE"
        echo ""
        ;;
        
    3)
        if [ ! -f "$ENCRYPTED_FILE" ]; then
            echo "❌ Keine verschlüsselten Secrets gefunden."
            exit 1
        fi
        
        ENV_FILE="$(dirname "$0")/../.env.local"
        
        echo ""
        echo "📝 Entschlüssele und schreibe in .env.local..."
        
        # Backup
        if [ -f "$ENV_FILE" ]; then
            BACKUP_FILE="$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
            cp "$ENV_FILE" "$BACKUP_FILE"
            echo "   Backup: $BACKUP_FILE"
        fi
        
        # Decrypt to temp file
        TEMP_FILE=$(mktemp)
        if ! gpg --decrypt --output "$TEMP_FILE" "$ENCRYPTED_FILE"; then
            rm -f "$TEMP_FILE"
            echo "❌ Entschlüsselung fehlgeschlagen"
            exit 1
        fi
        
        # Remove old SMTP settings from .env.local
        if [ -f "$ENV_FILE" ]; then
            sed -i '/^SMTP_HOST=/d' "$ENV_FILE"
            sed -i '/^SMTP_PORT=/d' "$ENV_FILE"
            sed -i '/^SMTP_SECURE=/d' "$ENV_FILE"
            sed -i '/^SMTP_USER=/d' "$ENV_FILE"
            sed -i '/^SMTP_PASS=/d' "$ENV_FILE"
            sed -i '/^FROM_EMAIL=/d' "$ENV_FILE"
        fi
        
        # Append decrypted settings
        echo "" >> "$ENV_FILE"
        echo "# SMTP Settings (decrypted from $ENCRYPTED_FILE)" >> "$ENV_FILE"
        cat "$TEMP_FILE" >> "$ENV_FILE"
        
        # Secure delete temp file
        shred -u "$TEMP_FILE"
        
        chmod 600 "$ENV_FILE"
        
        echo "✅ .env.local aktualisiert"
        echo ""
        echo "Starten Sie die Anwendung neu:"
        echo "  sudo systemctl restart 4minitz"
        ;;
        
    4)
        if [ ! -f "$ENCRYPTED_FILE" ]; then
            echo "❌ Keine verschlüsselten Secrets gefunden."
            exit 1
        fi
        
        echo ""
        echo "🔓 Lade Secrets in Umgebungsvariablen..."
        
        # Decrypt to temp file
        TEMP_FILE=$(mktemp)
        if ! gpg --decrypt --output "$TEMP_FILE" "$ENCRYPTED_FILE"; then
            rm -f "$TEMP_FILE"
            echo "❌ Entschlüsselung fehlgeschlagen"
            exit 1
        fi
        
        # Source the file to export variables
        source "$TEMP_FILE"
        
        echo "✅ Folgende Variablen wurden geladen:"
        echo "   SMTP_HOST=$SMTP_HOST"
        echo "   SMTP_PORT=$SMTP_PORT"
        echo "   SMTP_SECURE=$SMTP_SECURE"
        echo "   SMTP_USER=$SMTP_USER"
        echo "   SMTP_PASS=(versteckt)"
        echo "   FROM_EMAIL=$FROM_EMAIL"
        echo ""
        echo "Diese Variablen sind jetzt in Ihrer Shell verfügbar."
        echo "Starten Sie die App in dieser Shell:"
        echo "  npm run dev"
        
        # Secure delete temp file
        shred -u "$TEMP_FILE"
        ;;
        
    *)
        echo "❌ Ungültige Auswahl"
        exit 1
        ;;
esac

echo ""
echo "Sicherheitshinweise:"
echo "  • Die verschlüsselte Datei: $ENCRYPTED_FILE"
echo "  • Dateiberechtigung: 600 (nur Sie können lesen)"
echo "  • Verschlüsselung: AES256"
echo "  • Master-Passwort: Gut aufbewahren!"
echo ""
