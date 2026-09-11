"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { OPS_FEATURES } from "@/constants/ops-tools";
import { platformSupportApi } from "@/lib/platform-support";

// ─── Types (mirror maxion-platform-support /api/acl) ───────────

interface AclEntry {
  email: string;
  role: "admin" | "user";
  features: string[];
  updatedBy?: string;
  updatedAt?: string;
  bootstrap?: boolean; // defined by ADMIN_EMAILS on the service; read-only here
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClass =
  "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/20 transition-colors";

const fmtWhen = (iso?: string) => (iso && !iso.startsWith("0001") ? new Date(iso).toLocaleString("en-GB") : "");

function Checkbox({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-xs cursor-pointer select-none", disabled && "opacity-50 cursor-not-allowed")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-secondary/30 accent-[rgb(var(--primary))]"
      />
      {label}
    </label>
  );
}

// ─── Main section ──────────────────────────────────────────────

export function AccessControlSection({ currentEmail }: { currentEmail: string }) {
  const [users, setUsers] = useState<AclEntry[]>([]);
  const [store, setStore] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // email being saved
  const [newEmail, setNewEmail] = useState("");
  const [newFeatures, setNewFeatures] = useState<string[]>(OPS_FEATURES.map((f) => f.id));
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformSupportApi<{ users: AclEntry[]; store: string }>("acl/users");
      setUsers(res.users ?? []);
      setStore(res.store ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(email: string, role: AclEntry["role"], features: string[]) {
    setBusy(email);
    try {
      const saved = await platformSupportApi<AclEntry>(`acl/users/${encodeURIComponent(email)}`, { method: "PUT", body: { role, features } });
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.email === saved.email);
        if (idx === -1) return [...prev, saved].sort((a, b) => a.email.localeCompare(b.email));
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(email: string) {
    if (!window.confirm(`Remove all access for ${email}?`)) return;
    setBusy(email);
    try {
      await platformSupportApi(`acl/users/${encodeURIComponent(email)}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.email !== email));
      toast.success(`Removed ${email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (users.some((u) => u.email === email)) {
      toast.error("That email is already in the list");
      return;
    }
    if (await save(email, "user", newFeatures)) {
      toast.success(`Added ${email}`);
      setNewEmail("");
    }
  }

  async function exportJson() {
    try {
      const data = await platformSupportApi<unknown>("acl/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ops-access-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as { users?: AclEntry[] };
      if (!Array.isArray(parsed.users)) throw new Error("File must contain a \"users\" array");
      if (!window.confirm(`Import ${parsed.users.length} entr${parsed.users.length === 1 ? "y" : "ies"}? Existing entries with the same email are overwritten.`)) return;
      const res = await platformSupportApi<{ imported: number }>("acl/import", { method: "POST", body: { users: parsed.users } });
      toast.success(`Imported ${res.imported} entr${res.imported === 1 ? "y" : "ies"}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const toggleFeature = (u: AclEntry, featureId: string, on: boolean) => {
    const features = on ? Array.from(new Set([...u.features, featureId])) : u.features.filter((f) => f !== featureId);
    void save(u.email, u.role, features);
  };

  const toggleAdmin = (u: AclEntry) => {
    if (u.email === currentEmail.toLowerCase() && u.role === "admin") {
      toast.error("You cannot remove your own admin role");
      return;
    }
    const next = u.role === "admin" ? "user" : "admin";
    if (!window.confirm(next === "admin" ? `Make ${u.email} an admin? Admins can use every tool and manage this list.` : `Remove admin from ${u.email}?`)) return;
    void save(u.email, next, u.features);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which @maxion.tech accounts can use each Ops Tool. Admins can use everything and edit this list. Changes apply on the person&apos;s next page load.
        </p>
      </div>

      {/* Add */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <SectionLabel as="label">Grant access to</SectionLabel>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="name@maxion.tech"
              autoComplete="off"
              className={cn(inputClass, "font-mono")}
            />
          </div>
          <Button variant="primary" onClick={add} disabled={busy !== null || !newEmail.trim()}>
            {busy === newEmail.trim().toLowerCase() ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-4">
          {OPS_FEATURES.map((f) => (
            <Checkbox
              key={f.id}
              label={f.label}
              checked={newFeatures.includes(f.id)}
              onChange={(on) => setNewFeatures((prev) => (on ? [...prev, f.id] : prev.filter((x) => x !== f.id)))}
            />
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> People with access ({users.length})
            {store && <span className="text-xs font-normal text-muted-foreground">· stored in {store}</span>}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={exportJson} title="Download a JSON backup of this list">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} title="Restore from a JSON backup">
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            <Button size="sm" variant="ghost" onClick={() => load()} disabled={loading} aria-label="Reload list">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground">{loading ? "Loading…" : "No one has access yet."}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground bg-secondary/40">
                <tr className="text-left">
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Role</th>
                  {OPS_FEATURES.map((f) => (
                    <th key={f.id} className="py-2 px-3 font-medium whitespace-nowrap" title={f.description}>
                      {f.label}
                    </th>
                  ))}
                  <th className="py-2 px-3 font-medium whitespace-nowrap">Last change</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = u.role === "admin";
                  const locked = u.bootstrap === true;
                  const saving = busy === u.email;
                  return (
                    <tr key={u.email} className={cn("border-t border-border/60", saving && "opacity-60")}>
                      <td className="py-2 px-3 font-mono whitespace-nowrap">
                        {u.email}
                        {u.email === currentEmail.toLowerCase() && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => !locked && toggleAdmin(u)}
                          disabled={locked || saving}
                          title={locked ? "Defined by ADMIN_EMAILS on the service" : isAdmin ? "Click to remove admin" : "Click to make admin"}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-px font-semibold transition-colors",
                            isAdmin ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border hover:text-foreground",
                            locked ? "cursor-default" : "cursor-pointer"
                          )}
                        >
                          {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                          {isAdmin ? (locked ? "admin (env)" : "admin") : "user"}
                        </button>
                      </td>
                      {OPS_FEATURES.map((f) => (
                        <td key={f.id} className="py-2 px-3">
                          <Checkbox
                            label={isAdmin ? "all" : ""}
                            checked={isAdmin || u.features.includes(f.id)}
                            disabled={isAdmin || saving}
                            onChange={(on) => toggleFeature(u, f.id, on)}
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                        {fmtWhen(u.updatedAt)}
                        {u.updatedBy && <span className="block text-[10px]">by {u.updatedBy}</span>}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {!locked && (
                          <Button size="icon" variant="ghost" onClick={() => remove(u.email)} disabled={saving} aria-label={`Remove ${u.email}`} title="Remove all access">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Only @maxion.tech accounts can sign in at all; this list decides which tools each of them sees. Keep an Export as a backup — if the store is ever lost, only the env-defined admin keeps access.
        </p>
      </div>
    </div>
  );
}
