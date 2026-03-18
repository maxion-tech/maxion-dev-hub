import type { Metadata } from "next";
import "./globals.css";
import { Web3Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Maxion Dev Hub",
  description: "Developer tools & authentication hub for Maxion Platform",
  icons: {
    icon: "https://cdn.prod.website-files.com/62ecfefc58b878e68b3c7c20/6673f3ade8f353e75cd1f090_Vector.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <Web3Providers>{children}</Web3Providers>
      </body>
    </html>
  );
}
