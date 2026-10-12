import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShipShape",
  description:
    "Damage repair workflows for field reports, engineering analysis, and approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
