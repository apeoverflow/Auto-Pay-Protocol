#!/bin/bash
set -e

# load .env if exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# If a chain name is provided, resolve config from chains.json
CHAIN="${1:-}"
if [ -n "$CHAIN" ]; then
    REGISTRY="chains.json"
    if [ ! -f "$REGISTRY" ]; then
        echo -e "${RED}Error: chains.json not found${NC}"
        exit 1
    fi

    CHAIN_DATA=$(jq -r --arg c "$CHAIN" '.[$c] // empty' "$REGISTRY")
    if [ -z "$CHAIN_DATA" ]; then
        AVAILABLE=$(jq -r 'keys | join(", ")' "$REGISTRY")
        echo -e "${RED}Error: Unknown chain '$CHAIN'. Available: $AVAILABLE${NC}"
        exit 1
    fi

    CHAIN_ID=$(echo "$CHAIN_DATA" | jq -r '.chainId')
    VERIFIER_URL=$(echo "$CHAIN_DATA" | jq -r '.verifierUrl')
    EXPLORER_URL=$(echo "$CHAIN_DATA" | jq -r '.blockExplorer')
else
    CHAIN_ID="${CHAIN_ID:-747}"
fi

DEPLOYMENT_FILE="deployments/${CHAIN_ID}.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}Error: No deployment found at ${DEPLOYMENT_FILE}. Run 'make deploy' first.${NC}"
    exit 1
fi

CONTRACT=$(jq -r '.contracts.policyManager' "$DEPLOYMENT_FILE")

if [ -z "$VERIFIER_URL" ]; then
    echo -e "${RED}Error: VERIFIER_URL not set (provide CHAIN arg or set in .env)${NC}"
    exit 1
fi

echo "Checking verification status for $CONTRACT..."

RESULT=$(curl -s "${VERIFIER_URL}/v2/smart-contracts/$CONTRACT" | jq -r '.is_verified // false')

if [ "$RESULT" = "true" ]; then
    echo -e "${GREEN}Contract is verified${NC}"
    echo "  View: ${EXPLORER_URL}/address/$CONTRACT"
else
    echo -e "${RED}Contract is not verified${NC}"
    echo "  Run 'make verify CHAIN=$CHAIN' to verify"
    exit 1
fi
