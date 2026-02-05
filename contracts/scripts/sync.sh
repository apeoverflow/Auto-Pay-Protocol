#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FRONTEND_DIR="../frontend/src/config"
RELAYER_DIR="../relayer/src"

echo -e "${YELLOW}Syncing contracts to frontend and relayer...${NC}"

# ==================== Frontend ====================
echo ""
echo "Frontend:"

# create directories
mkdir -p "$FRONTEND_DIR/abis"
mkdir -p "$FRONTEND_DIR/deployments"

# copy ABIs
if [ -d "abis" ]; then
    cp abis/*.json "$FRONTEND_DIR/abis/" 2>/dev/null || true
    echo "  ✓ ABIs copied"
else
    echo "  ⚠ No ABIs found - run 'make generate-abis' first"
fi

# copy deployment addresses
if [ -d "deployments" ]; then
    cp deployments/*.json "$FRONTEND_DIR/deployments/" 2>/dev/null || true
    echo "  ✓ Deployment addresses copied"
else
    echo "  ⚠ No deployments found - run 'make deploy-arc' first"
fi

# generate TypeScript
echo "  Generating TypeScript..."
node scripts/generate-contracts-ts.js

# ==================== Relayer ====================
echo ""
echo "Relayer:"

# create directories
mkdir -p "$RELAYER_DIR/abis"

# copy ABIs
if [ -d "abis" ]; then
    cp abis/*.json "$RELAYER_DIR/abis/" 2>/dev/null || true
    echo "  ✓ ABIs copied"
else
    echo "  ⚠ No ABIs found - run 'make generate-abis' first"
fi

# generate relayer config
echo "  Generating config..."
node scripts/generate-relayer-config.js

echo ""
echo -e "${GREEN}Sync complete!${NC}"
