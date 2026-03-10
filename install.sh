#!/usr/bin/env bash

# NXTMinutes - Full Installer
# Usage:
#   curl -fsSLO https://raw.githubusercontent.com/flacoonb/NXTminutes/main/install.sh
#   less install.sh
#   sudo bash install.sh

set -euo pipefail

REPO_URL="https://github.com/flacoonb/NXTminutes.git"
NODE_MAJOR_REQUIRED=24
INSTALL_BASENAME="nxtminutes"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NXTMinutes Installer${NC}"
echo "========================"

# 1. Check privileges and runtime expectations
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run this script as root (sudo).${NC}"
    exit 1
fi

if [ -z "${SUDO_USER:-}" ] || [ "${SUDO_USER:-}" = "root" ]; then
    echo -e "${RED}❌ Please run this installer via sudo from a regular user account.${NC}"
    echo "   Example: sudo bash install.sh"
    echo "   Direct root login is not supported."
    exit 1
fi

if ! id "$SUDO_USER" >/dev/null 2>&1; then
    echo -e "${RED}❌ Could not resolve sudo user '$SUDO_USER'.${NC}"
    exit 1
fi

if [ ! -f /etc/os-release ]; then
    echo -e "${RED}❌ Unsupported system: missing /etc/os-release.${NC}"
    echo "   This installer supports Debian/Ubuntu systems with systemd."
    exit 1
fi

source /etc/os-release
if [[ "${ID:-}" != "debian" && "${ID:-}" != "ubuntu" ]]; then
    echo -e "${RED}❌ Unsupported distribution: '${ID:-unknown}'.${NC}"
    echo "   This installer supports Debian/Ubuntu systems with systemd."
    exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo -e "${RED}❌ Unsupported system: apt-get not found.${NC}"
    exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
    echo -e "${RED}❌ Missing dependency: sudo command not found.${NC}"
    exit 1
fi

if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
    echo -e "${RED}❌ Unsupported init system: systemd is required.${NC}"
    exit 1
fi

USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then
    echo -e "${RED}❌ Could not determine home directory for user '$SUDO_USER'.${NC}"
    exit 1
fi

INSTALL_DIR="${USER_HOME}/${INSTALL_BASENAME}"

ensure_docker_group_membership() {
    local user="$1"

    if ! getent group docker >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker group not found after Docker installation/check.${NC}"
        exit 1
    fi

    if id -nG "$user" | grep -qw docker; then
        echo -e "${GREEN}✅ User $user is already in docker group.${NC}"
        return
    fi

    usermod -aG docker "$user"
    echo -e "${GREEN}✅ Added user $user to docker group.${NC}"
}

# 2. System Update & Dependencies
echo -e "\n${BLUE}🔄 Updating system and installing base dependencies...${NC}"
apt-get update
apt-get install -y git curl ca-certificates build-essential

# 3. Check/Install Node.js
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${BLUE}📦 Installing Node.js ${NODE_MAJOR_REQUIRED}...${NC}"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_REQUIRED}.x" | bash -
    apt-get install -y nodejs
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "$NODE_MAJOR_REQUIRED" ]; then
        echo -e "${BLUE}📦 Updating Node.js to version ${NODE_MAJOR_REQUIRED}...${NC}"
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_REQUIRED}.x" | bash -
        apt-get install -y nodejs
    else
        echo -e "${GREEN}✅ Node.js $(node -v) is already installed.${NC}"
    fi
fi

# Ensure npm is installed (sometimes separate)
if ! command -v npm &> /dev/null; then
    echo -e "${BLUE}📦 Installing npm...${NC}"
    apt-get install -y npm
fi

# 4. Check/Install Docker
if ! command -v docker &> /dev/null; then
    echo -e "${BLUE}🐳 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
else
    echo -e "${GREEN}✅ Docker is already installed.${NC}"
fi

ensure_docker_group_membership "$SUDO_USER"

