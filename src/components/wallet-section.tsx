"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignMessage,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256, type Address } from "viem";
// ethers is dynamically imported in signMetaMask to reduce initial bundle size
import { SiweMessage, generateNonce } from "siwe";
import {
  Wallet,
  Copy,
  Check,
  Unplug,
  PenTool,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Plus,
  Minus,
  X,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import { chains, games, type Chain, type Game, type Operator, type WalletType } from "@/constants";
import { ERC20_ABI, NFT_ABI } from "@/constants/abis";
import {
  setCookie,
  getCookie,
  deleteCookie,
  WEB3_TOKEN_COOKIE,
} from "@/utils/cookies";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Dropdown } from "@/components/ui/dropdown";

// ─── Connect Wallet Modal ──────────────────────────────────────

const WALLET_OPTIONS = [
  {
    id: "metamask" as const,
    name: "MetaMask",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
    connectorId: "injected",
  },
  {
    id: "ronin" as const,
    name: "Ronin Wallet",
    icon: "https://images.spr.so/cdn-cgi/imagedelivery/j42No7y-dcokJuNgXeA0ig/4008160d-9c07-4b42-b83c-9bf115c14fc9/Ronin_Mark_Blue/w=1920,quality=90,fit=scale-down",
    connectorId: "ronin",
  },
];

