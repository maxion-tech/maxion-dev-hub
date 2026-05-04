"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Toaster } from "sonner";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { LoginSection } from "@/components/login-section";
import { AuthSection } from "@/components/auth-section";
import { platformFirebase } from "@/config/firebase";
import { providers, ProviderType } from "@/constants";
import { useTheme } from "@/hooks/use-theme";

function TabSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="h-32 rounded-2xl bg-card border border-border" />
      <div className="h-20 rounded-xl bg-card border border-border" />
    </div>
  );
}

// Lazy-load heavy sections — only fetched when their tab is active
const WalletSection = dynamic(
  () => import("@/components/wallet-section").then((m) => ({ default: m.WalletSection })),
  { ssr: false, loading: () => <TabSkeleton /> }
);
const TextFormatterSection = dynamic(
  () => import("@/components/text-formatter-section").then((m) => ({ default: m.TextFormatterSection })),
  { ssr: false, loading: () => <TabSkeleton /> }
);
const GanttCsvSection = dynamic(
  () => import("@/components/gantt-csv-section").then((m) => ({ default: m.GanttCsvSection })),
  { ssr: false, loading: () => <TabSkeleton /> }
);
const ApiKeySection = dynamic(
  () => import("@/components/api-key-section").then((m) => ({ default: m.ApiKeySection })),
  { ssr: false, loading: () => <TabSkeleton /> }
);

export type TabId = "auth" | "wallet" | "delimiters" | "json" | "env" | "gantt" | "apikey";

const tabLabels: Record<TabId, string> = {
  auth: "Authentication",
  wallet: "Wallet Connection",
  delimiters: "Text Delimiters",
  json: "JSON to String",
  env: "ENV Converter",
  gantt: "Gantt to CSV",
  apikey: "API Key Generator",
};

type ProviderItem = (typeof providers)[number];

export default function Home() {
  const [isAuth, setIsAuth] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [email, setEmail] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("auth");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderItem>(providers[0]);
  const { theme } = useTheme();

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Listen to Firebase auth state
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = platformFirebase.auth().onAuthStateChanged(async (user: any) => {
      if (user) {
        setIsAuth(true);
        const p = providers.find((p) => p.type === ProviderType.PLATFORM);
        if (p) setProvider(p);
        const idToken = await user.getIdToken();
        setToken(idToken);
        setRefreshToken(user.refreshToken);
        setEmail(user.email || "");
      } else {
        setIsAuth(false);
        setToken("");
        setRefreshToken("");
        setEmail("");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-primary/30" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuth) {
    return (
      <>
        <LoginSection
          provider={provider}
          setIsAuth={setIsAuth}
          setToken={setToken}
          setRefreshToken={setRefreshToken}
          setEmail={setEmail}
        />
        <Toaster theme={theme === "light" ? "light" : "dark"} position="bottom-right" richColors />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        email={email}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={closeMobileMenu}
      />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="flex md:hidden items-center gap-3 h-12 px-4 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {tabLabels[activeTab]}
          </span>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {activeTab === "auth" && (
            <AuthSection
              token={token}
              refreshToken={refreshToken}
              email={email}
              provider={provider}
              setIsAuth={setIsAuth}
            />
          )}
          {activeTab === "wallet" && <WalletSection />}
          {activeTab === "delimiters" && <TextFormatterSection mode="delimiters" />}
          {activeTab === "json" && <TextFormatterSection mode="json" />}
          {activeTab === "env" && <TextFormatterSection mode="env" />}
          {activeTab === "gantt" && <GanttCsvSection />}
          {activeTab === "apikey" && <ApiKeySection />}
        </div>
      </main>
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
