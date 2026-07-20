// Reine Rollen-Logik ohne Server-Only-Abhängigkeiten (next/headers etc.) —
// sicher aus Client- UND Server-Komponenten importierbar. src/lib/auth.ts
// bündelt daneben die serverseitige Session-Auflösung (getCurrentUser).
export function isAdmin(role: string | undefined | null): boolean {
  return role === 'admin'
}
