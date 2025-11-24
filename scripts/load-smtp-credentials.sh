#!/bin/bash

# load-smtp-credentials.sh - Load decrypted SMTP credentials into environment

CREDS_FILE="${CREDENTIALS_DIRECTORY}/smtp"

if [ ! -f "$CREDS_FILE" ]; then
    echo "⚠️  Credentials file not found: $CREDS_FILE" >&2
    exit 1
fi

# Read and parse JSON credentials
SMTP_HOST=$(jq -r '.smtp_host' "$CREDS_FILE")
SMTP_PORT=$(jq -r '.smtp_port' "$CREDS_FILE")
SMTP_SECURE=$(jq -r '.smtp_secure' "$CREDS_FILE")
SMTP_USER=$(jq -r '.smtp_user' "$CREDS_FILE")
SMTP_PASS=$(jq -r '.smtp_pass' "$CREDS_FILE")
FROM_EMAIL=$(jq -r '.from_email' "$CREDS_FILE")

# Export as environment variables
export SMTP_HOST
export SMTP_PORT
export SMTP_SECURE
export SMTP_USER
export SMTP_PASS
export FROM_EMAIL

# Execute the main application
exec "$@"
