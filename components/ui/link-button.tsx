"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

function LinkButtonContent({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const { pending } = useLinkStatus();
  const iconEl = pending ? <Loader2 className="animate-spin" /> : icon;

  return (
    <>
      {iconEl && (
        <span className="inline-flex [&>svg]:h-4 [&>svg]:w-4">{iconEl}</span>
      )}
      {children}
    </>
  );
}

type LinkButtonProps = Omit<ButtonProps, "asChild"> & {
  href: string;
  icon?: React.ReactNode;
};

export function LinkButton({ href, children, icon, ...props }: LinkButtonProps) {
  return (
    <Button asChild {...props}>
      <Link href={href}>
        <LinkButtonContent icon={icon}>{children}</LinkButtonContent>
      </Link>
    </Button>
  );
}
