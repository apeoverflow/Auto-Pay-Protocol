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

# check required env vars
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set${NC}"
    exit 1
fi

if [ -z "$ARC_TESTNET_RPC" ]; then
    echo -e "${RED}Error: ARC_TESTNET_RPC not set${NC}"
    exit 1
fi

if [ -z "$FEE_RECIPIENT" ]; then
    echo -e "${RED}Error: FEE_RECIPIENT not set${NC}"
    exit 1
fi

echo -e "${YELLOW}Deploying ArcPolicyManager to Arc testnet...${NC}"
mkdir -p deployments

# deploy and capture output
OUTPUT=$(forge script script/DeployArc.s.sol \
    --rpc-url "$ARC_TESTNET_RPC" \
    --broadcast \
    -vvv 2>&1)

echo "$OUTPUT"

# parse deployment output
CHAIN_ID=$(echo "$OUTPUT" | grep "CHAIN_ID:" | awk '{print $2}')
MANAGER=$(echo "$OUTPUT" | grep "ARC_POLICY_MANAGER:" | awk '{print $2}')
USDC=$(echo "$OUTPUT" | grep "USDC:" | awk '{print $2}')
FEE_RECV=$(echo "$OUTPUT" | grep "FEE_RECIPIENT:" | awk '{print $2}')
DEPLOYER=$(echo "$OUTPUT" | grep "DEPLOYER:" | awk '{print $2}')

if [ -z "$MANAGER" ]; then
    echo -e "${RED}Error: Failed to parse deployment address${NC}"
    exit 1
fi

# save deployment info
cat > "deployments/${CHAIN_ID}.json" << EOF
{
  "chainId": ${CHAIN_ID},
  "chainName": "arcTestnet",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "${DEPLOYER}",
  "contracts": {
    "arcPolicyManager": "${MANAGER}"
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
echo -e "  Saved to: deployments/${CHAIN_ID}.json"
