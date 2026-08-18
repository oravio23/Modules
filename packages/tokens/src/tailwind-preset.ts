import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Shared Tailwind preset for every Oravio app. Every app's own tailwind.config.ts does:
 *
 *   import { oravioPreset } from "@oravio/tokens/tailwind-preset";
 *   export default { presets: [oravioPreset], content: [...] } satisfies Config;
 *
 * Gotcha: colors reference the CSS variables directly (`var(--primary)`), NOT wrapped in
 * `hsl(...)`. Oravio's brand tokens in tokens.css are hex values, not bare HSL triplets like
 * stock shadcn — `hsl(#111832)` is invalid CSS and colors would silently fail to render.
 */
export const oravioPreset = {
  darkMode: undefined, // light-only, matching oravio.co — see tokens.css
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        arabic: ["var(--font-arabic)"],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted-bg)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        // Oravio brand tokens exposed directly for the oravio/* components and one-off styling —
        // prefer these named utilities (e.g. bg-oravio-navy) over hardcoding hex in app code.
        oravio: {
          ink: "var(--ink)",
          muted: "var(--muted)",
          line: "var(--line)",
          paper: "var(--paper)",
          panel: "var(--panel)",
          field: "var(--field)",
          teal: "var(--teal)",
          "teal-dark": "var(--teal-dark)",
          "teal-bright": "var(--teal-bright)",
          navy: "var(--navy)",
          "navy-soft": "var(--navy-soft)",
          amber: "var(--amber)",
          blue: "var(--blue)",
          // Dark "operations portal" chrome — see tokens.css's own comment on where this
          // applies (post-login only; landing/sign-in stay on the light tokens above).
          "app-bg": "var(--app-bg)",
          "app-surface": "var(--app-surface)",
          "app-surface-2": "var(--app-surface-2)",
          "app-line": "var(--app-line)",
          "app-text": "var(--app-text)",
          "app-text-muted": "var(--app-text-muted)",
          "app-bg-translucent": "var(--app-bg-translucent)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2lg": "var(--radius-lg)",
      },
      boxShadow: {
        "oravio-sm": "var(--shadow-sm)",
        "oravio-md": "var(--shadow-md)",
        "oravio-lg": "var(--shadow-lg)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        spring: "var(--ease-spring)",
      },
      maxWidth: {
        oravio: "var(--container)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Partial<Config>;

export default oravioPreset;
