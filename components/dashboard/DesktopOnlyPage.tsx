"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Monitor } from "lucide-react";

interface DesktopOnlyPageProps {
  title: string;
  children: React.ReactNode;
  seeCurrentHref?: string;
  seeCurrentLabel?: string;
  mobileExtra?: React.ReactNode;
}

export function DesktopOnlyPage({
  title,
  children,
  seeCurrentHref,
  seeCurrentLabel,
  mobileExtra,
}: DesktopOnlyPageProps) {
  const currentLink = seeCurrentHref ? (
    <Link
      href={seeCurrentHref}
      className="underline underline-offset-4 hover:text-foreground"
    >
      {seeCurrentLabel ?? "see current"}
    </Link>
  ) : null;

  return (
    <>
      <div className="hidden lg:block">{children}</div>

      <div className="block lg:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              {title}
            </CardTitle>
            <CardDescription>
              The {title.toLowerCase()} editor needs a bigger screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {currentLink ? (
                <>
                  You can {currentLink} or manage this from a desktop.
                </>
              ) : (
                <>Please manage this from a desktop.</>
              )}
            </p>
            {mobileExtra}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
