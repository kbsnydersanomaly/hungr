import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { orgStructureHelpPath } from "@/lib/help/constants";

export function OrgTeamHelpBox() {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <HelpCircle className="inline-block h-4 w-4 mr-1.5 align-text-bottom" />
      Not sure who can do what? Read{" "}
      <Link
        href={orgStructureHelpPath()}
        className="underline underline-offset-2 hover:text-foreground"
      >
        How organisations, restaurants and teams fit together
      </Link>
      .
    </div>
  );
}
