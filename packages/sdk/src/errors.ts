export class AutoPayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'AutoPayError'
  }
}

export class AutoPayWebhookError extends AutoPayError {
  constructor(message: string) {
    super(message, 'WEBHOOK_VERIFICATION_FAILED')
    this.name = 'AutoPayWebhookError'
  }
}

export class AutoPayCheckoutError extends AutoPayError {
  constructor(message: string) {
    super(message, 'INVALID_CHECKOUT_PARAMS')
    this.name = 'AutoPayCheckoutError'
  }
}

export class AutoPayMetadataError extends AutoPayError {
  constructor(message: string) {
    super(message, 'INVALID_METADATA')
    this.name = 'AutoPayMetadataError'
  }
}
