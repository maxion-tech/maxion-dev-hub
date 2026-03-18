# Maxion Dev Hub

Internal developer tools & authentication hub for the Maxion Platform.

## Stack

- **Framework**: Next.js 15 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS 3 + tailwindcss-animate
- **UI**: Radix UI primitives + Lucide React icons
- **Auth**: Firebase Auth (dual instances — Platform + CMS)
- **Web3**: Wagmi 3 + Viem 2 + ethers.js 5 + web3-token
- **Deploy**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/                  # Next.js App Router (layout, page, globals)
├── components/           # Feature-based client components
│   ├── providers.tsx     # WagmiProvider + QueryClientProvider
│   ├── sidebar.tsx       # Responsive nav sidebar
│   ├── login-section.tsx # Firebase Google sign-in
│   ├── auth-section.tsx  # Token display + user data
│   ├── wallet-section.tsx      # Web3 wallet + allowance management
│   ├── text-formatter-section.tsx  # Text/JSON/ENV converters
│   └── gantt-csv-section.tsx       # Mermaid Gantt → ClickUp CSV
├── config/               # Firebase & Wagmi configuration
├── constants/            # Chains, contracts, ABIs
├── lib/                  # Utilities (cn)
├── utils/                # Cookie helpers
└── types/                # Type declarations
```

## Features

- **Firebase Auth** — Google sign-in with token inspection for both Platform and CMS apps
- **Web3 Wallet** — Connect MetaMask/Ronin, sign tokens, manage ERC-20 allowances
- **Text Formatter** — Case conversion, JSON/ENV transformers
- **Gantt CSV** — Convert Mermaid Gantt charts to ClickUp CSV format

## Supported Chains

| Chain | ID |
|-------|----|
| BSC Testnet | 97 |
| Saigon Testnet | 202601 |
