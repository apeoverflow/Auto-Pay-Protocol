-include .env

.PHONY: help test deploy deploy-all verify verify-check generate-abis sync clean reset-indexer-db

help:
	@echo ""
	@echo "\033[0;32mAutoPay Protocol - Contract Commands\033[0m"
	@echo ""
	@echo "\033[0;33mDevelopment:\033[0m"
	@echo "  make test                       Run all tests"
	@echo "  make clean                      Clean build artifacts"
	@echo ""
	@echo "\033[0;33mDeployment:\033[0m"
	@echo "  make deploy CHAIN=flowEvm       Deploy PolicyManager to a chain"
	@echo "  make deploy-all                 Deploy to ALL chains in chains.json"
	@echo "  make deploy                     Deploy using .env values (legacy)"
	@echo ""
	@echo "\033[0;33mVerification:\033[0m"
	@echo "  make verify CHAIN=flowEvm       Verify contract on Blockscout"
	@echo "  make verify-check CHAIN=flowEvm Check if contract is verified"
	@echo ""
	@echo "\033[0;33mSync:\033[0m"
	@echo "  make generate-abis              Generate ABI JSON files"
	@echo "  make sync                       Sync ABIs and addresses to frontend + relayer"
	@echo ""
	@echo "\033[0;33mDatabase:\033[0m"
	@echo "  make reset-indexer-db CHAIN=flowEvm  Reset indexer DB for a chain"
	@echo ""
	@echo "\033[0;33mChain registry:\033[0m  chains.json (source of truth for all chain configs)"
	@echo ""

# ==================== Development ====================

test:
	@forge test -vv

clean:
	@forge clean
	@rm -rf abis deployments

# ==================== Deployment ====================

deploy:
	@./scripts/deploy.sh $(CHAIN)

deploy-all:
	@./scripts/deploy-all.sh

verify:
	@./scripts/verify.sh $(CHAIN)

verify-check:
	@./scripts/verify-check.sh $(CHAIN)

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
	@./scripts/reset-indexer-db.sh $(CHAIN)

# ==================== Utils ====================

wallet:
	@cast wallet address --private-key $(PRIVATE_KEY)
