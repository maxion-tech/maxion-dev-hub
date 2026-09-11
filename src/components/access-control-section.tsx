"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Lock, LockOpen, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmOptions } from "@/components/ui/confirm-dialog";
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

interface FeaturePolicy {
  feature: string;
  restricted: boolean;
  updatedBy?: string;
  updatedAt?: string;
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
  const [newFeatures, setNewFeatures] = useState<string[]>([]);
  const [policies, setPolicies] = useState<Record<string, FeaturePolicy>>({});
  const [policyBusy, setPolicyBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Confirmation modal: askConfirm() resolves true/false when the user answers
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { busy: boolean }) | null>(null);
  const confirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const askConfirm = (opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState({ ...opts, busy: false });
    });
  const answerConfirm = (ok: boolean) => {
    confirmResolver.current?.(ok);
    confirmResolver.current = null;
    setConfirmState(null);
  };

  const isRestricted = (featureId: string) => policies[featureId]?.restricted === true;
  const restrictedFeatures = OPS_FEATURES.filter((f) => isRestricted(f.id));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, pol] = await Promise.all([
        platformSupportApi<{ users: AclEntry[]; store: string }>("acl/users"),
        platformSupportApi<{ features: FeaturePolicy[] }>("acl/features"),
      ]);
      setUsers(res.users ?? []);
      setStore(res.store ?? "");
      setPolicies(Object.fromEntries((pol.features ?? []).map((p) => [p.feature, p])));
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

  async function setRestricted(featureId: string, restricted: boolean) {
    const f = OPS_FEATURES.find((x) => x.id === featureId);
    const label = f?.label ?? featureId;
    const grantedCount = users.filter((u) => u.role !== "admin" && u.features.includes(featureId)).length;
    const ok = await askConfirm(
      restricted
        ? {
            title: `Restrict “${label}”?`,
            tone: "warning",
            icon: <Lock className="h-5 w-5" />,
            confirmLabel: "Restrict tool",
            description: (
              <>
                Only admins and the people ticked for this tool will be able to open it.{" "}
                {grantedCount > 0 ? (
                  <>
                    Right now that is <b className="text-foreground">{grantedCount}</b> {grantedCount === 1 ? "person" : "people"} plus admins.
                  </>
                ) : (
                  <>Nobody is ticked yet, so until you add someone only admins can use it.</>
                )}{" "}
                Everyone else loses access on their next page load.
              </>
            ),
          }
        : {
            title: `Open “${label}” to everyone?`,
            tone: "primary",
            icon: <LockOpen className="h-5 w-5" />,
            confirmLabel: "Open to everyone",
            description: <>Every signed-in @maxion.tech account will be able to use this tool. The ticks below are kept, so you can restrict it again later without re-adding people.</>,
          }
    );
    if (!ok) return;
    setPolicyBusy(featureId);
    try {
      const saved = await platformSupportApi<FeaturePolicy>(`acl/features/${encodeURIComponent(featureId)}`, { method: "PUT", body: { restricted } });
      setPolicies((prev) => ({ ...prev, [featureId]: saved }));
      toast.success(restricted ? `${label} is now restricted` : `${label} is open to everyone`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicyBusy(null);
    }
  }

  async function remove(email: string) {
    const ok = await askConfirm({
      title: "Remove this person?",
      tone: "destructive",
      icon: <Trash2 className="h-5 w-5" />,
      confirmLabel: "Remove",
      description: (
        <>
          <span className="font-mono text-foreground">{email}</span> will lose access to every restricted tool and any admin role. Tools that are open to everyone stay available to them.
        </>
      ),
    });
    if (!ok) return;
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
      const parsed = JSON.parse(await file.text()) as { users?: AclEntry[]; features?: FeaturePolicy[] };
      if (!Array.isArray(parsed.users)) throw new Error("File must contain a \"users\" array");
      const ok = await askConfirm({
        title: "Import this backup?",
        tone: "warning",
        icon: <Upload className="h-5 w-5" />,
        confirmLabel: "Import",
        description: (
          <>
            {parsed.users.length} {parsed.users.length === 1 ? "person" : "people"} and {parsed.features?.length ?? 0} tool setting{(parsed.features?.length ?? 0) === 1 ? "" : "s"} will be written. Existing entries with the same email are overwritten; nothing is deleted.
          </>
        ),
      });
      if (!ok) return;
      const res = await platformSupportApi<{ imported: number }>("acl/import", { method: "POST", body: { users: parsed.users, features: parsed.features ?? [] } });
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

  const toggleAdmin = async (u: AclEntry) => {
    if (u.email === currentEmail.toLowerCase() && u.role === "admin") {
      toast.error("You cannot remove your own admin role");
      return;
    }
    const next = u.role === "admin" ? "user" : "admin";
    const ok = await askConfirm(
      next === "admin"
        ? {
            title: "Make this person an admin?",
            tone: "primary",
            icon: <ShieldCheck className="h-5 w-5" />,
            confirmLabel: "Make admin",
            description: (
              <>
                <span className="font-mono text-foreground">{u.email}</span> will be able to use every tool, restrict tools, and edit this page.
              </>
            ),
          }
        : {
            title: "Remove admin role?",
            tone: "warning",
            icon: <ShieldOff className="h-5 w-5" />,
            confirmLabel: "Remove admin",
            description: (
              <>
                <span className="font-mono text-foreground">{u.email}</span> becomes a normal user and keeps only the tools ticked in the table.
              </>
            ),
          }
    );
    if (!ok) return;
    void save(u.email, next, u.features);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every Ops Tool is open to all @maxion.tech accounts by default. Restrict a tool to limit it to the people you tick below. Admins can use everything and edit this page. Changes apply on the person&apos;s next page load.
        </p>
      </div>

      {/* Tools */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold">Tools</h2>
        <div className="divide-y divide-border/60 rounded-lg border border-border">
          {OPS_FEATURES.map((f) => {
            const restricted = isRestricted(f.id);
            const grantedCount = users.filter((u) => u.role !== "admin" && u.features.includes(f.id)).length;
            return (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      restricted ? "bg-warning/10 text-warning border-warning/20" : "bg-success/10 text-success border-success/20"
                    )}
                  >
                    {restricted ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                    {restricted ? `Restricted · ${grantedCount} ${grantedCount === 1 ? "person" : "people"} + admins` : "Everyone @maxion.tech"}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => setRestricted(f.id, !restricted)} disabled={policyBusy === f.id || loading}>
                    {policyBusy === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : restricted ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {restricted ? "Open to everyone" : "Restrict"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
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
        {restrictedFeatures.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {restrictedFeatures.map((f) => (
              <Checkbox
                key={f.id}
                label={f.label}
                checked={newFeatures.includes(f.id)}
                onChange={(on) => setNewFeatures((prev) => (on ? [...prev, f.id] : prev.filter((x) => x !== f.id)))}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tool is restricted right now, so everyone already has access. Add people here only if you plan to restrict a tool, or to make someone an admin.</p>
        )}
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
                    <th key={f.id} className="py-2 px-3 font-medium whitespace-nowrap" title={isRestricted(f.id) ? f.description : "Open to everyone — ticks are ignored until you restrict this tool"}>
                      {f.label}
                      {!isRestricted(f.id) && <span className="ml-1 text-[10px] font-normal text-success">open</span>}
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
                          title={locked ? "Permanent admin, set in the service configuration (ADMIN_EMAILS); cannot be changed here" : isAdmin ? "Click to remove admin" : "Click to make admin"}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-px font-semibold transition-colors",
                            isAdmin ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border hover:text-foreground",
                            locked ? "cursor-default" : "cursor-pointer"
                          )}
                        >
                          {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                          {isAdmin ? (locked ? "admin · fixed" : "admin") : "user"}
                        </button>
                      </td>
                      {OPS_FEATURES.map((f) => (
                        <td key={f.id} className="py-2 px-3">
                          <Checkbox
                            label={isAdmin ? "all" : !isRestricted(f.id) ? "open" : ""}
                            checked={isAdmin || !isRestricted(f.id) || u.features.includes(f.id)}
                            disabled={isAdmin || !isRestricted(f.id) || saving}
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
          Only @maxion.tech accounts can sign in at all. Ticks only matter for restricted tools. Keep an Export as a backup — if the store is ever lost, every tool reopens to everyone and only the permanent admin can edit this page.
        </p>
      </div>

      {confirmState && (
        <ConfirmDialog
          open
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          tone={confirmState.tone}
          icon={confirmState.icon}
          busy={confirmState.busy}
          onConfirm={() => answerConfirm(true)}
          onCancel={() => answerConfirm(false)}
        />
      )}
    </div>
  );
}
