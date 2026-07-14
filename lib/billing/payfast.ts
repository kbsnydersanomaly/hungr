import crypto from "node:crypto";
import { env } from "@/lib/env";

export interface PayFastCheckoutArgs {
  m_payment_id: string;
  amount_cents: number;
  item_name: string;
  subscription_type?: number;
  frequency?: number;
  cycles?: number;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  cell_number?: string;
  item_description?: string;
  custom_int1?: string;
  custom_int2?: string;
  custom_int3?: string;
  custom_int4?: string;
  custom_int5?: string;
  custom_str1?: string;
  custom_str2?: string;
  custom_str3?: string;
  custom_str4?: string;
  custom_str5?: string;
  email_confirmation?: string;
  confirmation_address?: string;
  payment_method?: string;
  billing_date?: string;
  recurring_amount?: string;
}

// ── URL encoding matching PayFast's PHP urlencode() ──────────────────────
// Spaces become '+', everything else uses encodeURIComponent (uppercase hex).
function urlEncodePayFast(str: string): string {
  return encodeURIComponent(str).replace(/%20/g, "+");
}

// ── Checkout field order (documented by PayFast) ─────────────────────────
// ⚠️ Do NOT use alphabetical ordering for checkout signatures!
// https://developers.payfast.co.za/docs#step_2_signature
const CHECKOUT_FIELD_ORDER = [
  // Merchant details
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  // Buyer details
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  // Transaction details
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  // Transaction options
  "email_confirmation",
  "confirmation_address",
  // Set payment method
  "payment_method",
  // Recurring billing
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
];

/**
 * Generate a checkout form signature using PayFast's documented field order.
 * Excludes blank values and the signature itself.
 */
export function generateCheckoutSignature(
  params: Record<string, string>,
  passphrase?: string
): string {
  const fieldOrder = new Map(CHECKOUT_FIELD_ORDER.map((k, i) => [k, i]));

  const entries = Object.entries(params)
    .filter(([k, v]) => k !== "signature" && v !== "" && v != null)
    .sort((a, b) => {
      const orderA = fieldOrder.get(a[0]) ?? Infinity;
      const orderB = fieldOrder.get(b[0]) ?? Infinity;
      return orderA - orderB;
    });

  let sigString = "";
  for (const [key, value] of entries) {
    sigString += `${key}=${urlEncodePayFast(value)}&`;
  }
  sigString = sigString.slice(0, -1); // remove trailing &

  if (passphrase) {
    sigString += `&passphrase=${urlEncodePayFast(passphrase)}`;
  }

  return crypto.createHash("md5").update(sigString).digest("hex");
}

/**
 * Generate an API signature using alphabetical ordering.
 * Used for REST API calls (pause / cancel / resume subscriptions).
 */
export function generateApiSignature(
  params: Record<string, string>,
  passphrase?: string
): string {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== "signature" && v !== "" && v != null)
    .sort((a, b) => a[0].localeCompare(b[0]));

  let sigString = "";
  for (const [key, value] of entries) {
    sigString += `${key}=${urlEncodePayFast(value)}&`;
  }
  sigString = sigString.slice(0, -1);

  if (passphrase) {
    sigString += `&passphrase=${urlEncodePayFast(passphrase)}`;
  }

  return crypto.createHash("md5").update(sigString).digest("hex");
}

/**
 * Verify a webhook/ITN signature from PayFast.
 * Preserves the received parameter order and breaks at 'signature'.
 * Includes empty values (PayFast sends them in the payload).
 */
export function verifyWebhookSignature(
  rawBody: string,
  passphrase?: string
): { valid: boolean; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const entries: [string, string][] = [];
  let receivedSignature = "";

  for (const [key, value] of new URLSearchParams(rawBody)) {
    if (key === "signature") {
      receivedSignature = value;
      break;
    }
    entries.push([key, value]);
    params[key] = value;
  }

  let sigString = "";
  for (const [key, value] of entries) {
    sigString += `${key}=${urlEncodePayFast(value)}&`;
  }
  sigString = sigString.slice(0, -1);

  if (passphrase) {
    sigString += `&passphrase=${urlEncodePayFast(passphrase)}`;
  }

  const expected = crypto.createHash("md5").update(sigString).digest("hex");

  return { valid: expected === receivedSignature, params };
}

// ── Checkout URL builder ─────────────────────────────────────────────────

