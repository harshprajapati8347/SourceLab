export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(400, message, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, message);
    this.name = "ConflictError";
  }
}

export class PaymentRequiredError extends AppError {
  constructor(
    message = "You're out of credits. Upgrade to Pro.",
    details: unknown = { code: "INSUFFICIENT_CREDITS" },
  ) {
    super(402, message, details);
    this.name = "PaymentRequiredError";
  }
}
