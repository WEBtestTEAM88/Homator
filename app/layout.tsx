import { Toaster } from "@/components/ui/toaster"
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Homator',
  description: 'Home Automation Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}