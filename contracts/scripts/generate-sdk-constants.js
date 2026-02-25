#!/usr/bin/env node

const fs = require('fs');

const REGISTRY_FILE = 'chains.json';
const OUTPUT_FILE = '../packages/sdk/src/constants.ts';

const START_MARKER = '// --- AUTO-GENERATED CHAIN CONFIG (start) ---';
const END_MARKER = '// --- AUTO-GENERATED CHAIN CONFIG (end) ---';

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error('Error: chains.json not found');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
}

function generate() {
  const registry = loadRegistry();
  const allChains = Object.entries(registry);

  // Validate required fields
  for (const [key, chain] of allChains) {
    if (!chain.checkoutBaseUrl) {
      console.error(`Error: Chain '${key}' is missing required field: checkoutBaseUrl`);
      process.exit(1);
    }
  }

  // Build the chain config entries
  const chainEntries = allChains.map(([key, chain]) => {
    return `  ${key}: {
    name: '${esc(chain.name)}',
    chainId: ${chain.chainId},
    usdc: '${chain.usdc}',
    explorer: '${esc(chain.blockExplorer)}',
    checkoutBaseUrl: '${esc(chain.checkoutBaseUrl)}',
  }`;
  }).join(',\n');

  // Build the ChainKey union type from all chain keys
  const chainKeyUnion = allChains.map(([key]) => `'${key}'`).join(' | ');

  const generatedSection = `${START_MARKER}
// Do not edit manually - run 'make sync' in contracts/ to regenerate

export interface ChainConfig {
  name: string
  chainId: number
  usdc: string
  explorer: string
  checkoutBaseUrl: string
}

export type ChainKey = ${chainKeyUnion}

export const chains: Record<ChainKey, ChainConfig> = {
${chainEntries}
}

/** Default chain — Base (autopayprotocol.com, no subdomain) */
export const DEFAULT_CHAIN: ChainKey = 'base'

/** Default checkout base URL (Base) */
export const DEFAULT_CHECKOUT_BASE_URL = 'https://autopayprotocol.com'

${END_MARKER}`;

  // Read existing file and replace between markers
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`Error: ${OUTPUT_FILE} not found`);
    process.exit(1);
  }

  const existing = fs.readFileSync(OUTPUT_FILE, 'utf8');
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`Error: Marker comments not found in ${OUTPUT_FILE}`);
    console.error('Expected markers:');
    console.error(`  ${START_MARKER}`);
    console.error(`  ${END_MARKER}`);
    process.exit(1);
  }

  if (startIdx >= endIdx) {
    console.error(`Error: START marker must appear before END marker in ${OUTPUT_FILE}`);
    process.exit(1);
  }

  const before = existing.substring(0, startIdx);
  const after = existing.substring(endIdx + END_MARKER.length);

  const output = before + generatedSection + after;
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`  ✓ Generated chain config in ${OUTPUT_FILE}`);
}

generate();
