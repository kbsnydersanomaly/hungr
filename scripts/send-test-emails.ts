/**
 * Send sample emails for every template via the configured mail provider.
 *
 * Usage:
 *   pnpm mail:test
 *   pnpm mail:test kb@paperjetstudios.co.za
 *   pnpm mail:test kb@paperjetstudios.co.za verification invitation
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { sendMail } from "@/lib/mail";
import { TEMPLATE_FIXTURES } from "@/lib/mail/fixtures";
import type { TemplateId } from "@/lib/mail/types";
import { env } from "@/lib/env";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const DEFAULT_TO = "kb@paperjetstudios.co.za";
const ALL_TEMPLATES = Object.keys(TEMPLATE_FIXTURES) as TemplateId[];

function parseArgs(argv: string[]) {
  const to = argv[0]?.includes("@") ? argv[0] : DEFAULT_TO;
  const templateArgs = argv[0]?.includes("@") ? argv.slice(1) : argv;
  const templates =
    templateArgs.length > 0
      ? (templateArgs.filter((t) =>
          ALL_TEMPLATES.includes(t as TemplateId)
        ) as TemplateId[])
      : ALL_TEMPLATES;

  const unknown = templateArgs.filter(
    (t) => !ALL_TEMPLATES.includes(t as TemplateId)
  );
  if (unknown.length > 0) {
    console.warn(`Skipping unknown templates: ${unknown.join(", ")}`);
  }

  return { to, templates };
}

async function main() {
  const { to, templates } = parseArgs(process.argv.slice(2));

  if (env.MAIL_PROVIDER === "brevo" && !env.BREVO_API_KEY) {
    throw new Error("MAIL_PROVIDER=brevo but BREVO_API_KEY is not set");
  }

  console.log(
    `Sending ${templates.length} test email(s) to ${to} via ${env.MAIL_PROVIDER} (from ${env.MAIL_FROM})…\n`
  );

  for (const template of templates) {
    process.stdout.write(`  • ${template}… `);
    try {
      await sendMail(template, to, TEMPLATE_FIXTURES[template]);
      console.log("sent");
      // Avoid Brevo/inbox throttling when sending many templates at once.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.log("failed");
      throw err;
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nError:", err instanceof Error ? err.message : err);
  process.exit(1);
});