# 5. Clone Repository
if [ -d "$INSTALL_DIR" ]; then
    echo -e "\n${RED}⚠️  Directory '$INSTALL_DIR' already exists.${NC}"
    read -p "Do you want to delete it and reinstall? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$INSTALL_DIR" != /* || "$INSTALL_DIR" == "/" || "$INSTALL_DIR" == "/home" || "$INSTALL_DIR" == "/root" ]]; then
            echo -e "${RED}❌ Refusing to delete unsafe path: $INSTALL_DIR${NC}"
            exit 1
        fi
        rm -rf "$INSTALL_DIR"
    else
        echo "Aborting."
        exit 1
    fi
fi

echo -e "\n${BLUE}📥 Cloning repository...${NC}"
git clone "$REPO_URL" "$INSTALL_DIR"

# 6. Prepare & Run Setup
echo -e "\n${BLUE}⚙️  Starting setup...${NC}"
cd "$INSTALL_DIR"
chmod +x setup.sh

chown -R "$SUDO_USER:$SUDO_USER" "$INSTALL_DIR"

echo -e "${BLUE}👤 Running setup as user $SUDO_USER...${NC}"
# Run as original user with a login shell for predictable environment.
sudo -H -u "$SUDO_USER" bash -lc "cd \"$INSTALL_DIR\" && ./setup.sh"

# 7. Install Systemd Service (Optional)
echo -e "\n${BLUE}🚀 Service Installation${NC}"
read -p "Do you want to install NXTMinutes as a systemd service (auto-start on boot)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    APP_NAME="nxtminutes"
    LEGACY_APP_NAMES=("4minitz" "4minitz-2.0")
    APP_DIR=$(pwd)
    SERVICE_FILE="nxtminutes.service"
    SYSTEMD_DIR="/etc/systemd/system"
    
    # Determine user who owns the directory (to run the service as)
    APP_USER="$SUDO_USER"

    echo "   App Directory: $APP_DIR"
    echo "   App User:      $APP_USER"

    # Build the application if .next doesn't exist
    if [[ ! -d ".next" ]]; then
        echo -e "${BLUE}🏗️  Building application (this may take a while)...${NC}"
        # Run build as the app user to avoid root-owned files in .next
        sudo -u "$APP_USER" PATH=$PATH npm run build
    fi

    # Copy service file
    echo -e "${BLUE}📋 Installing service file...${NC}"
    TARGET_SERVICE="$SYSTEMD_DIR/${APP_NAME}.service"
    
    if [[ -f "$SERVICE_FILE" ]]; then
        cp "$SERVICE_FILE" "$TARGET_SERVICE"
        
        # Update paths and user in the installed service file
        sed -i "s|^User=.*|User=$APP_USER|g" "$TARGET_SERVICE"
        sed -i "s|^Group=.*|Group=$(id -gn "$APP_USER")|g" "$TARGET_SERVICE"
        sed -i "s|^WorkingDirectory=.*|WorkingDirectory=$APP_DIR|g" "$TARGET_SERVICE"
        sed -i "s|^ExecStart=.*|ExecStart=$APP_DIR/node_modules/.bin/next start|g" "$TARGET_SERVICE"
        
        # Disable legacy service names to avoid duplicate processes/ports.
        for LEGACY_APP_NAME in "${LEGACY_APP_NAMES[@]}"; do
            systemctl stop "${LEGACY_APP_NAME}.service" 2>/dev/null || true
            systemctl disable "${LEGACY_APP_NAME}.service" 2>/dev/null || true
        done

        # Reload systemd
        systemctl daemon-reload
        systemctl enable ${APP_NAME}.service
        systemctl start ${APP_NAME}.service
        
        echo -e "${GREEN}✅ Service installed and started!${NC}"
        echo "   Status: sudo systemctl status ${APP_NAME}.service"
    else
        echo -e "${RED}❌ Service file template '$SERVICE_FILE' not found.${NC}"
        exit 1
    fi
else
    echo -e "\n${GREEN}✅ Installation complete!${NC}"
    echo "You can start the app manually with: cd \"$INSTALL_DIR\" && npm run dev"
fi
