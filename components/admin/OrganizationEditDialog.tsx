"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganization } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface OrganizationEditDialogProps {
  org: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    plan_id: string | null;
  };
}

export function OrganizationEditDialog({ org }: OrganizationEditDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        <ServerActionForm
          action={async (formData) => {
            const result = await updateOrganization(org.id, formData);
            return result;
          }}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          successMessage="Organization updated."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={org.name} required />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={org.slug} required />
            </div>
            <div>
              <Label htmlFor="owner_id">Owner ID</Label>
              <Input id="owner_id" name="owner_id" defaultValue={org.owner_id} required />
            </div>
            <div>
              <Label htmlFor="plan_id">Plan ID (optional)</Label>
              <Input id="plan_id" name="plan_id" defaultValue={org.plan_id ?? ""} />
            </div>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ServerActionForm>
      </DialogContent>
    </Dialog>
  );
}
