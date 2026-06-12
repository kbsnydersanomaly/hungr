export type TemplateId =
  | "verification"
  | "password-reset"
  | "invitation"
  | "review-pending"
  | "payment-receipt"
  | "payment-failed"
  | "subscription-paused"
  | "subscription-cancelled"
  | "plan-changed"
  | "contact-sales"
  | "weekly-digest";

export interface MailProvider {
  send(template: TemplateId, to: string, data: Record<string, unknown>): Promise<void>;
  upsertContact?(email: string, attrs: Record<string, unknown>): Promise<void>;
}
