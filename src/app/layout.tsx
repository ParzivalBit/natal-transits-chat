// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Natal + Transits + Chat',
  description: 'Your chart-aware AI astrologer — wellness & entertainment only.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <header className="border-b">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <div className="font-semibold">Natal + Transits + Chat</div>
            <nav className="text-sm text-gray-600">MVP</nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">
          {children}
        </main>
        <footer className="border-t text-xs text-gray-500">
          <div className="mx-auto max-w-5xl px-4 py-6 space-y-2">
            <p>
              Disclaimer: this app provides content for wellness &amp; entertainment purposes only.
              It does not replace professional medical, legal, or financial advice.
            </p>
            <p>
              Transparency: MVP uses Whole Sign houses when birth time is available; otherwise a solar chart
              (no houses/ASC) with simplified orbs.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
