"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { useState } from "react";
import { ThemeContext, useThemeState } from "@/hooks/use-theme";

export function Web3Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeContext.Provider>
  );
}
