import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16A34A",
          dark: "#15803D",
          light: "#DCFCE7",
        },
      },
    },
  },
  plugins: [],
};
export default config;
