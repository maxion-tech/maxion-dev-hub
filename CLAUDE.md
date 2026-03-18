# Maxion Dev Hub

Internal developer tools & authentication hub for the Maxion Platform.

## Stack

- **Framework**: Next.js 15 (App Router) + React 18 + TypeScript (strict mode)
- **Styling**: Tailwind CSS 3 + tailwindcss-animate
- **UI**: Radix UI primitives + Lucide React icons
- **Auth**: Firebase Auth (compat API) — dual instances (Platform + CMS)
- **Web3**: Wagmi 3 + Viem 2 + ethers.js 5 + web3-token
- **State**: React local state + TanStack React Query (via Wagmi)
- **Notifications**: Sonner toast
- **Deploy**: Vercel

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── layout.tsx        # Root layout (fonts, providers, dark mode)
│   ├── page.tsx          # Main dashboard — tabbed interface
│   └── globals.css       # Tailwind directives + custom scrollbar/animations
├── components/           # Feature-based components (all "use client")
│   ├── providers.tsx     # WagmiProvider + QueryClientProvider
│   ├── sidebar.tsx       # Responsive nav sidebar with collapse
│   ├── login-section.tsx # Firebase Google sign-in
│   ├── auth-section.tsx  # Token display + user data
│   ├── wallet-section.tsx      # Web3 wallet + allowance management
│   ├── text-formatter-section.tsx  # Text/JSON/ENV converters
│   └── gantt-csv-section.tsx       # Mermaid Gantt → ClickUp CSV
├── config/
│   ├── firebase.ts       # Dual Firebase app init (Platform + CMS)
│   └── wagmi.ts          # Wagmi chains + connectors config
├── constants/
│   ├── index.ts          # Chains, games, operators, contract addresses
│   ├── text-cases.ts     # Text case transformation definitions
│   └── abis/             # Contract ABIs (ERC20, ION, NFT, Marketplace, Redeem, Topup)
├── lib/
│   └── utils.ts          # cn() — clsx + tailwind-merge
├── utils/
│   └── cookies.ts        # Cookie helpers for Web3 token persistence
└── types/
    └── modules.d.ts      # Type declarations for untyped packages
```

## Architecture & Conventions

### Component Patterns

- All interactive components use `"use client"` directive — server rendering is layout-only.
- Components are organized by **feature**, not by type. Each section is a self-contained file.
- State lives locally in components via `useState`. No global store.
- Wagmi hooks handle Web3 state; Firebase `onAuthStateChanged` handles auth state.

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `wallet-section.tsx` |
| Components | PascalCase | `WalletSection` |
| Constants | UPPER_SNAKE_CASE | `SUPPORTED_CHAINS` |
| Interfaces | PascalCase | `ChainConfig` |
| CSS classes | Tailwind utilities | `bg-card text-foreground` |

### Key Patterns Used Throughout

- **Copy-to-clipboard**: `navigator.clipboard.writeText()` → success toast → 2s reset
- **Modals**: `fixed inset-0 z-50` backdrop + body scroll lock + Escape key handler
- **Dropdowns**: Custom components with click-outside detection via refs + Escape key
- **Keyboard shortcuts**: `Cmd/Ctrl+Enter` for primary actions
- **Class merging**: Always use `cn()` from `@/lib/utils` for combining Tailwind classes
- **Imports**: Use `@/` path alias (maps to `src/`)

### Firebase Auth

- Uses **compat API** (`firebase/compat/app`, `firebase/compat/auth`) — not modular SDK.
- Two Firebase app instances: `platformFirebase` (maxionid) and `cmsFirebase` (maxion-rop2e-cms).
- Auth flow: `signInWithPopup` → Google provider → store tokens in state.
- User data fetched from `account-apis.landverse.dev.maxion.gg`.

### Web3 / Wallet

- Wagmi for React hooks (`useAccount`, `useReadContract`, `useWriteContract`).
- ethers.js 5 for message signing (web3-token).
- Supported chains: BSC Testnet (97), Saigon Testnet (202601).
- Wallet types: MetaMask and Ronin.
- Web3 tokens stored in cookies (`maxion_web3_token`).

### Environment Variables

All prefixed with `NEXT_PUBLIC_` (client-side accessible):
- `NEXT_PUBLIC_PLATFORM_*` — Platform Firebase config
- `NEXT_PUBLIC_CMS_*` — CMS Firebase config

## Code Style Rules

- **TypeScript strict mode** — no implicit any, explicit return types on async functions.
- **No unused variables** — clean up imports and declarations.
- **Inline interfaces** preferred for component props unless reused.
- **Tailwind only** — no inline styles, no CSS modules, no styled-components.
- **Radix UI** for any new interactive primitives (dialogs, selects, tooltips, etc.).
- **Lucide React** for all icons at `h-4 w-4` (16px) default size.
- **Sonner `toast()`** for all user feedback — no `alert()` or custom notification systems.
- **lodash** available for text transforms (camelCase, snakeCase, etc.) — import individual functions.

## Design Context

### Users

Internal Maxion engineering team using the Dev Hub for authentication testing, wallet connections, and text formatting utilities during development. They are technical users who value efficiency and clarity — they want to get in, grab a token or convert some text, and get back to work.

### Brand Personality

**Modern, trusted, sharp.** The interface should feel like a premium developer tool — polished but not flashy, confident but not loud. It conveys reliability and technical competence.

### Aesthetic Direction

- **Visual tone**: Dark-mode-first, minimal, precise. Clean surfaces with subtle depth (backdrop blur, soft gradients). Gold/yellow primary (#f5c518) as a signature accent against near-black backgrounds.
- **References**: Vercel and Linear for the premium dark developer tool aesthetic — restrained use of color, excellent typography, subtle animations. Alchemy and Infura for the Web3 dashboard context — technical but accessible, information-dense without feeling cluttered.
- **Anti-references**: Overly colorful Web3 "crypto bro" aesthetics. Busy dashboards with excessive decoration. Generic Bootstrap-style admin panels.
- **Theme**: Dark mode only (`html.dark`). Background #0a0a0b, cards #111113, borders #27272a.
- **Typography**: Inter for UI text, JetBrains Mono for code/tokens. Tight tracking on headings, generous on labels.
- **Icons**: Lucide React, 16px (h-4 w-4) standard size.

### Color Tokens (Tailwind)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | #0a0a0b | Page background |
| `foreground` | #fafafa | Primary text |
| `card` | #111113 | Card/panel surfaces |
| `secondary` | #1c1c1f | Secondary surfaces |
| `border` | #27272a | All borders |
| `primary` | #f5c518 | Gold accent — buttons, links, focus rings |
| `muted-foreground` | #71717a | Dimmed/secondary text |
| `destructive` | #ef4444 | Error states, destructive actions |

### Design Principles

1. **Utility first** — Every element earns its place. Internal tools should prioritize function over flair.
2. **Quiet confidence** — Use the gold accent sparingly for emphasis. Let whitespace and typography do the heavy lifting.
3. **Developer empathy** — Monospace for copyable values, one-click actions, clear state indicators. Respect the developer's workflow.
4. **Consistent restraint** — Stick to the established token palette. Avoid introducing new colors without strong justification.
5. **Subtle polish** — Small details matter: smooth transitions (150ms), backdrop blur, rounded corners (lg: 0.75rem). Premium feel without performance cost.
