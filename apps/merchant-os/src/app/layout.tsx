import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mercury OS - Merchant control center",
  description: "Merchant intelligence, policy controls, and the audit trail for the Mercury AI commerce platform.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  )
}