export function buildPayFastCheckout(args: PayFastCheckoutArgs): string {
  // Build params in the EXACT documented field order.
  const params: Record<string, string> = {};

  // Merchant details
  params.merchant_id = env.PAYFAST_MERCHANT_ID;
  params.merchant_key = env.PAYFAST_MERCHANT_KEY;
  params.return_url = args.return_url;
  params.cancel_url = args.cancel_url;
  params.notify_url = args.notify_url;

  // Buyer details (only if provided)
  if (args.name_first) params.name_first = args.name_first;
  if (args.name_last) params.name_last = args.name_last;
  if (args.email_address) params.email_address = args.email_address;
  if (args.cell_number) params.cell_number = args.cell_number;

  // Transaction details
  params.m_payment_id = args.m_payment_id;
  params.amount = (args.amount_cents / 100).toFixed(2);
  params.item_name = args.item_name;
  if (args.item_description) params.item_description = args.item_description;

  // Custom ints (only if provided)
  if (args.custom_int1) params.custom_int1 = args.custom_int1;
  if (args.custom_int2) params.custom_int2 = args.custom_int2;
  if (args.custom_int3) params.custom_int3 = args.custom_int3;
  if (args.custom_int4) params.custom_int4 = args.custom_int4;
  if (args.custom_int5) params.custom_int5 = args.custom_int5;

  // Custom strings (only if provided)
  if (args.custom_str1) params.custom_str1 = args.custom_str1;
  if (args.custom_str2) params.custom_str2 = args.custom_str2;
  if (args.custom_str3) params.custom_str3 = args.custom_str3;
  if (args.custom_str4) params.custom_str4 = args.custom_str4;
  if (args.custom_str5) params.custom_str5 = args.custom_str5;

  // Transaction options
  if (args.email_confirmation) params.email_confirmation = args.email_confirmation;
  if (args.confirmation_address)
    params.confirmation_address = args.confirmation_address;

  // Payment method
  if (args.payment_method) params.payment_method = args.payment_method;

  // Recurring billing
  params.subscription_type = String(args.subscription_type ?? 1);
  if (args.billing_date) params.billing_date = args.billing_date;
  if (args.recurring_amount) params.recurring_amount = args.recurring_amount;
  params.frequency = String(args.frequency ?? 3);
  params.cycles = String(args.cycles ?? 0);

  params.signature = generateCheckoutSignature(params, env.PAYFAST_PASSPHRASE);

  const base = env.PAYFAST_SANDBOX
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  return `${base}?${new URLSearchParams(params).toString()}`;
}

export const PAYFAST_VALID_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

export async function validateWithPayFast(payload: string): Promise<boolean> {
  const base = env.PAYFAST_SANDBOX
    ? "https://sandbox.payfast.co.za"
    : "https://www.payfast.co.za";

  try {
    const res = await fetch(`${base}/eng/query/validate`, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch {
    return false;
  }
}

export function nextBillingDate(sub: {
  current_period_end?: string | null;
  billing_period?: string | null;
}): string {
  const base = sub.current_period_end
    ? new Date(sub.current_period_end)
    : new Date();
  const period = sub.billing_period ?? "monthly";

  if (period === "monthly") {
    base.setMonth(base.getMonth() + 1);
  } else if (period === "yearly") {
    base.setFullYear(base.getFullYear() + 1);
  }

  return base.toISOString();
}

// ── Card update URL ──────────────────────────────────────────────────────
// PayFast provides a hosted page where buyers can update the card stored
// against a Recurring Billing subscription token. It is a simple redirect URL;
// no signature is required.
// See: https://github.com/PayFast/payfast-php-sdk/blob/master/lib/PaymentIntegrations/CustomIntegration.php

export function getCardUpdateUrl(token: string, returnUrl?: string): string {
  if (env.PAYFAST_SANDBOX) {
    throw new Error(
      "PayFast's hosted card-update page is not available in sandbox mode."
    );
  }

  const base = "https://www.payfast.co.za";
  let url = `${base}/eng/recurring/update/${encodeURIComponent(token)}`;
  if (returnUrl) {
    url += `?return=${encodeURIComponent(returnUrl)}`;
  }
  return url;
}

// ── Subscription replacement helpers (fallback for sandbox / card updates) ─

export function buildReplacementMPaymentId(oldSub: {
  id: string;
  payfast_token: string;
}): string {
  return `replace:${oldSub.id}:${oldSub.payfast_token}:${Date.now()}`;
}

export function isReplacementMPaymentId(mPaymentId: string): boolean {
  return mPaymentId.startsWith("replace:");
}

export function parseReplacementMPaymentId(mPaymentId: string): {
  oldSubId: string;
  oldToken: string;
} | null {
  const parts = mPaymentId.split(":");
  if (parts.length !== 4 || parts[0] !== "replace") return null;
  return { oldSubId: parts[1], oldToken: parts[2] };
}

// ── PayFast API (pause / cancel / resume) ────────────────────────────────

export const PAYFAST_API_BASE = env.PAYFAST_SANDBOX
  ? "https://sandbox.payfast.co.za"
  : "https://api.payfast.co.za";

export async function payfastApi(
  path: string,
  method: "PUT" | "GET" | "POST" = "PUT",
  body?: unknown
) {
  const ts = new Date().toISOString();

  const headers: Record<string, string> = {
    "merchant-id": env.PAYFAST_MERCHANT_ID,
    version: "v1",
    timestamp: ts,
    "content-type": "application/json",
  };

  const signaturePayload: Record<string, string> = { ...headers };
  if (body) {
    signaturePayload.body = JSON.stringify(body);
  }

  headers.signature = generateApiSignature(
    signaturePayload,
    env.PAYFAST_PASSPHRASE
  );

  const res = await fetch(`${PAYFAST_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayFast API ${res.status}: ${text}`);
  }

  return res.json();
}

export async function pauseSubscription(token: string, cycles = 1) {
  return payfastApi(`/subscriptions/${token}/pause`, "PUT", {
    token,
    cycles,
  });
}

export async function cancelSubscription(token: string) {
  return payfastApi(`/subscriptions/${token}/cancel`, "PUT");
}

export async function unpauseSubscription(token: string) {
  return payfastApi(`/subscriptions/${token}/unpause`, "PUT", { token });
}