function ConnectWalletModal({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const { connect, connectors, isPending } = useConnect();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setConnectingId(null);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleConnect = (wallet: typeof WALLET_OPTIONS[number]) => {
    const connector = connectors.find((c) => c.id === wallet.connectorId);
    if (!connector) {
      toast.error(`${wallet.name} not detected. Please install the extension.`);
      return;
    }
    setConnectingId(wallet.id);
    connect(
      { connector },
      {
        onSuccess: () => {
          toast.success(`${wallet.name} connected`);
          onConnected();
          onClose();
        },
        onError: (err) => {
          console.error("Connect error:", err);
          toast.error("Failed to connect wallet");
          setConnectingId(null);
        },
      }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-lg font-semibold text-foreground">Connect Wallet</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-5 pt-1.5 text-xs text-muted-foreground">
          Choose a wallet to connect to Maxion Dev Hub
        </p>
        <div className="p-5 space-y-2">
          {WALLET_OPTIONS.map((wallet) => {
            const isConnecting = connectingId === wallet.id;
            const isDetected = connectors.some((c) => c.id === wallet.connectorId);

            return (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet)}
                disabled={isPending}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3.5 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:border-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Image
                  src={wallet.icon}
                  alt={wallet.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-lg object-contain"
                  unoptimized
                />
                <span className="flex-1 text-left">{wallet.name}</span>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isDetected ? (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-md bg-secondary border border-border">
                    Installed
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">
                    Not detected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const RONIN_SIGN_API = "https://account-apis.maxion.gg/user-ronin/sign";
const RONIN_CHAIN_ID = 2020;

// ─── Web3 Token Section ─────────────────────────────────────────

function Web3TokenSection({
  walletType,
  gameId,
}: {
  walletType: WalletType;
  gameId: string;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [walletToken, setWalletToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [signing, setSigning] = useState(false);
  const { copied: copiedToken, copy: copyToken } = useCopyToClipboard();

  const cookieKey = walletType === "ronin" ? "maxion_ronin_token" : WEB3_TOKEN_COOKIE;
  const expiryCookieKey = `${cookieKey}_expiry`;

  const parseMetaMaskExpiry = (token: string): Date | null => {
    try {
      const { verify } = require("web3-token");
      const { body } = verify(token);
      if (body?.["expiration-time"]) return new Date(body["expiration-time"]);
    } catch {
      // Token may be expired or malformed
    }
    return null;
  };

  useEffect(() => {
    const stored = getCookie(cookieKey);
    if (stored) {
      setWalletToken(stored);
      if (walletType === "metamask") {
        setTokenExpiry(parseMetaMaskExpiry(stored));
      } else {
        // Ronin — read expiry from separate cookie (set at sign time from API expiresIn)
        const expiryStr = getCookie(expiryCookieKey);
        if (expiryStr) setTokenExpiry(new Date(Number(expiryStr)));
      }
    }
  }, [cookieKey, walletType]);

  useEffect(() => {
    if (walletToken) setCookie(cookieKey, walletToken, 1);
  }, [walletToken, cookieKey]);

  const signMetaMask = async (): Promise<void> => {
    const ethereum = (window as unknown as { ethereum: any }).ethereum;
    const { ethers } = await import("ethers");
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const { sign } = await import("web3-token");
    const web3Token = await sign(
      async (msg: string) => await signer.signMessage(msg),
      "1d"
    );
    setWalletToken(web3Token);
    setTokenExpiry(parseMetaMaskExpiry(web3Token));
  };

  const signRonin = async (): Promise<void> => {
    const domain = `${gameId}.maxion.gg`;
    const uri = `https://${domain}`;
    const nonce = generateNonce();

    const siweMessage = new SiweMessage({
      domain,
      address: address!,
      statement: `I accept the dApp's Terms of Service: ${uri}/TermsConditions`,
      uri,
      version: "1",
      chainId: RONIN_CHAIN_ID,
      nonce,
    });

    const message = siweMessage.prepareMessage();

    const signature = await signMessageAsync({ message });

    // Exchange signature for JWT
    const res = await fetch(RONIN_SIGN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err}`);
    }

    const data: { token: string; expiresIn: number } = await res.json();
    const expiry = new Date(Date.now() + data.expiresIn);
    setWalletToken(data.token);
    setTokenExpiry(expiry);
    // Persist expiry separately — JWT exp doesn't match API expiresIn
    setCookie(expiryCookieKey, String(expiry.getTime()), 1);
  };

  const handleSign = async () => {
    if (!address || signing) return;
    setSigning(true);
    try {
      if (walletType === "ronin") {
        await signRonin();
      } else {
        await signMetaMask();
      }
      toast.success("Message signed & token saved");
    } catch (error) {
      console.error("Failed to sign:", error);
      toast.error("Failed to sign message");
    } finally {
      setSigning(false);
    }
  };

  const handleCopyToken = () => {
    if (walletToken) copyToken(walletToken);
  };

  // Live countdown — ticks every second
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!tokenExpiry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tokenExpiry]);

  const isExpired = tokenExpiry ? tokenExpiry.getTime() < now : false;

  const formatExpiry = (date: Date): string => {
    const diff = date.getTime() - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const label = walletType === "ronin" ? "Ronin Token" : "Web3 Token";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
        {tokenExpiry && (
          <span className={`text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
            {formatExpiry(tokenExpiry)}
          </span>
        )}
      </div>

      {walletToken && (
        <button
          onClick={handleCopyToken}
          className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            isExpired
              ? "bg-destructive/5 hover:bg-destructive/10"
              : "bg-secondary/50 hover:bg-secondary"
          }`}
        >
          <p className={`flex-1 text-xs font-mono truncate ${
            isExpired ? "text-destructive/60" : "text-muted-foreground"
          }`}>
            {walletToken}
          </p>
          <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
            {copiedToken ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </span>
        </button>
      )}

      <button
        onClick={handleSign}
        disabled={signing}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:border-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
        {signing ? "Waiting for signature..." : walletToken ? "Re-sign Token" : "Sign Message"}
      </button>
    </div>
  );
}

// ─── NFT Approval (ERC721/ERC1155 — setApprovalForAll toggle) ──

function ApprovalRow({
  operator,
  tokenAddress,
  tokenLabel,
}: {
  operator: Operator;
  tokenAddress: string;
  tokenLabel: string;
}) {
  const { address } = useAccount();

  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: tokenAddress as Address,
    abi: NFT_ABI,
    functionName: "isApprovedForAll",
    args: [address!, operator.address as Address],
    query: { enabled: !!address && !!operator.address && !!tokenAddress },
  });

  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      refetchApproval();
      toast.success("Transaction confirmed");
    }
  }, [isSuccess, refetchApproval]);

  const handleToggle = (approved: boolean) => {
    if (!operator.address) return;
    writeContract(
      {
        address: tokenAddress as Address,
        abi: NFT_ABI,
        functionName: "setApprovalForAll",
        args: [operator.address as Address, approved],
      },
      {
        onError: (err) => {
          console.error("setApprovalForAll error:", err);
          toast.error("Transaction failed");
        },
      }
    );
  };

  if (!tokenAddress || !operator.address) return null;

  const approved = isApproved as boolean | undefined;
  const isLoading = isWriting || isConfirming;

  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{tokenLabel}</span>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <span className="text-xs text-muted-foreground">
          Approval:{" "}
          <span className={approved ? "text-primary" : "text-muted-foreground"}>
            {approved === undefined ? "—" : approved ? "Approved" : "Not approved"}
          </span>
        </span>
      </div>

      <button
        onClick={() => handleToggle(!approved)}
        disabled={isLoading}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          approved
            ? "text-foreground hover:bg-destructive/10 hover:text-destructive"
            : "text-foreground hover:bg-secondary"
        }`}
      >
        {approved ? (
          <>
            <ShieldOff className="h-3.5 w-3.5" />
            <span>Revoke</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
            <span>Approve</span>
          </>
        )}
      </button>
    </div>
  );
}

// ─── ION Allowance (ERC20 — amount-based approve) ──────────────

function AllowanceRow({
  operator,
  tokenAddress,
  tokenLabel,
}: {
  operator: Operator;
  tokenAddress: string;
  tokenLabel: string;
}) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address!, operator.address as Address],
    query: { enabled: !!address && !!operator.address && !!tokenAddress },
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddress },
  });

  const { data: balance } = useReadContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address && !!tokenAddress },
  });

  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance();
      toast.success("Transaction confirmed");
    }
  }, [isSuccess, refetchAllowance]);

  const dec = (decimals as number) ?? 18;

  const handleApprove = (approveAmount: bigint) => {
    if (!operator.address) return;
    writeContract(
      {
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [operator.address as Address, approveAmount],
      },
      {
        onError: (err) => {
          console.error("Approve error:", err);
          toast.error("Transaction failed");
        },
      }
    );
  };

  const handleIncreaseByAmount = () => {
    if (!amount) return;
    try {
      const parsed = parseUnits(amount, dec);
      const current = (allowance as bigint) ?? 0n;
      handleApprove(current + parsed);
    } catch {
      toast.error("Invalid amount");
    }
  };

  const handleDecreaseByAmount = () => {
    if (!amount) return;
    try {
      const parsed = parseUnits(amount, dec);
      const current = (allowance as bigint) ?? 0n;
      const newAmount = current > parsed ? current - parsed : 0n;
      handleApprove(newAmount);
    } catch {
      toast.error("Invalid amount");
    }
  };

  const handleApproveMax = () => handleApprove(maxUint256);
  const handleRevoke = () => handleApprove(0n);

  if (!tokenAddress || !operator.address) return null;

  const formattedAllowance = allowance !== undefined
    ? (allowance as bigint) === maxUint256
      ? "Unlimited"
      : formatUnits(allowance as bigint, dec)
    : "—";

  const formattedBalance = balance !== undefined
    ? formatUnits(balance as bigint, dec)
    : "—";

  const isLoading = isWriting || isConfirming;
  const isUnlimited = allowance !== undefined && (allowance as bigint) === maxUint256;
  const isZero = allowance !== undefined && (allowance as bigint) === 0n;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 py-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{tokenLabel}</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
            <span>Balance: <span className="font-mono text-foreground/70">{formattedBalance}</span></span>
            <span className="hidden sm:inline text-border">·</span>
            <span>
              Allowance:{" "}
              <span className={`font-mono ${
                isUnlimited ? "text-primary" : isZero ? "text-muted-foreground" : "text-foreground/70"
              }`}>
                {formattedAllowance}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleApproveMax}
            disabled={isLoading}
            title="Approve unlimited"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
            <span className="hidden sm:inline">Unlimited</span>
          </button>
          <button
            onClick={handleRevoke}
            disabled={isLoading}
            title="Revoke allowance"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Revoke</span>
          </button>
          <button
            onClick={() => setShowAdjust(!showAdjust)}
            title="Adjust by custom amount"
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
              showAdjust
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            ±
          </button>
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: showAdjust ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex gap-2 pb-2">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 transition-colors"
            />
            <button
              onClick={handleIncreaseByAmount}
              disabled={isLoading || !amount}
              title="Increase allowance"
              className="flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-all hover:bg-secondary hover:border-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDecreaseByAmount}
              disabled={isLoading || !amount}
              title="Decrease allowance"
              className="flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-all hover:bg-secondary hover:border-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

