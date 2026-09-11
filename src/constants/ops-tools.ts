// Registry of Ops Tools features. Feature id == TabId of the tool.
// Access per email is managed in the Access Control tab (stored in maxion-platform-support).
export interface OpsFeature {
  id: string;
  label: string;
  description: string;
}

export const OPS_FEATURES: OpsFeature[] = [
  { id: "nft-ownership", label: "NFT Ownership Check", description: "Verify what a wallet holds and what happened to reported NFTs" },
  { id: "webhook-replay", label: "Webhook Replay", description: "Rescan a tx and replay ROLA/ROLG webhooks" },
];

export type OpsRole = "admin" | "user";

export interface OpsAccess {
  email: string;
  role: OpsRole;
  grants: string[]; // explicit per-email grants (["*"] for admins)
  restricted: string[]; // features that require a grant; everything else is open to all signed-in users
}

export const NO_ACCESS: OpsAccess = { email: "", role: "user", grants: [], restricted: [] };

/** Usable when admin, or the feature is not restricted, or it was granted to this email. */
export function canUseFeature(access: OpsAccess | null | undefined, featureId: string): boolean {
  if (!access) return false;
  if (access.role === "admin" || access.grants.includes("*")) return true;
  if (!access.restricted.includes(featureId)) return true;
  return access.grants.includes(featureId);
}
