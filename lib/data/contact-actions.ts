"use server";

import { ValidationError, safeAction } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";

export async function submitContactSales(formData: FormData) {
  return safeAction(async () => {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const company = String(formData.get("company") ?? "").trim() || undefined;
    const message = String(formData.get("message") ?? "").trim();

    if (!name) throw new ValidationError("Name is required.");
    if (!email) throw new ValidationError("Email is required.");
    if (!message) throw new ValidationError("Message is required.");

    await sendMail("contact-sales", env.MAIL_FROM, {
      name,
      email,
      company,
      message,
    });

    return { sent: true };
  });
}
