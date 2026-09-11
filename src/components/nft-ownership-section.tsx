"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  ArrowLeftRight,
  Flame,
  Wallet,
  ShoppingCart,
  HandCoins,
  PackagePlus,
  Inbox,
  Store,
  List,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { Dropdown } from "@/components/ui/dropdown";
import { platformSupportApi } from "@/lib/platform-support";

// ─── Types (mirror maxion-platform-support /api/check) ─────────

interface Hop {
  n: number;
  block: number;
  time?: string;
  tx: string;
  from: string;
  to: string;
  amount: string;
  fromKind: "mint" | "user" | "eoa" | "contract" | "unknown";
  toKind: "burn" | "user" | "eoa" | "contract" | "unknown";
  operator?: string;
}

interface Holder {
  address: string;
  kind: string;
  fromHistory: string;
  onchain: string;
  verified: boolean;
}

type TokenStatus = "held_by_user" | "burned" | "transferred" | "never_owned" | "unknown";

interface TokenTrace {
  tokenId: string;
  hops: Hop[] | null;
  userBalance: string;
  userLastOut: Hop | null;
  holders: Holder[] | null;
  finalVerified: boolean;
  status: TokenStatus;
  error?: string;
}

interface HoldingRow {
  tokenId: string;
  onchain: string;
  moralisWallet?: string;
  status: "held" | "not_held";
  flags?: string[];
}

interface CheckData {
  holdings: {
    block: number;
    rows: HoldingRow[];
    heldCount: number;
    heldTotal: string;
    candidateIds: number;
    moralisWalletCount: number;
    errors?: Record<string, string>;
  };
  trace?: { block: number; tokens: TokenTrace[] };
  traceError?: string;
}

interface Meta {
  recordId: string;
  kind: string;
  cached: boolean;
  createdAt: string;
  cu: number;
  store: string;
  by?: string;
  note?: string;
}

interface Envelope {
  meta: Meta;
  data: CheckData;
}

interface HistoryRecord {
  id: string;
  kind: string;
  contract: string;
  wallet: string;
  ids?: string[];
  createdAt: string;
  by?: string;
  note?: string;
  cu: number;
  summary?: {
    held?: number;
    tokens?: number;
    status?: Record<string, number>;
  };
}

// ─── Collections ───────────────────────────────────────────────
// Backend currently queries BSC mainnet only.

interface Collection {
  id: string;
  label: string;
  address: string;
}

const COLLECTIONS: Collection[] = [
  { id: "landverse-bsc", label: "Landverse NFT · BSC mainnet", address: "0xd0cA77B8202FB3604C96D00ae1e2124446361F69" },
  { id: "custom", label: "Custom contract address…", address: "" },
];

// Operators we can name with confidence from observed behaviour.
const OPERATOR_LABELS: Record<string, string> = {
  "0x399f175d7a5dcdc58099d40e5f5ef7ef34850c73": "Redeem contract",
  "0xeeeeeeebcc658a3bdc41a20be33f5918178d9d5e": "Minter",
  "0xb5d2fc5628ae5537a9c62e9fca1c242b470d455a": "Maxion Marketplace",
};
const MARKETPLACE = "0xb5d2fc5628ae5537a9c62e9fca1c242b470d455a";

// ─── API ───────────────────────────────────────────────────────
// All calls go through the Next.js proxy; see src/lib/platform-support.ts.

const api = <T,>(path: string, params: Record<string, string>) => platformSupportApi<T>(path, { params });

// ─── Helpers ───────────────────────────────────────────────────

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "unknown date";
const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB") : "");
const parseIds = (s: string) => Array.from(new Set(s.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => /^\d+$/.test(x))));
const bscAddr = (a: string) => `https://bscscan.com/address/${a}`;
const bscTx = (h: string) => `https://bscscan.com/tx/${h}`;

const inputClass =
  "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/20 transition-colors";

interface StatusMeta {
  label: string;
  tone: "success" | "info" | "primary" | "destructive" | "warning" | "muted";
  Icon: typeof CheckCircle2;
}

const STATUS_META: Record<TokenStatus, StatusMeta> = {
  held_by_user: { label: "In wallet", tone: "success", Icon: CheckCircle2 },
  burned: { label: "Redeemed into game", tone: "destructive", Icon: Flame },
  transferred: { label: "Sent to another wallet", tone: "warning", Icon: Send },
  never_owned: { label: "Never in this wallet", tone: "destructive", Icon: AlertTriangle },
  unknown: { label: "Unknown", tone: "muted", Icon: HelpCircle },
};

