import { Resend } from "resend";
import { env } from "@/lib/env";
import type { MailProvider, TemplateId } from "./types";
import { renderToHtml } from "./renderer";

export class ResendMailProvider implements MailProvider {
  private client = new Resend(env.RESEND_API_KEY);

  async send(template: TemplateId, to: string, data: Record<string, unknown>) {
    const { subject, html } = await renderToHtml(template, data);
    const { error } = await this.client.emails.send({
      from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM}>`,
      to,
      subject,
      html,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
  }
}
