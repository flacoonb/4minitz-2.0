#!/bin/bash

# 4Minitz 2.0 - One-Line Installer
# Usage: curl -sL https://raw.githubusercontent.com/flacoonb/4minitz-2.0/main/install.sh | bash

set -e

REPO_URL="https://github.com/flacoonb/4minitz-2.0.git"
INSTALL_DIR="4minitz-2.0"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 4Minitz 2.0 Installer${NC}"
echo "========================"

# 1. Check Prerequisites
echo -e "\n${BLUE}🔍 Checking prerequisites...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed.${NC} Please install git first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC} Please install Node.js 18+."
    exit 1
fi

# 2. Clone Repository
if [ -d "$INSTALL_DIR" ]; then
    echo -e "\n${RED}⚠️  Directory '$INSTALL_DIR' already exists.${NC}"
    read -p "Do you want to delete it and reinstall? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "Aborting."
        exit 1
    fi
fi

echo -e "\n${BLUE}📥 Cloning repository...${NC}"
git clone "$REPO_URL" "$INSTALL_DIR"

# 3. Run Setup
echo -e "\n${BLUE}⚙️  Starting setup...${NC}"
cd "$INSTALL_DIR"
chmod +x setup.sh
./setup.sh
