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

DEPLOYMENT_FILE="deployments/5042002.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}Error: No deployment found. Run 'make deploy-arc' first.${NC}"
    exit 1
fi

CONTRACT=$(jq -r '.contracts.arcPolicyManager' "$DEPLOYMENT_FILE")
FEE_RECV=$(jq -r '.addresses.feeRecipient' "$DEPLOYMENT_FILE")
USDC="0x3600000000000000000000000000000000000000"

echo -e "${YELLOW}Verifying ArcPolicyManager on Blockscout...${NC}"
echo "  Contract: $CONTRACT"
echo "  USDC: $USDC"
echo "  Fee Recipient: $FEE_RECV"
echo ""

forge verify-contract \
    --chain-id 5042002 \
    --verifier blockscout \
    --verifier-url 'https://testnet.arcscan.app/api/' \
    --constructor-args $(cast abi-encode "constructor(address,address)" "$USDC" "$FEE_RECV") \
    "$CONTRACT" \
    src/ArcPolicyManager.sol:ArcPolicyManager

echo ""
echo -e "${GREEN}Verification submitted!${NC}"
echo "  View: https://testnet.arcscan.app/address/$CONTRACT"
