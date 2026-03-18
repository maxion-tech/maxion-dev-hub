"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  LogOut,
  Mail,
  Key,
  RefreshCw,
  User,
  ExternalLink,
} from "lucide-react";
import { ProviderType } from "@/constants";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface AuthSectionProps {
  token: string;
  refreshToken: string;
  email: string;
  provider: { name: string; type: string; firebaseApp: any };
  setIsAuth: (v: boolean) => void;
}

function CopyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="group rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-border/80">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <button
          onClick={() => copy(value, label)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3 w-3 text-primary" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="rounded-lg bg-background/50 px-3 py-2">
        <p className="text-sm text-foreground font-mono truncate">{value}</p>
      </div>
    </div>
  );
}

export function AuthSection({
  token,
  refreshToken,
  email,
  provider,
  setIsAuth,
}: AuthSectionProps) {
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!token || provider.type !== ProviderType.PLATFORM) return;
    const controller = new AbortController();
    fetch("https://account-apis.landverse.dev.maxion.gg/user/user-data", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text) throw new Error("Empty response body");
        return JSON.parse(text);
      })
      .then((data) => {
        setUserData(data.data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    return () => controller.abort();
  }, [token, provider.type]);

  const handleSignOut = async () => {
    try {
      await provider.firebaseApp.auth().signOut();
      setIsAuth(false);
      toast.success("Signed out");
    } catch (error) {
      console.error("Sign-out error:", error);
      toast.error("Sign-out failed");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* User card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{email}</p>
              <p className="text-sm text-muted-foreground">{provider.name}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive transition-all hover:bg-destructive/10 shrink-0"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Tokens */}
      <div className="space-y-3">
        <CopyField
          label="Google Account"
          value={email}
          icon={<Mail className="h-3.5 w-3.5 text-primary" />}
        />
        <CopyField
          label="Access Token"
          value={token}
          icon={<Key className="h-3.5 w-3.5 text-primary" />}
        />
        <CopyField
          label="Refresh Token"
          value={refreshToken}
          icon={<RefreshCw className="h-3.5 w-3.5 text-primary" />}
        />
      </div>

      {/* User Data */}
      {userData && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Platform User Data
            </span>
          </div>
          <pre className="rounded-lg bg-background/50 p-3 text-xs text-muted-foreground font-mono overflow-auto max-h-48">
            {JSON.stringify(userData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
