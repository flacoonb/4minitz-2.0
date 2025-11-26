#!/bin/bash

# 4Minitz 2.0 Service Uninstallation Script
# This script removes the 4Minitz 2.0 systemd service

set -e

APP_NAME="4minitz-2.0"
SYSTEMD_DIR="/etc/systemd/system"

echo "🛑 Uninstalling 4Minitz 2.0 systemd service..."

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root or with sudo"
   echo "   Usage: sudo ./uninstall-service.sh"
   exit 1
fi

# Stop the service if running
echo "⏹️  Stopping service..."
systemctl stop ${APP_NAME}.service 2>/dev/null || true

# Disable the service
echo "❌ Disabling service..."
systemctl disable ${APP_NAME}.service 2>/dev/null || true

# Remove service file
echo "🗑️  Removing service file..."
rm -f "$SYSTEMD_DIR/${APP_NAME}.service"

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Reset failed state
systemctl reset-failed 2>/dev/null || true

echo ""
echo "✅ Service uninstalled successfully!"
echo ""
echo "The app is no longer running as a service."
echo "You can still run it manually with:"
echo "  cd /home/pi/4minitz-next"
echo "  npm run dev"