export const POLICY_MANAGER_ABI = [
  {
    type: 'function',
    name: 'createPolicy',
    inputs: [
      { name: 'merchant', type: 'address' },
      { name: 'chargeAmount', type: 'uint128' },
      { name: 'interval', type: 'uint32' },
      { name: 'spendingCap', type: 'uint128' },
      { name: 'metadataUrl', type: 'string' },
    ],
    outputs: [{ name: 'policyId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePolicy',
    inputs: [{ name: 'policyId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'policies',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'merchant', type: 'address' },
      { name: 'chargeAmount', type: 'uint128' },
      { name: 'spendingCap', type: 'uint128' },
      { name: 'totalSpent', type: 'uint128' },
      { name: 'interval', type: 'uint32' },
      { name: 'lastCharged', type: 'uint32' },
      { name: 'chargeCount', type: 'uint32' },
      { name: 'consecutiveFailures', type: 'uint8' },
      { name: 'endTime', type: 'uint32' },
      { name: 'active', type: 'bool' },
      { name: 'metadataUrl', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canCharge',
    inputs: [{ name: 'policyId', type: 'bytes32' }],
    outputs: [
      { name: '', type: 'bool' },
      { name: '', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PolicyCreated',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'chargeAmount', type: 'uint128', indexed: false },
      { name: 'interval', type: 'uint32', indexed: false },
      { name: 'spendingCap', type: 'uint128', indexed: false },
      { name: 'metadataUrl', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ChargeSucceeded',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'amount', type: 'uint128', indexed: false },
      { name: 'protocolFee', type: 'uint128', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PolicyRevoked',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'endTime', type: 'uint32', indexed: false },
    ],
    anonymous: false,
  },
] as const

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
