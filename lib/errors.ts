export class HungrError extends Error {
  constructor(
    public code: string,
    msg: string
  ) {
    super(msg);
    this.name = "HungrError";
  }
}

export class ValidationError extends HungrError {
  constructor(m: string) {
    super("validation", m);
  }
}

export class ForbiddenError extends HungrError {
  constructor(m = "forbidden") {
    super("forbidden", m);
  }
}

export class NotFoundError extends HungrError {
  constructor(m = "not_found") {
    super("not_found", m);
  }
}

export class BillingError extends HungrError {
  constructor(m: string) {
    super("billing", m);
  }
}

export class IntegrationError extends HungrError {
  constructor(m: string) {
    super("integration", m);
  }
}

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

export function isRedirectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return (
    e.digest === "NEXT_REDIRECT" ||
    (typeof e.message === "string" && e.message.includes("NEXT_REDIRECT"))
  );
}

export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof HungrError) {
      return { ok: false, code: err.code, message: err.message };
    }
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(err);
    } catch {
      // Sentry import failed — non-fatal
    }
    console.error(err);
    return { ok: false, code: "unknown", message: "Something went wrong." };
  }
}
