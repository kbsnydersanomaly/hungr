import type { TemplateId } from "./types";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const TEMPLATE_FIXTURES: Record<
  TemplateId,
  Record<string, unknown>
> = {
  verification: {
    confirm_url: `${baseUrl}/auth/confirm?token=sample-token`,
  },
  "password-reset": {
    reset_url: `${baseUrl}/auth/reset?token=sample-token`,
  },
  invitation: {
    org_name: "Paperjet Studios",
    inviter_name: "KB",
    role: "admin",
    invite_url: `${baseUrl}/invite/accept?token=sample-token`,
  },
  "review-pending": {
    restaurant_name: "The Hungry Fox",
    reviews_url: `${baseUrl}/dashboard/reviews`,
  },
  "payment-receipt": {
    invoice_number: "HUNGR-2026-00042",
    amount: "R 999.00",
    period: "1 Mar 2026 – 31 Mar 2026",
  },
  "payment-failed": {
    billing_url: `${baseUrl}/dashboard/billing`,
  },
  "subscription-paused": {
    restaurant_name: "The Hungry Fox",
    billing_url: `${baseUrl}/dashboard/billing`,
  },
  "subscription-cancelled": {
    restaurant_name: "The Hungry Fox",
    billing_url: `${baseUrl}/dashboard/billing`,
  },
  "plan-changed": {
    old_plan: "Starter",
    new_plan: "Growth",
  },
  "contact-sales": {
    name: "Jane Doe",
    email: "jane@example.com",
    company: "Acme Restaurants",
    message:
      "We operate 12 locations and would like to discuss enterprise pricing.",
  },
  "weekly-digest": {
    restaurant_name: "The Hungry Fox",
    views: 1247,
    new_reviews: 8,
    dashboard_url: `${baseUrl}/dashboard`,
  },
};
