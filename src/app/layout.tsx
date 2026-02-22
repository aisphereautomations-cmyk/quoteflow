import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quote Flow - Login",
  description: "Quote Flow - Let's Quote together!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
