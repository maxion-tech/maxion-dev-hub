"use client";

import { useState } from "react";
import Image from "next/image";
import firebase from "firebase/compat/app";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ThemeSelector } from "@/components/theme-selector";
import { SectionCard } from "@/components/ui/section-card";
import { SectionLabel } from "@/components/ui/section-label";

interface LoginSectionProps {
  provider: { name: string; type: string; firebaseApp: any };
  setIsAuth: (v: boolean) => void;
  setToken: (v: string) => void;
  setRefreshToken: (v: string) => void;
  setEmail: (v: string) => void;
}

export function LoginSection({
  provider,
  setIsAuth,
  setToken,
  setRefreshToken,
  setEmail,
}: LoginSectionProps) {
  const [loading, setLoading] = useState<"google" | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading("google");
    try {
      const googleProvider = new firebase.auth.GoogleAuthProvider();
      const result = await provider.firebaseApp.auth().signInWithPopup(googleProvider);
      const user = result.user;
      if (user) {
        setIsAuth(true);
        setToken(await user.getIdToken());
        setRefreshToken(user.refreshToken);
        setEmail(user.email || "");
        toast.success("Signed in successfully");
      }
    } catch (error: unknown) {
      console.error("Sign-in error:", error);
      toast.error("Sign-in failed. Please try again.");
    } finally {
      setLoading(null);
    }
  };


  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-info/5 blur-3xl" />
        <div className="absolute top-[20%] right-[10%] h-[40%] w-[30%] rounded-full bg-success/3 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/maxion-logo.webp"
            alt="Maxion"
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-cover mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Maxion Dev Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to access developer tools
          </p>
        </div>

        {/* Login Card */}
        <SectionCard blur className="p-8">
          <div className="mb-6">
            <SectionLabel as="label">Provider</SectionLabel>
            <div className="mt-2 flex items-center rounded-lg border border-border bg-secondary/50 px-4 py-2.5">
              <span className="text-sm text-foreground">{provider.name}</span>
            </div>
          </div>

          <div className="space-y-3">
            <SectionLabel as="p">Continue with</SectionLabel>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === "google" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <img src="https://account.maxion.gg/images/icons/Google.svg" alt="Google" className="h-5 w-5" />
              )}
              Continue with Google
            </button>

          </div>
        </SectionCard>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Maxion Platform &middot; Internal Developer Tool
        </p>

        {/* Theme switcher */}
        <div className="mt-5 max-w-[240px] mx-auto">
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}
