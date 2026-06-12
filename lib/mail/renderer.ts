import React from "react";
import { render } from "@react-email/render";
import type { TemplateId } from "./types";

const REGISTRY: Record<
  TemplateId,
  {
    subject: (data: Record<string, unknown>) => string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: () => Promise<{ default: React.FC<any> }>;
  }
> = {
  verification: {
    subject: () => "Verify your email address",
    component: () => import("@/emails/verification"),
  },
  "password-reset": {
    subject: () => "Reset your password",
    component: () => import("@/emails/password-reset"),
  },
  invitation: {
    subject: (d) => `You've been invited to ${d.org_name}`,
    component: () => import("@/emails/invitation"),
  },
  "review-pending": {
    subject: () => "New review pending moderation",
    component: () => import("@/emails/review-pending"),
  },
  "payment-receipt": {
    subject: () => "Payment receipt",
    component: () => import("@/emails/payment-receipt"),
  },
  "payment-failed": {
    subject: () => "Payment failed",
    component: () => import("@/emails/payment-failed"),
  },
  "subscription-paused": {
    subject: () => "Your subscription has been paused",
    component: () => import("@/emails/subscription-paused"),
  },
  "subscription-cancelled": {
    subject: () => "Your subscription has been cancelled",
    component: () => import("@/emails/subscription-cancelled"),
  },
  "plan-changed": {
    subject: () => "Your plan has been updated",
    component: () => import("@/emails/plan-changed"),
  },
  "contact-sales": {
    subject: (d) => `New enterprise inquiry from ${d.name}`,
    component: () => import("@/emails/contact-sales"),
  },
  "weekly-digest": {
    subject: () => "Your weekly Hungr digest",
    component: () => import("@/emails/weekly-digest"),
  },
};

export async function renderToHtml(
  template: TemplateId,
  data: Record<string, unknown>
) {
  const entry = REGISTRY[template];
  const mod = await entry.component();
  const subject = entry.subject(data);
  const html = await render(React.createElement(mod.default, data));
  return { subject, html };
}
