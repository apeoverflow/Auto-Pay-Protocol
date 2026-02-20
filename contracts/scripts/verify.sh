#!/bin/bash
set -e

# load .env if exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

CHAIN_ID="${1:-747}"
DEPLOYMENT_FILE="deployments/${CHAIN_ID}.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}Error: No deployment found. Run 'make deploy' first.${NC}"
    exit 1
fi

CONTRACT=$(jq -r '.contracts.policyManager' "$DEPLOYMENT_FILE")
FEE_RECV=$(jq -r '.addresses.feeRecipient' "$DEPLOYMENT_FILE")
USDC=$(jq -r '.addresses.usdc' "$DEPLOYMENT_FILE")

echo -e "${YELLOW}Verifying PolicyManager on Blockscout...${NC}"
echo "  Contract: $CONTRACT"
echo "  USDC: $USDC"
echo "  Fee Recipient: $FEE_RECV"
echo ""

forge verify-contract \
    --chain-id "$CHAIN_ID" \
    --verifier blockscout \
    --verifier-url "${VERIFIER_URL}" \
    --constructor-args $(cast abi-encode "constructor(address,address)" "$USDC" "$FEE_RECV") \
    "$CONTRACT" \
    src/PolicyManager.sol:PolicyManager

echo ""
echo -e "${GREEN}Verification submitted!${NC}"
echo "  View: ${EXPLORER_URL}/address/$CONTRACT"
