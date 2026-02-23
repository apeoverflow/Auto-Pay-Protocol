#!/bin/bash
set -e

# Deploy to all chains defined in chains.json

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

CHAINS=$(jq -r 'keys[]' "$REGISTRY")
TOTAL=$(echo "$CHAINS" | wc -l | tr -d ' ')
SUCCEEDED=0
FAILED=0

echo -e "${YELLOW}Deploying to $TOTAL chains...${NC}"
echo ""

for CHAIN in $CHAINS; do
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
echo -e "  Succeeded: $SUCCEEDED"
echo -e "  Failed:    $FAILED"
echo -e "  Total:     $TOTAL"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
