#!/bin/bash
set -e

# Deploy to all chains defined in chains.json that don't already have a deployment

# colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

REGISTRY="chains.json"
if [ ! -f "$REGISTRY" ]; then
    echo -e "${RED}Error: chains.json not found${NC}"
    exit 1
fi

CHAINS=$(jq -r 'to_entries[] | select(.value.enabled != false) | .key' "$REGISTRY")
TOTAL=$(echo "$CHAINS" | wc -l | tr -d ' ')
SUCCEEDED=0
FAILED=0
SKIPPED=0

echo -e "${YELLOW}Deploying to $TOTAL enabled chains...${NC}"
echo ""

for CHAIN in $CHAINS; do
    CHAIN_ID=$(jq -r --arg c "$CHAIN" '.[$c].chainId' "$REGISTRY")
    DEPLOY_FILE="deployments/${CHAIN_ID}.json"

    if [ -f "$DEPLOY_FILE" ]; then
        EXISTING=$(jq -r '.contracts.policyManager // empty' "$DEPLOY_FILE")
        if [ -n "$EXISTING" ]; then
            echo -e "${YELLOW}━━━ $CHAIN ━━━${NC}"
            echo -e "  Skipped (already deployed: $EXISTING)"
            echo ""
            SKIPPED=$((SKIPPED + 1))
            continue
        fi
    fi

    echo -e "${YELLOW}━━━ Deploying to $CHAIN ━━━${NC}"
    if ./scripts/deploy.sh "$CHAIN"; then
        SUCCEEDED=$((SUCCEEDED + 1))
    else
        echo -e "${RED}Failed to deploy to $CHAIN${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo -e "${GREEN}━━━ Deploy Summary ━━━${NC}"
echo -e "  Deployed: $SUCCEEDED"
echo -e "  Skipped:  $SKIPPED"
echo -e "  Failed:   $FAILED"
echo -e "  Total:    $TOTAL"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
