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

/**
 * Wrap an underlying failure (e.g. a Postgres/storage error) in a
 * ValidationError whose message includes the original reason and code, so the
 * toast and logs are actionable. Also reports the error to Sentry — safeAction
 * only auto-captures non-HungrError exceptions, so translated errors must be
 * captured explicitly.
 */
export function actionError(context: string, error: unknown): ValidationError {
  const e = error as { message?: unknown; code?: unknown } | null;
  const message = typeof e?.message === "string" ? e.message : "";
  const code = typeof e?.code === "string" ? e.code : "";
  const detail = [message, code ? `(${code})` : ""].filter(Boolean).join(" ");
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      // Sentry import failed — non-fatal
    });
  return new ValidationError(detail ? `${context}: ${detail}` : context);
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
