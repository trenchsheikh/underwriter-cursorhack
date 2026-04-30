import type { ReactNode } from "react";

export const metadata = {
  title: "UnderWriter — Backend",
  description: "Autonomous underwriting backend. API only.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
