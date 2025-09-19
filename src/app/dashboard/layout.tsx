// src/app/dashboard/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard • Natal Transit AI',
  description: 'Gestione temi, persone e sinastria in tempo reale.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white">
      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
