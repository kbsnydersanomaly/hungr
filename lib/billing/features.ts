import { loadActivePlanForOrg } from "./pricing";
import { BillingError } from "@/lib/errors";

export async function hasFeature(
  orgId: string,
  key: string
): Promise<boolean> {
  const plan = await loadActivePlanForOrg(orgId);
  return Boolean(plan?.features?.[key]);
}

export async function requireFeature(orgId: string, key: string) {
  if (!(await hasFeature(orgId, key))) {
    throw new BillingError(`Plan does not include ${key}`);
  }
}

export async function getFeatureLimit(
  orgId: string,
  key: string
): Promise<number | null> {
  const plan = await loadActivePlanForOrg(orgId);
  const value = plan?.features?.[key];
  if (typeof value === "number") return value;
  return null;
}
