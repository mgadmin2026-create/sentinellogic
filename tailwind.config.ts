import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Marke — benannt statt als Hex-Wert im JSX verstreut (siehe docs/UI_UX_KONZEPT.md).
        // Werte unverändert gegenüber dem bisherigen #FFC300/#1A1A1A.
        brand: {
          DEFAULT: "#FFC300",
          hover: "#F5B800",
          dark: "#1A1A1A",
        },
      },
    },
  },
  plugins: [],
};
export default config;
