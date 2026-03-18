import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// BSC Testnet
export const bscTestnet = defineChain({
  id: 97,
  name: "BSC Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://data-seed-prebsc-1-s1.binance.org:8545"] },
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://testnet.bscscan.com" },
  },
  testnet: true,
});

// Saigon Testnet (Ronin)
export const saigonTestnet = defineChain({
  id: 202601,
  name: "Saigon Testnet",
  nativeCurrency: { name: "RON", symbol: "RON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://saigon-testnet.roninchain.com/rpc"] },
  },
  blockExplorers: {
    default: { name: "Ronin Explorer", url: "https://saigon-app.roninchain.com" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [bscTestnet, saigonTestnet],
  connectors: [
    // MetaMask / generic injected (window.ethereum)
    injected(),
    // Ronin Wallet (window.ronin.provider)
    injected({
      target() {
        return {
          id: "ronin",
          name: "Ronin Wallet",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provider: typeof window !== "undefined" ? (window as any).ronin?.provider : undefined,
        };
      },
    }),
  ],
  transports: {
    [bscTestnet.id]: http(),
    [saigonTestnet.id]: http(),
  },
});
