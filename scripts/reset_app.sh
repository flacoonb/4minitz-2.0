#!/usr/bin/env bash
set -euo pipefail

# Reset script for 4minitz-next: drops MongoDB database and clears uploads.
# Usage: MONGODB_URI="..." ./scripts/reset_app.sh
# To run non-interactively: FORCE=1 ./scripts/reset_app.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -z "${MONGODB_URI:-}" ] && [ -z "${MONGO_URI:-}" ]; then
  echo "Please set MONGODB_URI or MONGO_URI environment variable. Aborting."
  exit 1
fi

if [ "${FORCE:-0}" = "1" ] || [[ "$*" == *--yes* ]]; then
  echo "Non-interactive mode: proceeding with reset..."
  NODE_ARGS=(--yes)
else
  echo "This will DROP the entire MongoDB database pointed to by MONGODB_URI and delete uploads." 
  read -p "Type RESET to confirm: " CONFIRM
  if [ "$CONFIRM" != "RESET" ]; then
    echo "Aborted by user. No changes made."
    exit 0
  fi
  NODE_ARGS=()
fi

echo "Dropping database..."
node scripts/reset_db.js ${NODE_ARGS[@]}

echo "Clearing uploads/ directory..."
if [ -d uploads ]; then
  rm -rf uploads/*
  echo "uploads/ cleared."
else
  echo "No uploads/ directory found; skipping."
fi

echo "Reset complete."
