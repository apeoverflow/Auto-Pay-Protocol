-include .env

.PHONY: help test deploy-arc verify-arc verify-arc-check generate-abis sync clean reset-indexer-db

help:
	@echo ""
	@echo "\033[0;32mAutoPay Protocol - Contract Commands\033[0m"
	@echo ""
	@echo "\033[0;33mDevelopment:\033[0m"
	@echo "  make test              Run all tests"
	@echo "  make clean             Clean build artifacts"
	@echo ""
	@echo "\033[0;33mDeployment:\033[0m"
	@echo "  make deploy-arc        Deploy ArcPolicyManager to Arc testnet"
	@echo "  make verify-arc        Verify contract on Blockscout"
	@echo "  make verify-arc-check  Check if contract is verified"
	@echo ""
	@echo "\033[0;33mSync:\033[0m"
	@echo "  make generate-abis     Generate ABI JSON files"
	@echo "  make sync              Sync ABIs and addresses to frontend + relayer"
	@echo "  make reset-indexer-db  Reset indexer DB after new deployment"
	@echo ""

# ==================== Development ====================

test:
	@forge test -vv

clean:
	@forge clean
	@rm -rf abis deployments

# ==================== Deployment ====================

deploy-arc:
	@./scripts/deploy-arc.sh

verify-arc:
	@./scripts/verify-arc.sh

verify-arc-check:
	@./scripts/verify-arc-check.sh

# ==================== Sync ====================

generate-abis:
	@echo "Generating ABIs..."
	@forge build
	@mkdir -p abis
	@jq '.abi' out/ArcPolicyManager.sol/ArcPolicyManager.json > abis/ArcPolicyManager.json
	@jq '.abi' out/PolicyManager.sol/PolicyManager.json > abis/PolicyManager.json
	@echo "  ✓ ABIs saved to abis/"

sync: generate-abis
	@./scripts/sync.sh


# ==================== Database ====================

reset-indexer-db:
	@./scripts/reset-indexer-db.sh

# ==================== Utils ====================

wallet:
	@cast wallet address --private-key $(PRIVATE_KEY)
