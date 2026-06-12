import { env } from "@/lib/env";
import type { MailProvider, TemplateId } from "./types";
import { renderToHtml } from "./renderer";

export class BrevoMailProvider implements MailProvider {
  private apiKey = env.BREVO_API_KEY;
  private baseUrl = "https://api.brevo.com/v3";

  private async post(path: string, body: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "api-key": this.apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Brevo ${res.status}: ${text}`);
    }
    return res;
  }

  async send(template: TemplateId, to: string, data: Record<string, unknown>) {
    const { subject, html } = await renderToHtml(template, data);
    await this.post("/smtp/email", {
      sender: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
  }

  async upsertContact(email: string, attrs: Record<string, unknown>) {
    await this.post("/contacts", {
      email,
      attributes: attrs,
      updateEnabled: true,
    });
  }
}