const toneClass: Record<StatusMeta["tone"], string> = {
  success: "bg-success/10 text-success border-success/20",
  info: "bg-info/10 text-info border-info/20",
  primary: "bg-primary/10 text-primary border-primary/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  muted: "bg-secondary text-muted-foreground border-border",
};

function StatusPill({ status }: { status: TokenStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.unknown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneClass[m.tone])}>
      <m.Icon className="h-3.5 w-3.5" />
      {m.label}
    </span>
  );
}

function AddrLink({ a, label }: { a: string; label?: string }) {
  return (
    <a href={bscAddr(a)} target="_blank" rel="noopener noreferrer" className="font-mono text-info hover:underline inline-flex items-center gap-1" title={a}>
      {label ?? short(a)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function CopyButton({ text, label = "Copy reply" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Copied");
          setTimeout(() => setDone(false), 2000);
        } catch {
          toast.error("Could not copy");
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

function TxLink({ tx }: { tx: string }) {
  return (
    <a href={bscTx(tx)} target="_blank" rel="noopener noreferrer" className="text-info hover:underline inline-flex items-center gap-1 text-xs">
      view tx <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/** One plain-English sentence support staff can paste into a reply. */
function explain(t: TokenTrace, wallet: string): string {
  const hops = t.hops ?? [];
  const last = hops[hops.length - 1];
  const lastOut = t.userLastOut;
  switch (t.status) {
    case "held_by_user":
      return `This wallet currently owns NFT #${t.tokenId} (verified on-chain).`;
    case "burned": {
      if (lastOut && lastOut.toKind === "burn") {
        return `NFT #${t.tokenId} was redeemed into the game by this wallet on ${fmtDate(lastOut.time)}. It no longer exists on-chain — check the in-game item delivery instead.`;
      }
      const who = last?.from && last.from.toLowerCase() !== wallet.toLowerCase() ? ` by wallet ${short(last.from)}` : "";
      return `NFT #${t.tokenId} was redeemed into the game${who} on ${fmtDate(last?.time)}. It no longer exists on-chain.`;
    }
    case "transferred": {
      const holder = (t.holders ?? [])[0];
      const to = lastOut ? short(lastOut.to) : holder ? short(holder.address) : "another wallet";
      const when = lastOut ? ` on ${fmtDate(lastOut.time)}` : "";
      const ver = holder?.verified ? " That wallet still holds it (verified on-chain)." : "";
      return `This wallet sent NFT #${t.tokenId} to ${to}${when}.${ver}`;
    }
    case "never_owned": {
      const holder = (t.holders ?? [])[0];
      const now = last?.toKind === "burn" ? "It has since been redeemed into the game." : holder ? `It is currently held by ${short(holder.address)}.` : "";
      return `NFT #${t.tokenId} was never received by this wallet — it may belong to a different wallet of the user. ${now}`.trim();
    }
    default:
      return `Could not determine what happened to NFT #${t.tokenId}.`;
  }
}

interface HopView {
  title: string;
  detail: ReactNode;
  tone: StatusMeta["tone"];
  Icon: typeof CheckCircle2;
  touchesUser: boolean;
}

/** Highlighted chip so the user's wallet jumps out when scanning a journey. */
function UserChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-1.5 py-px font-semibold text-primary">
      <Wallet className="h-3 w-3" /> user&apos;s wallet
    </span>
  );
}

/** Turn a raw transfer into a step a non-technical reader can follow. */
function describeHop(h: Hop, wallet: string): HopView {
  const isUser = (a: string) => a.toLowerCase() === wallet.toLowerCase();
  const who = (a: string, kind: string): ReactNode =>
    isUser(a) ? <UserChip /> : kind === "contract" ? <>a contract ({short(a)})</> : <>another wallet ({short(a)})</>;
  const op = h.operator ? OPERATOR_LABELS[h.operator.toLowerCase()] : undefined;
  const via = op ? ` · via ${op}` : "";
  const qty = h.amount !== "1" ? ` · ×${h.amount}` : "";
  const touchesUser = isUser(h.from) || isUser(h.to);
  const viaMarketplace = h.operator?.toLowerCase() === MARKETPLACE;

  if (h.toKind === "burn") {
    return {
      title: "Redeemed into game",
      detail: (
        <>
          Burned by {who(h.from, h.fromKind)}
          {via}
          {qty}. The NFT no longer exists on-chain.
        </>
      ),
      tone: "destructive",
      Icon: Flame,
      touchesUser,
    };
  }
  if (h.fromKind === "mint") {
    return {
      title: isUser(h.to) ? "Minted straight into the user's wallet" : "Minted",
      detail: isUser(h.to) ? (
        <>
          Created on-chain and delivered to {who(h.to, h.toKind)}
          {via}
          {qty}.
        </>
      ) : (
        <>
          Created on-chain and first held by {who(h.to, h.toKind)}
          {via}
          {qty}.
        </>
      ),
      tone: "success",
      Icon: PackagePlus,
      touchesUser,
    };
  }
  if (isUser(h.to)) {
    return {
      title: viaMarketplace ? "Bought on the Maxion Marketplace" : "Received into the user's wallet",
      detail: viaMarketplace ? (
        <>
          {who(h.to, h.toKind)} bought it from {who(h.from, h.fromKind)}
          {qty}.
        </>
      ) : (
        <>
          {who(h.to, h.toKind)} received it from {who(h.from, h.fromKind)}
          {via}
          {qty}.
        </>
      ),
      tone: "success",
      Icon: viaMarketplace ? ShoppingCart : Inbox,
      touchesUser,
    };
  }
  if (isUser(h.from)) {
    return {
      title: viaMarketplace ? "Sold on the Maxion Marketplace" : "Sent out of the user's wallet",
      detail: viaMarketplace ? (
        <>
          {who(h.from, h.fromKind)} sold it to {who(h.to, h.toKind)}
          {qty}.
        </>
      ) : (
        <>
          {who(h.from, h.fromKind)} sent it to {who(h.to, h.toKind)}
          {via}
          {qty}.
        </>
      ),
      tone: "warning",
      Icon: viaMarketplace ? HandCoins : Send,
      touchesUser,
    };
  }
  if (viaMarketplace) {
    return {
      title: "Sold on the Maxion Marketplace (between other wallets)",
      detail: (
        <>
          Seller: {who(h.from, h.fromKind)} → buyer: {who(h.to, h.toKind)}
          {qty}.
        </>
      ),
      tone: "muted",
      Icon: Store,
      touchesUser,
    };
  }
  return {
    title: "Moved between other parties",
    detail: (
      <>
        From {who(h.from, h.fromKind)} to {who(h.to, h.toKind)}
        {via}
        {qty}.
      </>
    ),
    tone: "muted",
    Icon: ArrowLeftRight,
    touchesUser,
  };
}

const dotClass: Record<StatusMeta["tone"], string> = {
  success: "bg-success/15 text-success border-success/30",
  info: "bg-info/15 text-info border-info/30",
  primary: "bg-primary/15 text-primary border-primary/40",
  warning: "bg-warning/15 text-warning border-warning/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  muted: "bg-secondary text-muted-foreground border-border",
};

// ─── Sub-components ────────────────────────────────────────────

function TokenCard({ t, wallet }: { t: TokenTrace; wallet: string }) {
  const [open, setOpen] = useState(false);
  const hops = t.hops ?? [];
  const keyHop = t.userLastOut ?? (t.status === "held_by_user" ? null : hops[hops.length - 1] ?? null);
  const sentence = t.error ? "" : explain(t, wallet);
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm font-semibold">#{t.tokenId}</span>
        {t.error ? (
          <span className="text-xs text-destructive">{t.error}</span>
        ) : (
          <StatusPill status={t.status} />
        )}
        {keyHop && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {fmtDate(keyHop.time)} <TxLink tx={keyHop.tx} />
          </span>
        )}
        {sentence && (
          <span className="ml-auto">
            <CopyButton text={sentence} />
          </span>
        )}
      </div>
      {sentence && <p className="text-sm text-foreground/90">{sentence}</p>}
      {(t.holders ?? []).length > 0 && t.status !== "held_by_user" && (
        <p className="text-xs text-muted-foreground">
          Current holder:{" "}
          {(t.holders ?? []).map((h) => (
            <span key={h.address} className="mr-2">
              <AddrLink a={h.address} /> {h.verified ? "✓ verified on-chain" : "⚠ indexer and chain disagree"}
            </span>
          ))}
        </p>
      )}
      {hops.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {open ? "Hide" : "Show"} full journey ({hops.length} step{hops.length > 1 ? "s" : ""})
          </button>
          {open && (
            <ol className="mt-3 relative">
              <span aria-hidden className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
              {hops.map((h) => {
                const v = describeHop(h, wallet);
                return (
                  <li key={h.n} className="relative flex gap-3 pb-3 last:pb-0">
                    <span className={cn("relative z-10 mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", dotClass[v.tone], !v.touchesUser && "opacity-60")}>
                      <v.Icon className="h-3.5 w-3.5" />
                    </span>
                    <div
                      className={cn(
                        "min-w-0 flex-1 rounded-lg px-3 py-1.5 -my-0.5",
                        v.touchesUser ? "bg-primary/[0.06] border border-primary/15" : "border border-transparent"
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className={cn("text-sm font-medium", !v.touchesUser && "text-foreground/70")}>
                          <span className="text-muted-foreground mr-1.5 text-xs">Step {h.n}</span>
                          {v.title}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(h.time)} · <TxLink tx={h.tx} />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{v.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

const FLAG_LABELS: Record<string, string> = {
  moralis_wallet_missing: "Moralis does not show this NFT yet",
  moralis_wallet_stale: "Moralis still shows it, but it is no longer in the wallet",
  moralis_wallet_amount_diff: "Moralis shows a different quantity",
  moralis_tx_history_diff: "Moralis transfer history disagrees with the blockchain",
  bscscan_tx_history_diff: "BscScan history disagrees with the blockchain",
};

function HoldingsTable({ rows, reported, onTrace }: { rows: HoldingRow[]; reported: Set<string>; onTrace: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const held = rows.filter((r) => r.status === "held");
  const gone = rows.filter((r) => r.status !== "held");
  const visible = showAll ? [...held, ...gone] : held;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-1.5">
          <Button size="sm" variant={showAll ? "secondary" : "primary"} onClick={() => setShowAll(false)}>
            In wallet ({held.length})
          </Button>
          <Button size="sm" variant={showAll ? "primary" : "secondary"} onClick={() => setShowAll(true)}>
            Ever seen in this wallet ({rows.length})
          </Button>
        </div>
        <span className="text-muted-foreground">“Ever seen” includes NFTs that were later redeemed or sent away.</span>
      </div>
      <div className="overflow-auto max-h-[28rem] rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground bg-secondary/40 sticky top-0 backdrop-blur">
            <tr className="text-left">
              <th className="py-2 px-3 font-medium">NFT</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium text-right">Qty on-chain</th>
              <th className="py-2 px-3 font-medium text-right" title="Quantity reported by Moralis getWalletNFTs (the indexer, not the blockchain)">
                Moralis shows
              </th>
              <th className="py-2 px-3 font-medium">Note</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 px-3 text-center text-muted-foreground">
                  Nothing in this wallet right now.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const held = r.status === "held";
              const notes = (r.flags ?? []).map((f) => FLAG_LABELS[f] ?? f);
              return (
                <tr key={r.tokenId} className={cn("border-t border-border/60", !held && "text-muted-foreground")}>
                  <td className="py-1.5 px-3 font-mono whitespace-nowrap">
                    #{r.tokenId}
                    {reported.has(r.tokenId) && <span className="ml-2 rounded bg-primary/15 text-primary px-1.5 py-px text-[10px] font-semibold">reported</span>}
                  </td>
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    {held ? (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-px font-semibold", toneClass.success)}>
                        <CheckCircle2 className="h-3 w-3" /> In wallet
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-px", toneClass.muted)}>Not in wallet</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono">{r.onchain}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{r.moralisWallet ?? "—"}</td>
                  <td className="py-1.5 px-3">
                    {notes.length > 0 ? <span className="text-warning">{notes.join(" · ")}</span> : ""}
                  </td>
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    {!reported.has(r.tokenId) && (
                      <button type="button" onClick={() => onTrace(r.tokenId)} className="text-info hover:underline">
                        Trace
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultView({
  env,
  wallet,
  onRefresh,
  refreshing,
  onTrace,
}: {
  env: Envelope;
  wallet: string;
  onRefresh: () => void;
  refreshing: boolean;
  onTrace: (id: string) => void;
}) {
  const { meta, data } = env;
  const [showHoldings, setShowHoldings] = useState(false);
  const held = data.holdings.rows.filter((r) => r.status === "held");
  const moralisDiff = !data.holdings.errors?.moralisWallet && data.holdings.moralisWalletCount !== data.holdings.heldCount;
  const tokens = data.trace?.tokens ?? [];
  const counts = tokens.reduce<Record<string, number>>((acc, t) => ((acc[t.status] = (acc[t.status] ?? 0) + 1), acc), {});

  const reported = new Set(tokens.map((t) => t.tokenId));
  const verdictOrder: TokenStatus[] = ["held_by_user", "burned", "transferred", "never_owned", "unknown"];
  const verdict = verdictOrder
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${STATUS_META[k].label.toLowerCase()}`)
    .join(", ");

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className={cn("grid gap-6", tokens.length > 0 && "md:grid-cols-2")}>
          {tokens.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Reported NFTs</SectionLabel>
              <div className="text-3xl font-bold leading-tight">
                {tokens.length} <span className="text-base font-medium text-muted-foreground">NFT{tokens.length === 1 ? "" : "s"} from the ticket</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {verdictOrder
                  .filter((k) => counts[k])
                  .map((k) => (
                    <span key={k} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneClass[STATUS_META[k].tone])}>
                      {counts[k]} {STATUS_META[k].label.toLowerCase()}
                    </span>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">Details for each NFT are below.</p>
            </div>
          )}
          <div className="space-y-2">
            <SectionLabel>Wallet right now</SectionLabel>
            <div className="text-3xl font-bold leading-tight">
              {data.holdings.heldCount} <span className="text-base font-medium text-muted-foreground">NFT{data.holdings.heldCount === 1 ? "" : "s"} currently in this wallet</span>
            </div>
            {held.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {held.map((r) => (
                  <span
                    key={r.tokenId}
                    title={reported.has(r.tokenId) ? "One of the reported NFTs" : undefined}
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-xs",
                      reported.has(r.tokenId) ? "border-success/40 bg-success/15 text-success ring-1 ring-success/30" : "border-border bg-secondary text-foreground/80"
                    )}
                  >
                    #{r.tokenId}
                    {r.onchain !== "1" ? ` ×${r.onchain}` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No NFTs from this collection in the wallet right now.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Verified on the blockchain (BSC block {data.holdings.block.toLocaleString()})
              </p>
              <Button size="sm" variant="secondary" onClick={() => setShowHoldings((v) => !v)}>
                {showHoldings ? <ChevronUp className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                {showHoldings ? "Hide all NFTs" : "View all NFTs in wallet"}
              </Button>
            </div>
          </div>
        </div>

        {showHoldings && <HoldingsTable rows={data.holdings.rows} reported={reported} onTrace={onTrace} />}

        {moralisDiff && (
          <div className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Moralis (the NFT data indexer) currently reports {data.holdings.moralisWalletCount} NFT{data.holdings.moralisWalletCount === 1 ? "" : "s"} for this wallet, but the blockchain says {data.holdings.heldCount}.
              The count above comes straight from the blockchain and is the correct one; anything built on Moralis may be showing stale data.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {meta.cached ? (
            <>
              <span className="rounded-full bg-info/10 text-info border border-info/20 px-2 py-0.5">Saved result · {fmtDateTime(meta.createdAt)}</span>
              <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Re-check now
              </Button>
            </>
          ) : (
            <span>Checked {fmtDateTime(meta.createdAt)} · saved to history</span>
          )}
          {meta.by && <span>by {meta.by}</span>}
          {meta.note && <span>note: {meta.note}</span>}
          {verdict && <CopyButton label="Copy summary" text={`Wallet ${wallet}: ${data.holdings.heldCount} NFT(s) currently in wallet. Reported NFTs: ${verdict}.`} />}
        </div>
      </div>

      {/* Reported NFTs */}
      {data.traceError && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not trace the reported NFT IDs: {data.traceError}</div>}
      {tokens.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">What happened to each reported NFT</h2>
            <span className="text-xs text-muted-foreground">Use “Copy reply” to paste the explanation into the ticket.</span>
          </div>
          <div className="space-y-2">
            {tokens.map((t) => (
              <TokenCard key={t.tokenId} t={t} wallet={wallet} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  records,
  loading,
  filterWallet,
  canFilter,
  onToggleFilter,
  onOpen,
  onReload,
}: {
  records: HistoryRecord[];
  loading: boolean;
  filterWallet: string | null;
  canFilter: boolean;
  onToggleFilter: () => void;
  onOpen: (r: HistoryRecord) => void;
  onReload: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <History className="h-4 w-4" /> Recent checks
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={filterWallet ? "primary" : "secondary"} onClick={onToggleFilter} disabled={!canFilter} title={canFilter ? "" : "Enter a valid wallet above to filter"}>
            {filterWallet ? `Only ${short(filterWallet)}` : "All wallets"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReload} disabled={loading} aria-label="Reload history">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground">{loading ? "Loading…" : "No saved checks yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1.5 pr-3 font-medium">When</th>
                <th className="py-1.5 pr-3 font-medium">Wallet</th>
                <th className="py-1.5 pr-3 font-medium">Result</th>
                <th className="py-1.5 pr-3 font-medium">Note</th>
                <th className="py-1.5 pr-3 font-medium">By</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const st = r.summary?.status ?? {};
                return (
                  <tr
                    key={r.id}
                    className={cn("border-t border-border/60", r.kind === "check" && "cursor-pointer hover:bg-secondary/40 transition-colors")}
                    onClick={() => r.kind === "check" && onOpen(r)}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{fmtDateTime(r.createdAt)}</td>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap" title={r.wallet}>
                      {short(r.wallet)}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.summary?.held !== undefined && <span className="mr-2">{r.summary.held} in wallet</span>}
                      {r.summary?.tokens !== undefined && (
                        <span className="text-muted-foreground">
                          · {r.summary.tokens} reported
                          {Object.entries(st).map(([k, v]) => ` · ${v} ${STATUS_META[k as TokenStatus]?.label.toLowerCase() ?? k}`)}
                        </span>
                      )}
                      {r.kind !== "check" && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{r.kind}</span>}
                    </td>
                    <td className="py-2 pr-3 max-w-[12rem] truncate whitespace-nowrap" title={r.note}>
                      {r.note ?? ""}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground max-w-[10rem] truncate whitespace-nowrap" title={r.by}>
                      {r.by ?? ""}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {r.kind === "check" && (
                        <span className="text-info text-xs inline-flex items-center gap-1">
                          Open <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────

export function NftOwnershipSection() {
  const [connected, setConnected] = useState<null | { store: string; cacheTTL: string; hasMoralisKey: boolean }>(null);
  const [connecting, setConnecting] = useState(true);
  const [connError, setConnError] = useState<string | null>(null);

  const [collection, setCollection] = useState<Collection>(COLLECTIONS[0]);
  const [customAddr, setCustomAddr] = useState("");
  const [wallet, setWallet] = useState("");
  const [idsText, setIdsText] = useState("");
  const [note, setNote] = useState("");

  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<Envelope | null>(null);
  const [resultWallet, setResultWallet] = useState("");

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterByWallet, setFilterByWallet] = useState(false);

  const contract = collection.id === "custom" ? customAddr.trim() : collection.address;
  const walletOk = ADDR_RE.test(wallet.trim());
  const contractOk = ADDR_RE.test(contract);
  const ids = useMemo(() => parseIds(idsText), [idsText]);

  useEffect(() => {
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = useCallback(
    async (w?: string) => {
      setHistoryLoading(true);
      try {
        const res = await api<{ records: HistoryRecord[] }>("history", { limit: "50", wallet: w ?? "" });
        setHistory(res.records ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setHistoryLoading(false);
      }
    },
    []
  );

  async function connect() {
    setConnecting(true);
    setConnError(null);
    try {
      const cfg = await api<{ store: string; cacheTTL: string; hasMoralisKey: boolean }>("config", {});
      setConnected(cfg);
      void loadHistory();
    } catch (err) {
      setConnected(null);
      setConnError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (!connected) return;
    void loadHistory(filterByWallet && walletOk ? wallet.trim() : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterByWallet]);

  async function runCheck(refresh = false, overrideIds?: string[]) {
    if (!walletOk || !contractOk) return;
    const useIds = overrideIds ?? ids;
    refresh ? setRefreshing(true) : setChecking(true);
    try {
      const env = await api<Envelope>("check", { contract, wallet: wallet.trim(), ids: useIds.join(","), note: note.trim(), refresh: refresh ? "1" : "" });
      setResult(env);
      setResultWallet(wallet.trim());
      if (env.meta.cached) toast.info("Showing a saved result from earlier — use “Re-check now” for live data.");
      void loadHistory(filterByWallet ? wallet.trim() : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
      setRefreshing(false);
    }
  }

  function traceExtra(id: string) {
    const next = Array.from(new Set([...ids, id]));
    setIdsText(next.join(", "));
    void runCheck(false, next);
  }

  async function openRecord(r: HistoryRecord) {
    try {
      const rec = await api<HistoryRecord & { result: CheckData }>(`history/${r.id}`, {});
      setResult({
        meta: { recordId: rec.id, kind: rec.kind, cached: true, createdAt: rec.createdAt, cu: 0, store: "", by: rec.by, note: rec.note },
        data: rec.result,
      });
      setResultWallet(rec.wallet);
      setWallet(rec.wallet);
      setIdsText((rec.ids ?? []).join(", "));
      setNote(rec.note ?? "");
      const col = COLLECTIONS.find((c) => c.address.toLowerCase() === rec.contract.toLowerCase());
      if (col) setCollection(col);
      else {
        setCollection(COLLECTIONS[COLLECTIONS.length - 1]);
        setCustomAddr(rec.contract);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  const disabled = !connected;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NFT Ownership Check</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the user&apos;s wallet address and the NFT IDs from the ticket. You get a plain answer for each NFT: still in the wallet, redeemed into the game, sent elsewhere, or never there.
        </p>
      </div>

      {/* Service status */}
      <div className="rounded-xl border border-border bg-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {connected ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            Connected to support service · saved results reused for {connected.cacheTTL.replace(/0m0s$/, "")}
            {!connected.hasMoralisKey && <span className="text-warning">· ⚠ service has no Moralis key</span>}
          </span>
        ) : connecting ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to support service…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />
            {connError ?? "Not connected"}
          </span>
        )}
        {!connected && !connecting && (
          <Button size="sm" variant="ghost" onClick={() => connect()}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>

      {/* Input */}
      <div className={cn("rounded-xl border border-border bg-card p-6 space-y-4", disabled && "opacity-50 pointer-events-none")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <SectionLabel as="label">Collection</SectionLabel>
            <Dropdown<Collection>
              triggerClassName="px-3 py-2"
              value={collection}
              options={COLLECTIONS}
              onChange={setCollection}
              getKey={(c) => c.id}
              renderOption={(c) => <span>{c.label}</span>}
              renderSelected={(c) => <span>{c.label}</span>}
            />
            {collection.id === "custom" && (
              <input
                type="text"
                value={customAddr}
                onChange={(e) => setCustomAddr(e.target.value)}
                placeholder="0x… ERC-1155 contract on BSC"
                className={cn(inputClass, "font-mono mt-2")}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <SectionLabel as="label">User&apos;s wallet address</SectionLabel>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              className={cn(inputClass, "font-mono", wallet && !walletOk && "border-destructive/50")}
            />
            {wallet && !walletOk && <p className="text-xs text-destructive">Not a valid wallet address (should be 0x + 40 characters).</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
          <div className="space-y-1.5">
            <SectionLabel as="label">NFT IDs the user mentioned (optional)</SectionLabel>
            <textarea
              value={idsText}
              onChange={(e) => setIdsText(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && runCheck()}
              placeholder="e.g. 527774, 527936 — paste as-is from the ticket, any separator works"
              rows={2}
              className={cn(inputClass, "font-mono resize-y")}
            />
            {ids.length > 0 && <p className="text-xs text-muted-foreground">{ids.length} ID{ids.length > 1 ? "s" : ""} detected</p>}
          </div>
          <div className="space-y-1.5">
            <SectionLabel as="label">Ticket / note (optional)</SectionLabel>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. CS-1234" className={inputClass} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => runCheck()} disabled={checking || !walletOk || !contractOk}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Check wallet
          </Button>
          <span className="text-xs text-muted-foreground">Takes a few seconds. Same wallet + IDs checked recently? The saved result is shown instantly.</span>
        </div>
      </div>

      {/* Result */}
      {result && <ResultView env={result} wallet={resultWallet} onRefresh={() => runCheck(true)} refreshing={refreshing} onTrace={traceExtra} />}

      {/* History */}
      {connected && (
        <HistoryPanel
          records={history}
          loading={historyLoading}
          filterWallet={filterByWallet && walletOk ? wallet.trim() : null}
          canFilter={walletOk}
          onToggleFilter={() => walletOk && setFilterByWallet((v) => !v)}
          onOpen={openRecord}
          onReload={() => loadHistory(filterByWallet && walletOk ? wallet.trim() : undefined)}
        />
      )}
    </div>
  );
}
