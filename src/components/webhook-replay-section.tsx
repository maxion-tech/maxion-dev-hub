"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckSquare, ExternalLink, Eye, Loader2, RefreshCw, Search, Send, Square, Webhook } from "lucide-react";
import { platformFirebase } from "@/config/firebase";
import { cn } from "@/lib/utils";
import { Dropdown } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

// ─── Types (ตรงกับ maxion-platform-support /api/replay/*) ───────

interface EventCfg {
  key: string;
  label: string;
  address: string;
  replayUrl: string;
  enabled: boolean;
  disabledReason?: string;
}

interface GameCfg {
  key: string;
  label: string;
  chainId: number;
  explorerTx: string;
  hasReplayKey: boolean;
  events: EventCfg[];
}

interface ReplayConfig {
  dryRun: boolean;
  defaultMaxBlocks: number;
  games: GameCfg[];
}

interface ScannedEvent {
  transactionHash: string;
  transactionIndex: number;
  blockNumber: string;
  blockHash: string;
  blockTimestamp: number;
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  args: Record<string, unknown>;
}

interface ScanResult {
  fromBlock: string;
  toBlock: string;
  latestBlock: string;
  items: ScannedEvent[];
}

interface ScanProgress {
  fromBlock: string;
  toBlock: string;
  totalBlocks: number;
  scannedBlocks: number;
  currentBlock: string;
  chunkSize: number;
  logsFound: number;
  message: string;
}

interface ScanJob {
  id: string;
  status: "running" | "done" | "error";
  progress: ScanProgress;
  result?: ScanResult;
  error?: string;
  elapsedMs: number;
}

interface Payload {
  key: string;
  transactionHash: string;
  url: string;
  body?: string;
  error?: string;
}

interface SendResult {
  key: string;
  transactionHash: string;
  url: string;
  status: "success" | "error" | "dry-run";
  httpStatus?: number;
  response?: string;
  error?: string;
  sentAt: string;
}

// ─── API ───────────────────────────────────────────────────────
// Calls go through /api/platform-support/replay/* (Next.js route) which holds the maxion-platform-support URL and
// admin token server-side and verifies the Firebase session. maxion-platform-support scans the chain, then asks the
// game's landverse-*-service POST /replay to rebuild the webhook from chain data and run it — no webhook secret anywhere here.

async function api<T>(path: string, body?: unknown): Promise<T> {
  const user = platformFirebase.auth().currentUser;
  if (!user) throw new Error("Sign in required");
  const idToken = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`/api/platform-support/replay/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${idToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Cannot reach the service (${err instanceof Error ? err.message : String(err)})`);
  }
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Helpers ───────────────────────────────────────────────────

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const fmtTime = (ts: number) => new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19);
const fmtElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const inputClass =
  "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/20 transition-colors";

function StatusBadge({ status }: { status: SendResult["status"] }) {
  const styles = {
    success: "bg-success/10 text-success",
    error: "bg-destructive/10 text-destructive",
    "dry-run": "bg-warning/10 text-warning",
  } as const;
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", styles[status])}>
      {status}
    </span>
  );
}

// ─── Progress ──────────────────────────────────────────────────