// ─── Main Wallet Section ───────────────────────────────────────

export function WalletSection() {
  const { address, isConnected, chain: connectedChain, connector: activeConnector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [selectedChain, setSelectedChain] = useState<Chain>(chains[0]);
  const [selectedGame, setSelectedGame] = useState<Game>(games[chains[0].chainId][0]);
  const [selectedOperator, setSelectedOperator] = useState<Operator>(
    games[chains[0].chainId][0].operators[0]
  );
  const { copied: copiedAddress, copy: copyAddress } = useCopyToClipboard();
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Map wallet type → connector id
  const walletConnectorId = (wallet: string): string =>
    wallet === "ronin" ? "ronin" : "injected";

  // Sync chain selection when wallet connects
  useEffect(() => {
    if (!isConnected || !activeConnector) return;
    const matchingChain = chains.find(
      (c) => walletConnectorId(c.wallet) === activeConnector.id
    );
    if (matchingChain && matchingChain.chainId !== selectedChain.chainId) {
      setSelectedChain(matchingChain);
      const firstGame = games[matchingChain.chainId]?.[0];
      if (firstGame) {
        setSelectedGame(firstGame);
        setSelectedOperator(firstGame.operators[0]);
      }
    }
  }, [isConnected, activeConnector]);

  const chainGames = games[selectedChain.chainId] || [];

  const handleCopyAddress = () => {
    if (address) copyAddress(address);
  };

  const handleChainSelect = useCallback(
    (chain: Chain) => {
      setSelectedChain(chain);
      const firstGame = games[chain.chainId]?.[0];
      if (firstGame) {
        setSelectedGame(firstGame);
        setSelectedOperator(firstGame.operators[0]);
      }

      if (!isConnected) return;

      const targetConnectorId = walletConnectorId(chain.wallet);
      const needsWalletSwitch = activeConnector?.id !== targetConnectorId;

      if (needsWalletSwitch) {
        // Different wallet type required — disconnect, then connect with the correct one
        disconnect(undefined, {
          onSuccess: () => {
            const connector = connectors.find((c) => c.id === targetConnectorId);
            if (connector) {
              connect(
                { connector },
                {
                  onSuccess: () => {
                    toast.success(`Switched to ${chain.wallet === "ronin" ? "Ronin Wallet" : "MetaMask"}`);
                  },
                  onError: (err) => {
                    console.error("Reconnect error:", err);
                    toast.error(`Failed to connect ${chain.wallet === "ronin" ? "Ronin Wallet" : "MetaMask"}`);
                  },
                }
              );
            }
          },
        });
      } else {
        // Same wallet type — just switch network
        switchChain?.({ chainId: chain.chainId });
      }
    },
    [isConnected, activeConnector, disconnect, connect, connectors, switchChain]
  );

  const handleGameSelect = useCallback((game: Game) => {
    setSelectedGame(game);
    setSelectedOperator(game.operators[0]);
  }, []);

  const handleDisconnect = () => {
    disconnect();
    deleteCookie(WEB3_TOKEN_COOKIE);
    toast.success("Wallet disconnected");
  };

  const isMetaMaskChain = selectedChain.wallet === "metamask";
  const tokenContracts = selectedGame.contracts;
  const wrongChain = isConnected && connectedChain && connectedChain.id !== selectedChain.chainId;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Connection status bar ── */}
      <div className="rounded-2xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
          <div className="relative">
            <Wallet className="h-5 w-5 text-foreground/60" />
            {isConnected && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isConnected ? (
              <button
                onClick={handleCopyAddress}
                className="group flex items-center gap-2 text-sm font-mono text-foreground hover:text-primary transition-colors min-w-0 max-w-full"
              >
                <span className="truncate hidden sm:inline">{address}</span>
                <span className="sm:hidden">{address ? shortenAddress(address) : ""}</span>
                {copiedAddress ? (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                )}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">No wallet connected</p>
            )}
          </div>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              title="Disconnect wallet"
              className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              <Unplug className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shrink-0"
            >
              Connect
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Wrong chain warning */}
        {wrongChain && (
          <div className="mx-5 mb-4 sm:mx-6 rounded-lg bg-primary/5 border border-primary/10 px-4 py-2.5">
            <p className="text-xs text-foreground/80">
              Wrong network.{" "}
              <button
                onClick={() => switchChain?.({ chainId: selectedChain.chainId })}
                className="text-primary font-medium hover:underline underline-offset-2"
              >
                Switch to {selectedChain.name}
              </button>
            </p>
          </div>
        )}

        {/* Web3 Token — revealed inline when connected */}
        {isConnected && (
          <div className="border-t border-border px-5 py-4 sm:px-6">
            <Web3TokenSection key={`${selectedChain.wallet}-${selectedChain.chainId}`} walletType={selectedChain.wallet} gameId={selectedGame.id} />
          </div>
        )}
      </div>

      <ConnectWalletModal
        open={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnected={() => {
          switchChain?.({ chainId: selectedChain.chainId });
        }}
      />

      {/* ── Configuration ── */}
      <div className="space-y-6">
        {/* Chain selector — inline segments for 2 options */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2.5 block">
            Chain
          </label>
          <div className="flex sm:inline-flex rounded-lg border border-border p-0.5">
            {chains.map((chain) => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSelect(chain)}
                className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium transition-all ${
                  selectedChain.chainId === chain.chainId
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{chain.name}</span>
                <span className={`text-[10px] uppercase tracking-wide ${
                  selectedChain.chainId === chain.chainId
                    ? "text-primary"
                    : "text-muted-foreground/50"
                }`}>
                  {chain.wallet}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Game & Operator dropdowns */}
        <div className="grid gap-5 sm:grid-cols-2">
          {chainGames.length > 0 && (
            <Dropdown
              label="Game"
              value={selectedGame}
              options={chainGames}
              getKey={(g) => g.id}
              renderSelected={(g) => <span>{g.name}</span>}
              renderOption={(g) => <span>{g.name}</span>}
              onChange={handleGameSelect}
            />
          )}

          <Dropdown
            label="Operator"
            value={selectedOperator}
            options={selectedGame.operators}
            getKey={(op) => op.address || op.name}
            renderSelected={(op) => <span>{op.name}</span>}
            renderOption={(op) => (
              <div className="flex flex-col items-start">
                <span className="text-foreground">{op.name}</span>
                {op.address && (
                  <span className="text-xs text-muted-foreground font-mono truncate w-full">
                    <span className="hidden sm:inline">{op.address}</span>
                    <span className="sm:hidden">{shortenAddress(op.address, 6)}</span>
                  </span>
                )}
              </div>
            )}
            onChange={setSelectedOperator}
          />
        </div>
      </div>

      {/* ── Approvals & Allowances ── */}
      {isConnected && selectedOperator.address && (
        <div className="rounded-2xl border border-border bg-card px-5 sm:px-6">
          <div className="flex items-center justify-between py-4 pb-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Approvals & Allowances</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {selectedOperator.name}
            </span>
          </div>

          {tokenContracts.nft && (
            <ApprovalRow
              operator={selectedOperator}
              tokenAddress={tokenContracts.nft}
              tokenLabel="NFT Token"
            />
          )}

          {tokenContracts.nft && tokenContracts.ion && (
            <div className="border-t border-border/50" />
          )}

          {tokenContracts.ion && (
            <AllowanceRow
              operator={selectedOperator}
              tokenAddress={tokenContracts.ion}
              tokenLabel="ION Token"
            />
          )}

          {!tokenContracts.nft && !tokenContracts.ion && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No token contracts for {selectedGame.name} on {selectedChain.name}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
