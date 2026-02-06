#!/bin/bash
set -e

# Reset indexer database after a new contract deployment
# This clears all indexed data and resets the indexer to start from the new deploy block

# load .env if exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    # Default to local docker-compose setup
    DATABASE_URL="postgres://autopay:password@localhost:5432/autopay"
    echo -e "${YELLOW}Using default DATABASE_URL: $DATABASE_URL${NC}"
fi

# Get deploy block from deployment file
CHAIN_ID="${1:-5042002}"
DEPLOY_FILE="deployments/${CHAIN_ID}.json"

if [ -f "$DEPLOY_FILE" ]; then
    DEPLOY_BLOCK=$(jq -r '.deployBlock // 0' "$DEPLOY_FILE")
    CONTRACT=$(jq -r '.contracts.arcPolicyManager // "unknown"' "$DEPLOY_FILE")
    echo -e "${YELLOW}Resetting indexer for chain ${CHAIN_ID}${NC}"
    echo -e "  Contract: ${CONTRACT}"
    echo -e "  Deploy Block: ${DEPLOY_BLOCK}"
else
    echo -e "${RED}Error: Deployment file not found: ${DEPLOY_FILE}${NC}"
    echo -e "Run 'make deploy-arc' first"
    exit 1
fi

# Stop relayer if running (it will re-index immediately otherwise)
RELAYER_PIDS=$(pgrep -f "relayer.*cli\.ts\|tsx.*relayer" 2>/dev/null || true)
if [ -n "$RELAYER_PIDS" ]; then
    echo -e "${YELLOW}Stopping relayer (PIDs: $RELAYER_PIDS)...${NC}"
    echo "$RELAYER_PIDS" | xargs kill 2>/dev/null || true
    sleep 1
    echo "  ✓ Relayer stopped"
fi

echo ""
echo -e "${YELLOW}Clearing indexer database...${NC}"

# Run SQL to reset the database
psql "$DATABASE_URL" << EOF
-- Clear all indexed data (preserving schema and merchant configs)
TRUNCATE TABLE webhooks CASCADE;
TRUNCATE TABLE charges CASCADE;
TRUNCATE TABLE policies CASCADE;

-- Reset indexer state to start from deploy block
DELETE FROM indexer_state WHERE chain_id = ${CHAIN_ID};
INSERT INTO indexer_state (chain_id, last_indexed_block, updated_at)
VALUES (${CHAIN_ID}, ${DEPLOY_BLOCK}, NOW())
ON CONFLICT (chain_id) DO UPDATE SET
  last_indexed_block = ${DEPLOY_BLOCK},
  updated_at = NOW();

-- Show current state
SELECT 'Indexer state after reset:' as message;
SELECT * FROM indexer_state;
EOF

echo ""
echo -e "${GREEN}Indexer database reset!${NC}"
echo -e "  Chain ID: ${CHAIN_ID}"
echo -e "  Starting block: ${DEPLOY_BLOCK}"
echo -e ""
echo -e "Restart the relayer to begin indexing from the new contract."
