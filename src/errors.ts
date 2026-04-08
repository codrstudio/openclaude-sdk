// ---------------------------------------------------------------------------
// Typed error hierarchy for openclaude-sdk
// ---------------------------------------------------------------------------

export class OpenClaudeError extends Error {
  readonly code: string
  readonly sessionId: string | null
  readonly costUsd: number
  readonly durationMs: number

  constructor(params: {
    message: string
    code: string
    sessionId?: string | null
    costUsd?: number
    durationMs?: number
    cause?: unknown
  }) {
    super(params.message, { cause: params.cause })
    this.name = this.constructor.name
    this.code = params.code
    this.sessionId = params.sessionId ?? null
    this.costUsd = params.costUsd ?? 0
    this.durationMs = params.durationMs ?? 0
    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class AuthenticationError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "authentication_failed" })
  }
}

export class BillingError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "billing_error" })
  }
}

export class RateLimitError extends OpenClaudeError {
  readonly resetsAt?: number
  readonly utilization?: number

  constructor(
    params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code"> & {
      resetsAt?: number
      utilization?: number
    }
  ) {
    super({ ...params, code: "rate_limit" })
    this.resetsAt = params.resetsAt
    this.utilization = params.utilization
  }
}

export class InvalidRequestError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "invalid_request" })
  }
}

export class ServerError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "server_error" })
  }
}

export class MaxTurnsError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "max_turns" })
  }
}

export class MaxBudgetError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "max_budget_usd" })
  }
}

export class ExecutionError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "execution_error" })
  }
}

export class StructuredOutputError extends OpenClaudeError {
  constructor(params: Omit<ConstructorParameters<typeof OpenClaudeError>[0], "code">) {
    super({ ...params, code: "structured_output_retries" })
  }
}

// ---------------------------------------------------------------------------
// isRecoverable helper
// ---------------------------------------------------------------------------

export function isRecoverable(error: OpenClaudeError): boolean {
  return (
    error instanceof RateLimitError ||
    error instanceof ServerError ||
    error instanceof MaxTurnsError ||
    error instanceof MaxBudgetError ||
    error instanceof StructuredOutputError ||
    error instanceof ExecutionError
  )
}
