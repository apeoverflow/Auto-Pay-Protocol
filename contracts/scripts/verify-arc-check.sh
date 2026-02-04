#!/bin/bash
set -e

# colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOYMENT_FILE="deployments/5042002.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}Error: No deployment found. Run 'make deploy-arc' first.${NC}"
    exit 1
fi

CONTRACT=$(jq -r '.contracts.arcPolicyManager' "$DEPLOYMENT_FILE")

echo "Checking verification status for $CONTRACT..."

RESULT=$(curl -s "https://testnet.arcscan.app/api/v2/smart-contracts/$CONTRACT" | jq -r '.is_verified // false')

if [ "$RESULT" = "true" ]; then
    echo -e "${GREEN}✓ Contract is verified${NC}"
    echo "  View: https://testnet.arcscan.app/address/$CONTRACT"
else
    echo -e "${RED}✗ Contract is not verified${NC}"
    echo "  Run 'make verify-arc' to verify"
    exit 1
fi
