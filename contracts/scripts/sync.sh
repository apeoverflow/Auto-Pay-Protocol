#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FRONTEND_DIR="../frontend/src/config"

echo -e "${YELLOW}Syncing contracts to frontend...${NC}"

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

echo -e "${GREEN}Sync complete!${NC}"
