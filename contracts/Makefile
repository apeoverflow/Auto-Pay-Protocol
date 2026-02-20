-include .env

.PHONY: help test deploy verify verify-check generate-abis sync clean reset-indexer-db

help:
	@echo ""
	@echo "\033[0;32mAutoPay Protocol - Contract Commands\033[0m"
	@echo ""
	@echo "\033[0;33mDevelopment:\033[0m"
	@echo "  make test              Run all tests"
	@echo "  make clean             Clean build artifacts"
	@echo ""
	@echo "\033[0;33mDeployment:\033[0m"
	@echo "  make deploy            Deploy PolicyManager"
	@echo "  make verify            Verify contract on Blockscout"
	@echo "  make verify-check      Check if contract is verified"
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

deploy:
	@./scripts/deploy.sh

verify:
	@./scripts/verify.sh

verify-check:
	@./scripts/verify-check.sh

# ==================== Sync ====================

generate-abis:
	@echo "Generating ABIs..."
	@forge build
	@mkdir -p abis
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
