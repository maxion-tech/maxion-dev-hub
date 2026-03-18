import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0b",
        foreground: "#fafafa",
        card: "#111113",
        "card-foreground": "#fafafa",
        popover: "#111113",
        "popover-foreground": "#fafafa",
        primary: "#f5c518",
        "primary-foreground": "#0a0a0b",
        secondary: "#1c1c1f",
        "secondary-foreground": "#fafafa",
        muted: "#1c1c1f",
        "muted-foreground": "#71717a",
        accent: "#1c1c1f",
        "accent-foreground": "#fafafa",
        destructive: "#ef4444",
        "destructive-foreground": "#fafafa",
        border: "#27272a",
        input: "#27272a",
        ring: "#f5c518",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
