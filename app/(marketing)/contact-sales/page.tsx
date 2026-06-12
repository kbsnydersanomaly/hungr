import { ContactSalesForm } from "@/components/dashboard/ContactSalesForm";

export default function ContactSalesPage() {
  return (
    <div className="max-w-xl mx-auto py-24 px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Contact Sales</h1>
        <p className="mt-4 text-muted-foreground">
          Interested in Enterprise? Reach out and we&apos;ll get back to you within 24 hours.
        </p>
      </div>

      <ContactSalesForm />
    </div>
  );
}
