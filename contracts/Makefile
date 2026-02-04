-include .env

.PHONY: help test deploy-arc verify-arc verify-arc-check generate-abis sync clean

help:
	@echo ""
	@echo "\033[0;32mAutoPay Protocol - Contract Commands\033[0m"
	@echo ""
	@echo "\033[0;33mDevelopment:\033[0m"
	@echo "  make test            Run all tests"
	@echo "  make clean           Clean build artifacts"
	@echo ""
	@echo "\033[0;33mDeployment:\033[0m"
	@echo "  make deploy-arc      Deploy ArcPolicyManager to Arc testnet"
	@echo "  make verify-arc      Verify contract on Arc explorer"
	@echo ""
	@echo "\033[0;33mSync:\033[0m"
	@echo "  make generate-abis   Generate ABI JSON files"
	@echo "  make sync            Sync ABIs and addresses to frontend"
	@echo "  make build-and-sync  Test, build, and sync to frontend"
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
	@if [ ! -f "deployments/5042002.json" ]; then \
		echo "Error: No deployment found. Run 'make deploy-arc' first."; \
		exit 1; \
	fi
	@CONTRACT=$$(jq -r '.contracts.arcPolicyManager' deployments/5042002.json) && \
	FEE_RECV=$$(jq -r '.addresses.feeRecipient' deployments/5042002.json) && \
	forge verify-contract \
		--chain-id 5042002 \
		--verifier blockscout \
		--verifier-url 'https://testnet.arcscan.app/api/' \
		--constructor-args $$(cast abi-encode "constructor(address,address)" \
			0x3600000000000000000000000000000000000000 \
			$$FEE_RECV) \
		$$CONTRACT \
		src/ArcPolicyManager.sol:ArcPolicyManager

verify-arc-check:
	@if [ ! -f "deployments/5042002.json" ]; then \
		echo "Error: No deployment found. Run 'make deploy-arc' first."; \
		exit 1; \
	fi
	@CONTRACT=$$(jq -r '.contracts.arcPolicyManager' deployments/5042002.json) && \
	echo "Checking verification for $$CONTRACT..." && \
	forge verify-check \
		--chain-id 5042002 \
		--verifier blockscout \
		--verifier-url 'https://testnet.arcscan.app/api/' \
		$${CONTRACT}6982a7c9

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


# ==================== Utils ====================

wallet:
	@cast wallet address --private-key $(PRIVATE_KEY)
