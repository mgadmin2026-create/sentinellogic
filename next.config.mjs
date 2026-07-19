/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ermöglicht isolierte CI-/Prüf-Builds neben einem laufenden Dev-Server.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
