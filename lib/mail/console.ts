import type { MailProvider, TemplateId } from "./types";

export class ConsoleMailProvider implements MailProvider {
  async send(template: TemplateId, to: string, data: Record<string, unknown>) {
    console.log("[MAIL] ====", template, "====");
    console.log("To:", to);
    console.log("Data:", JSON.stringify(data, null, 2));
    console.log("===========================");
  }
}
