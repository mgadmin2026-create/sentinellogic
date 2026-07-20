import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Sentimental Logic',
  description: 'CRM + Vertriebssystem für Versicherungen',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Auf /login gibt es keine Session — getCurrentUser() liefert dann null,
  // Sidebar blendet sich in dem Fall selbst aus (siehe usePathname-Check dort).
  const currentUser = await getCurrentUser()

  return (
    <html lang="de">
      <body className="antialiased bg-gray-50 text-[#1A1A1A]">
        <div className="flex md:h-screen min-h-dvh md:overflow-hidden">
          <Sidebar currentUser={currentUser} />
          {/* pt-14 schafft Platz für die mobile Top-Bar; ab md wieder normal */}
          <main className="flex-1 md:overflow-y-auto pt-14 md:pt-0 min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
