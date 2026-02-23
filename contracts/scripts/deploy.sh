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

    RPC_URL=$(echo "$CHAIN_DATA" | jq -r '.rpcUrl')
    USDC_ADDRESS=$(echo "$CHAIN_DATA" | jq -r '.usdc')
    CHAIN_NAME="$CHAIN"

    echo -e "${YELLOW}Resolved from chains.json:${NC}"
    echo -e "  Chain:  $CHAIN_NAME ($(echo "$CHAIN_DATA" | jq -r '.chainId'))"
    echo -e "  RPC:    $RPC_URL"
    echo -e "  USDC:   $USDC_ADDRESS"
    echo ""
fi

# check required env vars
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set${NC}"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    echo -e "${RED}Error: RPC_URL not set (provide CHAIN arg or set in .env)${NC}"
    exit 1
fi

if [ -z "$FEE_RECIPIENT" ]; then
    echo -e "${RED}Error: FEE_RECIPIENT not set${NC}"
    exit 1
fi

if [ -z "$USDC_ADDRESS" ]; then
    echo -e "${RED}Error: USDC_ADDRESS not set (provide CHAIN arg or set in .env)${NC}"
    exit 1
fi

echo -e "${YELLOW}Deploying PolicyManager...${NC}"
mkdir -p deployments

# deploy and capture output
OUTPUT=$(forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    -vvv 2>&1)

echo "$OUTPUT"

# parse deployment output
CHAIN_ID=$(echo "$OUTPUT" | grep "CHAIN_ID:" | awk '{print $2}')
MANAGER=$(echo "$OUTPUT" | grep "POLICY_MANAGER:" | awk '{print $2}')
USDC=$(echo "$OUTPUT" | grep "USDC:" | awk '{print $2}')
FEE_RECV=$(echo "$OUTPUT" | grep "FEE_RECIPIENT:" | awk '{print $2}')
DEPLOYER=$(echo "$OUTPUT" | grep "DEPLOYER:" | awk '{print $2}')

if [ -z "$MANAGER" ]; then
    echo -e "${RED}Error: Failed to parse deployment address${NC}"
    exit 1
fi

# Get deploy block from transaction receipt
TX_HASH=$(jq -r '.transactions[0].hash' "broadcast/Deploy.s.sol/${CHAIN_ID}/run-latest.json")
DEPLOY_BLOCK=$(cast receipt "$TX_HASH" --rpc-url "$RPC_URL" 2>/dev/null | grep "blockNumber" | head -1 | awk '{print $2}')

if [ -z "$DEPLOY_BLOCK" ]; then
    echo -e "${YELLOW}Warning: Could not fetch deploy block, using 0${NC}"
    DEPLOY_BLOCK=0
fi

# save deployment info
cat > "deployments/${CHAIN_ID}.json" << EOF
{
  "chainId": ${CHAIN_ID},
  "chainName": "${CHAIN_NAME:-default}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "${DEPLOYER}",
  "deployBlock": ${DEPLOY_BLOCK},
  "contracts": {
    "policyManager": "${MANAGER}"
  },
  "addresses": {
    "usdc": "${USDC}",
    "feeRecipient": "${FEE_RECV}"
  }
}
EOF

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "  Contract: ${MANAGER}"
echo -e "  Block: ${DEPLOY_BLOCK}"
echo -e "  Saved to: deployments/${CHAIN_ID}.json"
