import { platformFirebase } from "@/config/firebase";

export const ProviderType = {
  PLATFORM: "PLATFORM",
  CMS: "CMS",
} as const;

export type ProviderTypeValue = (typeof ProviderType)[keyof typeof ProviderType];

export interface Provider {
  name: string;
  type: ProviderTypeValue;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firebaseApp: any;
}

export const providers = [
  {
    name: "Maxion Platform",
    type: ProviderType.PLATFORM,
    firebaseApp: platformFirebase,
  },
];

export type WalletType = "metamask" | "ronin";

export interface Chain {
  name: string;
  chainId: number;
  rpcUrl: string;
  wallet: WalletType;
}

export const chains: Chain[] = [
{
    name: "BSC Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    wallet: "metamask",
  },
  {
    name: "Saigon Testnet",
    chainId: 202601,
    rpcUrl: "https://saigon-testnet.roninchain.com/rpc",
    wallet: "ronin",
  },
];

// ─── Game & Contracts ──────────────────────────────────────────

export interface Game {
  id: string;
  name: string;
  contracts: { nft: string; ion: string };
  operators: Operator[];
}

export interface Operator {
  name: string;
  address: string;
}

// chainId → Game[]
// Chains with a single game just have one entry.
export const games: Record<number, Game[]> = {
97: [
    {
      id: "rolth",
      name: "Ragnarok Landverse Thailand",
      contracts: {
        nft: "0x2F2c1D8fC5C242D6C9fC14B9e9997f55eFf2D61a",
        ion: "0x1B3eb089cB7aAEE3c119091ce291590F464Eb6a5",
      },
      operators: [
        { name: "Topup", address: "0x97f23294F47155C4CEF55088C80BE34b2aDC1ABc" },
        { name: "Transfer Credit Topup", address: "0x196546981A839E99eaEc70D91CD45Ad59b511B17" },
        { name: "Redeem Multiple", address: "0x2b86f9D1d9BAD3E2c9a174B5B614F97734c12284" },
        { name: "Marketplace", address: "0x04C868c3F9bE43E4297386276609d355BF0Fc861" },
      ],
    },
  ],
  202601: [
    {
      id: "rolg",
      name: "Ragnarok Landverse Genesis",
      contracts: {
        nft: "0x2F2c1D8fC5C242D6C9fC14B9e9997f55eFf2D61a",
        ion: "0xcC5da0dA34dE144d4a3766F4Dd15C727E75B6116",
      },
      operators: [
        { name: "Topup", address: "0x5f98a7F188461EC00b7da288eb66A907a018b098" },
        { name: "Transfer Credit Topup", address: "0xB1eB1BC5f586faf6Dc0B53135de7288cdb3E2675" },
        { name: "Redeem", address: "0x2b86f9D1d9BAD3E2c9a174B5B614F97734c12284" },
        { name: "Redeem Multiple", address: "0x884D8395f1728D3B3777FD80071136D2Ad6092B3" },
      ],
    },
    {
      id: "rola",
      name: "Ragnarok Landverse Americas",
      contracts: {
        nft: "0xdA1a02a1C378e62FE7d8125AC47436ca8b68E9c6",
        ion: "0xcC5da0dA34dE144d4a3766F4Dd15C727E75B6116",
      },
      operators: [
        { name: "Topup", address: "0xd0cA77B8202FB3604C96D00ae1e2124446361F69" },
        { name: "Transfer Credit Topup", address: "0xB5D2fC5628aE5537A9c62E9FCA1c242b470d455a" },
        { name: "Redeem", address: "0x707E01652c8457B3E14F544040a31b82BebE376B" },
        { name: "Redeem Multiple", address: "0xa79b283201279458191931Ac51d3BA76279519b9" },
      ],
    },
  ],
};
