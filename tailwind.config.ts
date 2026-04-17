import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#181818",
          yellow: "#ffd480",
          pink: "#ff9393",
          green: "#c8ccc2",
          cream: "#fbfaf8",
        }
      },
      fontFamily: {
        sans: ['"SF Pro Display"', "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
