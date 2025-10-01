// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import LabOrDefaultShell from './root-shell'; // ⬅️ nuovo client wrapper

export const metadata: Metadata = {
  title: 'Natal + Transits + Chat',
  description: 'Your chart-aware AI astrologer — wellness & entertainment only.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Notare: niente vincolo qui; deleghiamo a LabOrDefaultShell */}
      <body className="min-h-screen bg-white text-gray-900">
        <LabOrDefaultShell>{children}</LabOrDefaultShell>
      </body>
    </html>
  );
}
