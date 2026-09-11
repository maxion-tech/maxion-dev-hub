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

export type OpsRole = "admin" | "user" | "none";

export interface OpsAccess {
  email: string;
  role: OpsRole;
  features: string[]; // ["*"] for admins
  allowed: boolean;
}

export const NO_ACCESS: OpsAccess = { email: "", role: "none", features: [], allowed: false };

export function canUseFeature(access: OpsAccess | null | undefined, featureId: string): boolean {
  if (!access) return false;
  return access.role === "admin" || access.features.includes("*") || access.features.includes(featureId);
}
