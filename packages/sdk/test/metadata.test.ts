import { describe, it, expect } from 'vitest'
import { validateMetadata, createMetadata } from '../src/metadata'

describe('validateMetadata', () => {
  const validMetadata = {
    version: '1.0',
    plan: {
      name: 'Pro Plan',
      description: 'Access to all premium features',
    },
    merchant: {
      name: 'Acme Corp',
    },
  }

  it('accepts valid metadata', () => {
    const result = validateMetadata(validMetadata)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts metadata with all optional fields', () => {
    const result = validateMetadata({
      ...validMetadata,
      plan: {
        ...validMetadata.plan,
        tier: 'pro',
        features: ['Feature 1', 'Feature 2'],
      },
      merchant: {
        ...validMetadata.merchant,
        logo: 'https://example.com/logo.png',
        website: 'https://example.com',
        supportEmail: 'support@example.com',
      },
      display: {
        color: '#6366F1',
        badge: 'Most Popular',
      },
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects non-object', () => {
    expect(validateMetadata(null).valid).toBe(false)
    expect(validateMetadata('string').valid).toBe(false)
    expect(validateMetadata(42).valid).toBe(false)
  })

  it('rejects missing version', () => {
    const { version, ...noVersion } = validMetadata
    const result = validateMetadata(noVersion)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('version'))).toBe(true)
  })

  it('rejects missing plan.name', () => {
    const result = validateMetadata({
      ...validMetadata,
      plan: { description: 'desc' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('plan.name'))).toBe(true)
  })

  it('rejects missing merchant.name', () => {
    const result = validateMetadata({
      ...validMetadata,
      merchant: {},
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('merchant.name'))).toBe(true)
  })

  it('rejects non-string features', () => {
    const result = validateMetadata({
      ...validMetadata,
      plan: { ...validMetadata.plan, features: [1, 2, 3] },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('features'))).toBe(true)
  })

  it('rejects non-object display', () => {
    const result = validateMetadata({
      ...validMetadata,
      display: 'invalid',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('display'))).toBe(true)
  })
})

describe('createMetadata', () => {
  it('creates minimal metadata', () => {
    const metadata = createMetadata({
      planName: 'Pro',
      planDescription: 'All features',
      merchantName: 'Acme',
    })

    expect(metadata.version).toBe('1.0')
    expect(metadata.plan.name).toBe('Pro')
    expect(metadata.plan.description).toBe('All features')
    expect(metadata.merchant.name).toBe('Acme')
    expect(metadata.display).toBeUndefined()
  })

  it('includes optional fields', () => {
    const metadata = createMetadata({
      planName: 'Pro',
      planDescription: 'All features',
      merchantName: 'Acme',
      tier: 'pro',
      features: ['Feature 1'],
      logo: 'https://example.com/logo.png',
      website: 'https://example.com',
      supportEmail: 'support@example.com',
      color: '#6366F1',
      badge: 'Popular',
    })

    expect(metadata.plan.tier).toBe('pro')
    expect(metadata.plan.features).toEqual(['Feature 1'])
    expect(metadata.merchant.logo).toBe('https://example.com/logo.png')
    expect(metadata.display?.color).toBe('#6366F1')
    expect(metadata.display?.badge).toBe('Popular')
  })

  it('validates against own schema', () => {
    const metadata = createMetadata({
      planName: 'Pro',
      planDescription: 'All features',
      merchantName: 'Acme',
    })
    const result = validateMetadata(metadata)
    expect(result.valid).toBe(true)
  })
})
