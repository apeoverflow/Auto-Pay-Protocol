#!/bin/bash
set -e

# colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

CHAIN_ID="${1:-747}"
DEPLOYMENT_FILE="deployments/${CHAIN_ID}.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}Error: No deployment found. Run 'make deploy' first.${NC}"
    exit 1
fi

CONTRACT=$(jq -r '.contracts.policyManager' "$DEPLOYMENT_FILE")

echo "Checking verification status for $CONTRACT..."

RESULT=$(curl -s "${VERIFIER_URL}/v2/smart-contracts/$CONTRACT" | jq -r '.is_verified // false')

if [ "$RESULT" = "true" ]; then
    echo -e "${GREEN}Contract is verified${NC}"
    echo "  View: ${EXPLORER_URL}/address/$CONTRACT"
else
    echo -e "${RED}Contract is not verified${NC}"
    echo "  Run 'make verify' to verify"
    exit 1
fi
