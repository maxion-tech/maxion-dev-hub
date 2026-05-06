"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Check, KeyRound, RefreshCw, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dropdown } from "@/components/ui/dropdown";

// ─── Constants ─────────────────────────────────────────────────

const GAME_OPTIONS = [
  { label: "Ragnarok Landverse Thai", value: "rolth" },
  { label: "Ragnarok Landverse Genesis", value: "rolg" },
  { label: "Ragnarok Landverse America", value: "rola" },
  { label: "Dragonica", value: "drlv" },
  { label: "Custom…", value: "__custom__" },
  { label: "No game prefix", value: "__none__" },
] as const;

type GameOption = (typeof GAME_OPTIONS)[number];

const LENGTH_OPTIONS = [16, 24, 32, 48, 64] as const;
type KeyLength = (typeof LENGTH_OPTIONS)[number];

// ─── Entropy ───────────────────────────────────────────────────

function entropyBits(length: KeyLength): number {
  return Math.floor(length * Math.log2(62)); // alphanumeric 62-char charset → ~5.95 bits/char
}

type EntropyLevel = "insufficient" | "good" | "high" | "max";

function entropyLevel(bits: number): EntropyLevel {
  if (bits >= 256) return "max";
  if (bits >= 192) return "high";
  if (bits >= 128) return "good";
  return "insufficient";
}

const ENTROPY_META: Record<EntropyLevel, { label: string; color: string; barColor: string }> = {
  insufficient: { label: "Insufficient",     color: "text-muted-foreground", barColor: "bg-muted-foreground/40" },
  good:         { label: "Good",             color: "text-warning",          barColor: "bg-warning" },
  high:         { label: "High Security",    color: "text-info",             barColor: "bg-info" },
  max:          { label: "Maximum Security", color: "text-success",          barColor: "bg-success" },
};

// ─── Key generation ────────────────────────────────────────────

async function fetchHex(bytes: number): Promise<string> {
  const res = await fetch("/api/generate-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bytes }),
  });
  const data = await res.json();
  return data.hex as string;
}

function buildKey(prefix: string, hex: string): string {
  return [prefix, hex].filter(Boolean).join("_");
}

function buildPrefix(org: string, game: GameOption, customGame: string): string {
  const gamePart =
    game.value === "__custom__" ? customGame.trim() :
    game.value === "__none__"   ? "" :
    game.value;
  return [org.trim() || "mxt", gamePart].filter(Boolean).join("_");
}

// ─── InfoTooltip ───────────────────────────────────────────────

function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="About entropy"
        className="rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-20 w-72 rounded-lg border border-border bg-card shadow-xl p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
          <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-r border-b border-border bg-card" />
        </div>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────

export function ApiKeySection() {
  const [org, setOrg] = useState("mxt");
  const [game, setGame] = useState<GameOption>(GAME_OPTIONS[0]);
  const [customGame, setCustomGame] = useState("");
  const [length, setLength] = useState<KeyLength>(32);
  const [noPrefix, setNoPrefix] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    setCopied(null);
    try {
      const prefix = noPrefix ? "" : buildPrefix(org, game, customGame);
      const hexes = await Promise.all([fetchHex(length), fetchHex(length), fetchHex(length)]);
      setResults(hexes.map((hex) => buildKey(prefix, hex)));
    } catch {
      toast.error("Key generation failed — check API route");
    } finally {
      setGenerating(false);
    }
  }, [org, game, customGame, length, noPrefix]);

  const copy = useCallback(async (key: string, index: number) => {
    await navigator.clipboard.writeText(key);
    setCopied(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const bits = entropyBits(length);
  const level = entropyLevel(bits);
  const { label: entropyLabel, color: entropyColor, barColor } = ENTROPY_META[level];

  const formatPreview = [
    org.trim() || "mxt",
    game.value === "__none__"   ? null :
    game.value === "__custom__" ? (customGame.trim() || "<game>") :
    game.value,
    "<random>",
  ].filter(Boolean).join("_");

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">API Key Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">Secure keys for internal services.</p>
      </div>

      {/* Config card */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* Section: Prefix + Game */}
        <div className="space-y-3">
          <div className={cn("grid grid-cols-2 gap-3 transition-opacity", noPrefix && "opacity-40 pointer-events-none")}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Prefix
              </label>
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="mxt"
                className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/20 transition-colors font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Game
              </label>
              <Dropdown<GameOption>
                value={game}
                options={GAME_OPTIONS}
                onChange={setGame}
                getKey={(opt) => opt.value}
                renderOption={(opt) => <span>{opt.label}</span>}
                renderSelected={(opt) => <span className="text-sm">{opt.label}</span>}
              />
            </div>
          </div>

          {!noPrefix && game.value === "__custom__" && (
            <input
              type="text"
              value={customGame}
              onChange={(e) => setCustomGame(e.target.value)}
              placeholder="game code, e.g. myapp"
              className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/20 transition-colors font-mono"
            />
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Format:{" "}
              <span className="font-mono text-foreground/80">
                {noPrefix ? "<random>" : formatPreview}
              </span>
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-muted-foreground">No prefix</span>
              <button
                role="switch"
                aria-checked={noPrefix}
                onClick={() => setNoPrefix((v) => !v)}
                className={cn(
                  "relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors",
                  noPrefix ? "bg-primary border-primary" : "bg-secondary border-border"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-foreground transition-transform duration-150",
                  noPrefix ? "translate-x-3.5" : "translate-x-0.5"
                )} />
              </button>
            </label>
          </div>
        </div>

        {/* Divider — separates prefix config from length config */}
        <div className="border-t border-border my-5" />

        {/* Section: Length + Entropy */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Length
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {LENGTH_OPTIONS.map((l) => (
              <button
                key={l}
                onClick={() => setLength(l)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors",
                  length === l
                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                    : "bg-secondary/30 text-muted-foreground border-border hover:text-foreground hover:border-primary/20"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Entropy strip — tight under length, they're related */}
          <div className="flex items-center gap-2 pt-1">
            <div className="h-1 w-24 rounded-full bg-border overflow-hidden shrink-0">
              <div
                className={cn("h-full rounded-full transition-all duration-300", barColor)}
                style={{ width: `${Math.min((bits / 512) * 100, 100)}%` }}
              />
            </div>
            <span className={cn("text-xs font-mono tabular-nums", entropyColor)}>{bits} bits</span>
            <span className={cn("text-xs", entropyColor)}>· {entropyLabel}</span>
            <InfoTooltip>
              Entropy measures how hard a key is to guess. Uses{" "}
              <span className="font-mono text-foreground">crypto.randomBytes()</span>{" "}
              (CSPRNG), alphanumeric charset (A-Za-z0-9, 62 chars) — ~5.95 bits/char. 128 bits = good; 192 = high-security; 256+ = maximum.
            </InfoTooltip>
          </div>
        </div>

        {/* Divider — separates config from action */}
        <div className="border-t border-border my-5" />

        <button
          onClick={generate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>

      {/* Result */}
      {results.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Generated Keys
            </span>
            <button
              onClick={generate}
              disabled={generating}
              aria-label="Regenerate keys"
              title="Regenerate"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
          <div className="space-y-2">
            {results.map((key, i) => (
              <div
                key={i}
                onClick={() => copy(key, i)}
                className={cn(
                  "group cursor-pointer rounded-lg bg-secondary/30 border px-4 py-3 flex items-center gap-3 transition-colors",
                  copied === i
                    ? "border-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-mono text-sm text-foreground break-all flex-1">{key}</span>
                <span className={cn(
                  "shrink-0 transition-colors",
                  copied === i ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
                )}>
                  {copied === i ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
