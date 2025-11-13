import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "@/components/providers/session-provider"

export const metadata: Metadata = {
  title: "Multi-Platform E-Commerce Management System",
  description: "One Dashboard to Rule Them All - Manage all your selling platforms from a single, powerful interface.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