function ScanProgressBar({ job }: { job: ScanJob }) {
  const p = job.progress;
  const pct = p.totalBlocks > 0 ? Math.min(100, Math.round((p.scannedBlocks / p.totalBlocks) * 100)) : 0;
  const isError = job.status === "error";
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
          {isError ? `Scan failed: ${job.error}` : `Scanning blocks ${p.fromBlock} → ${p.toBlock}`}
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {pct}% · {fmtElapsed(job.elapsedMs)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-border overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", isError ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono tabular-nums">
        <span>{p.scannedBlocks.toLocaleString()} / {p.totalBlocks.toLocaleString()} blocks</span>
        <span>at block {p.currentBlock}</span>
        <span>{p.logsFound} log{p.logsFound === 1 ? "" : "s"} found</span>
        <span>chunk {p.chunkSize}</span>
        {p.message && p.message !== "scanning logs" && (
          <span className="text-warning">{p.message}</span>
        )}
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────

export function WebhookReplaySection() {
  const [connecting, setConnecting] = useState(false);
  const [config, setConfig] = useState<ReplayConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [game, setGame] = useState<GameCfg | null>(null);
  const [event, setEvent] = useState<EventCfg | null>(null);
  const [txHash, setTxHash] = useState("");
  const [toBlock, setToBlock] = useState("");
  const [maxBlocks, setMaxBlocks] = useState("");
  const [includeFromTx, setIncludeFromTx] = useState(true);

  const [scanning, setScanning] = useState(false);
  const [scanJob, setScanJob] = useState<ScanJob | null>(null);
  const [scan, setScan] = useState<(ScanResult & { game: string; event: string }) | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [previewing, setPreviewing] = useState(false);
  const [payloads, setPayloads] = useState<Payload[] | null>(null);

  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ dryRun: boolean; results: SendResult[] } | null>(null);

  const loadConfig = useCallback(async () => {
    setConnecting(true);
    try {
      const cfg = await api<ReplayConfig>("config");
      setConfig(cfg);
      setConfigError(null);
      const g = cfg.games[0] ?? null;
      setGame(g);
      setEvent(g?.events.find((e) => e.enabled) ?? null);
      setMaxBlocks((prev) => prev || String(cfg.defaultMaxBlocks));
    } catch (err) {
      setConfig(null);
      setConfigError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const enabledEvents = useMemo(() => game?.events.filter((e) => e.enabled) ?? [], [game]);
  const disabledEvents = useMemo(() => game?.events.filter((e) => !e.enabled) ?? [], [game]);

  const onGameChange = (g: GameCfg) => {
    setGame(g);
    setEvent(g.events.find((e) => e.enabled) ?? null);
    setScan(null);
    setPayloads(null);
    setResults(null);
  };

  const selectedItems = useMemo(
    () => (scan ? scan.items.filter((_, i) => selected.has(i)) : []),
    [scan, selected]
  );
  // receiver ทำงานเป็นราย tx (ดึง receipt เอง) จึงส่งแค่ tx hash ที่ไม่ซ้ำ
  const selectedTxHashes = useMemo(
    () => Array.from(new Set(selectedItems.map((it) => it.transactionHash.toLowerCase()))),
    [selectedItems]
  );

  const runScan = async () => {
    if (!game || !event) {
      toast.error("No usable event for this game — check server env");
      return;
    }
    if (!HASH_RE.test(txHash.trim())) {
      toast.error("Invalid tx hash");
      return;
    }
    setScanning(true);
    setScan(null);
    setScanJob(null);
    setPayloads(null);
    setResults(null);
    try {
      // scan เป็น job: API ตอบ id ทันที แล้ว poll ความคืบหน้าทุกวินาที
      let job = await api<ScanJob>("scan", {
        game: game.key,
        event: event.key,
        txHash: txHash.trim(),
        includeFromTx,
        toBlock: toBlock.trim(),
        maxBlocks: Number(maxBlocks) || undefined,
      });
      setScanJob(job);
      while (job.status === "running") {
        await sleep(1000);
        job = await api<ScanJob>(`scan/${job.id}`);
        setScanJob(job);
      }
      if (job.status === "error" || !job.result) throw new Error(job.error || "scan failed");
      const res = job.result;
      setScan({ ...res, game: game.key, event: event.key });
      setSelected(new Set(res.items.map((_, i) => i)));
      if (res.items.length === 0) toast.info("No events found in this range");
      else toast.success(`Found ${res.items.length} event${res.items.length > 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const runPreview = async () => {
    if (!scan || selectedItems.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    setPreviewing(true);
    try {
      const res = await api<{ payloads: Payload[] }>("preview", {
        game: scan.game,
        event: scan.event,
        txHashes: selectedTxHashes,
      });
      setPayloads(res.payloads);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  };

  const runSend = async () => {
    if (!scan || !event || selectedItems.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    const live = !config?.dryRun;
    const ok = window.confirm(
      `${live ? "REPLAY (live)" : "DRY RUN"} ${selectedTxHashes.length} tx (${selectedItems.length} event(s)) of ${scan.game}/${scan.event}\nvia ${event.replayUrl}\n\nContinue?`
    );
    if (!ok) return;
    setSending(true);
    try {
      const res = await api<{ dryRun: boolean; results: SendResult[] }>("send", {
        game: scan.game,
        event: scan.event,
        txHashes: selectedTxHashes,
      });
      setResults(res);
      const errors = res.results.filter((r) => r.status === "error").length;
      if (res.dryRun) toast.info(`Dry run: built ${res.results.length} payload(s)`);
      else if (errors) toast.error(`${errors} of ${res.results.length} failed`);
      else toast.success(`Replayed ${res.results.length} webhook(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const busy = scanning || previewing || sending;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Webhook Replay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rescan on-chain events from a stuck tx hash and ask the game service to re-run its webhook for them.
          </p>
        </div>
        {config && (
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
              config.dryRun ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            )}
          >
            {config.dryRun ? "DRY RUN" : "LIVE"}
          </span>
        )}
      </div>

      {/* Step 0: service status (URL/token live server-side in the Next.js proxy) */}
      {(configError || connecting) && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 text-sm">
          {connecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Connecting to platform support service…</span>
            </>
          ) : (
            <>
              <span className="text-destructive flex-1">{configError}</span>
              <Button size="sm" onClick={loadConfig}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </>
          )}
        </div>
      )}

      {/* Step 1: Config */}
      <div className={cn("rounded-xl border border-border bg-card p-6 space-y-4", !config && "opacity-50 pointer-events-none")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <SectionLabel as="label">Game</SectionLabel>
            {game && config ? (
              <Dropdown<GameCfg>
                value={game}
                options={config.games}
                onChange={onGameChange}
                getKey={(g) => g.key}
                renderOption={(g) => <span>{g.label}</span>}
                renderSelected={(g) => <span className="text-sm">{g.label}</span>}
              />
            ) : (
              <div className={cn(inputClass, "text-muted-foreground")}>{connecting ? "Loading…" : "Service unavailable"}</div>
            )}
          </div>
          <div className="space-y-1.5">
            <SectionLabel as="label">Event</SectionLabel>
            {event ? (
              <Dropdown<EventCfg>
                value={event}
                options={enabledEvents}
                onChange={setEvent}
                getKey={(e) => e.key}
                renderOption={(e) => <span>{e.label}</span>}
                renderSelected={(e) => <span className="text-sm">{e.label}</span>}
              />
            ) : (
              <div className={cn(inputClass, "text-muted-foreground")}>No enabled event</div>
            )}
          </div>
        </div>

        {event && game && (
          <p className="text-xs text-muted-foreground break-all">
            contract <span className="font-mono text-foreground/80">{event.address}</span> → replay via{" "}
            <span className="font-mono text-foreground/80">{event.replayUrl}</span> · chain {game.chainId}
          </p>
        )}
        {disabledEvents.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Disabled: {disabledEvents.map((e) => `${e.label} (${e.disabledReason ?? "disabled"})`).join(" · ")}
          </p>
        )}

        <div className="border-t border-border" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <SectionLabel as="label">Stuck tx hash (scan starts from its block)</SectionLabel>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x…"
              className={cn(inputClass, "font-mono")}
            />
          </div>
          <div className="space-y-1.5">
            <SectionLabel as="label">To block (blank = latest)</SectionLabel>
            <input
              type="text"
              value={toBlock}
              onChange={(e) => setToBlock(e.target.value)}
              placeholder="latest"
              className={cn(inputClass, "font-mono")}
            />
          </div>
          <div className="space-y-1.5">
            <SectionLabel as="label">Max blocks</SectionLabel>
            <input
              type="number"
              min={1}
              value={maxBlocks}
              onChange={(e) => setMaxBlocks(e.target.value)}
              className={cn(inputClass, "font-mono")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ToggleSwitch
            label="Include the entered tx (off = only events after it)"
            checked={includeFromTx}
            onChange={setIncludeFromTx}
          />
          <div className="flex-1" />
          <Button variant="primary" onClick={runScan} disabled={busy || !event || !HASH_RE.test(txHash.trim())} title={!HASH_RE.test(txHash.trim()) ? "Enter a valid transaction hash (0x + 64 hex characters) first" : undefined}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {scanning ? "Scanning…" : "Scan events"}
          </Button>
        </div>

        {scanJob && (scanning || scanJob.status === "error") && (
          <ScanProgressBar job={scanJob} />
        )}
      </div>

      {/* Step 2: Results */}
      {scan && game && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Found <span className="font-semibold text-foreground">{scan.items.length}</span> event(s) in blocks{" "}
              <span className="font-mono">{scan.fromBlock}</span> → <span className="font-mono">{scan.toBlock}</span>{" "}
              (latest <span className="font-mono">{scan.latestBlock}</span>) · selected {selected.size}
            </p>
            <div className="flex-1" />
            <Button size="sm" onClick={() => setSelected(new Set(scan.items.map((_, i) => i)))}>
              <CheckSquare className="h-3.5 w-3.5" /> All
            </Button>
            <Button size="sm" onClick={() => setSelected(new Set())}>
              <Square className="h-3.5 w-3.5" /> None
            </Button>
            <Button size="sm" onClick={runPreview} disabled={busy || selected.size === 0}>
              {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Preview payload
            </Button>
            <Button size="sm" variant="destructive" onClick={runSend} disabled={busy || selected.size === 0}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {config?.dryRun ? "Dry-run send" : "Send selected"}
            </Button>
          </div>

          {scan.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30">
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-2 w-8" />
                    <th className="p-2 w-8">#</th>
                    <th className="p-2">Tx hash</th>
                    <th className="p-2">Block</th>
                    <th className="p-2">Log</th>
                    <th className="p-2">Time (UTC)</th>
                    <th className="p-2">Args</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.items.map((it, i) => (
                    <tr
                      key={`${it.transactionHash}-${it.logIndex}`}
                      className={cn("border-t border-border", selected.has(i) ? "" : "opacity-50")}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(i);
                            else next.delete(i);
                            setSelected(next);
                          }}
                          className="accent-primary"
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-mono">
                        <a
                          href={`${game.explorerTx}${it.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={it.transactionHash}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {shortHash(it.transactionHash)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="p-2 font-mono">{it.blockNumber}</td>
                      <td className="p-2 font-mono">{it.logIndex}</td>
                      <td className="p-2 font-mono whitespace-nowrap">{fmtTime(it.blockTimestamp)}</td>
                      <td className="p-2 font-mono text-xs text-muted-foreground break-all max-w-md">
                        {JSON.stringify(it.args)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {payloads && (
            <div className="space-y-2">
              <SectionLabel>Payload preview</SectionLabel>
              {payloads.map((p) => (
                <details key={p.key} className="rounded-lg border border-border bg-secondary/20" open={payloads.length <= 3}>
                  <summary className={cn("cursor-pointer px-3 py-2 text-xs font-mono break-all", p.error ? "text-destructive" : "text-foreground/80")}>
                    {p.key} → {p.url}{p.error ? ` · ${p.error}` : ""}
                  </summary>
                  {p.body && (
                    <pre className="overflow-auto max-h-96 p-3 text-xs font-mono text-foreground/90 border-t border-border">
                      {JSON.stringify(JSON.parse(p.body), null, 2)}
                    </pre>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Send results */}
      {results && game && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-info" />
            <SectionLabel>
              {results.dryRun
                ? `Dry run: built ${results.results.length} payload(s), nothing replayed`
                : `Replayed ${results.results.length}: ${results.results.filter((r) => r.status === "success").length} success, ${results.results.filter((r) => r.status === "error").length} error`}
            </SectionLabel>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-2">Status</th>
                  <th className="p-2">Tx hash</th>
                  <th className="p-2">Handler</th>
                  <th className="p-2">Response / error</th>
                  <th className="p-2">Sent at</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="p-2"><StatusBadge status={r.status} /></td>
                    <td className="p-2 font-mono">
                      <a
                        href={`${game.explorerTx}${r.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {shortHash(r.transactionHash)}
                      </a>
                    </td>
                    <td className="p-2 font-mono">{r.httpStatus ?? "-"}</td>
                    <td className="p-2 font-mono text-xs break-all whitespace-pre-wrap max-w-lg">
                      {[r.error, r.response].filter(Boolean).join("\n")}
                    </td>
                    <td className="p-2 font-mono text-xs whitespace-nowrap">{r.sentAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
