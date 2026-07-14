import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Sentimental Logic',
  description: 'CRM + Vertriebssystem für Versicherungen',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased bg-gray-50 text-[#1A1A1A]">
        <div className="flex md:h-screen min-h-dvh md:overflow-hidden">
          <Sidebar />
          {/* pt-14 schafft Platz für die mobile Top-Bar; ab md wieder normal */}
          <main className="flex-1 md:overflow-y-auto pt-14 md:pt-0 min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
