import type { ReactNode } from "react";

export const metadata = {
  title: "Mandate — Backend",
  description: "Autonomous underwriting backend. API only.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
