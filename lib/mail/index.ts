import { env } from "@/lib/env";
import type { MailProvider, TemplateId } from "./types";

let provider: MailProvider | null = null;

export async function getMailProvider(): Promise<MailProvider> {
  if (provider) return provider;

  switch (env.MAIL_PROVIDER) {
    case "brevo": {
      const { BrevoMailProvider } = await import("./brevo");
      provider = new BrevoMailProvider();
      break;
    }
    case "resend": {
      const { ResendMailProvider } = await import("./resend");
      provider = new ResendMailProvider();
      break;
    }
    case "console":
    default: {
      const { ConsoleMailProvider } = await import("./console");
      provider = new ConsoleMailProvider();
      break;
    }
  }

  if (!provider) throw new Error("Failed to initialize mail provider");
  return provider;
}

export async function sendMail(
  template: TemplateId,
  to: string,
  data: Record<string, unknown>
) {
  const mailer = await getMailProvider();
  return mailer.send(template, to, data);
}
