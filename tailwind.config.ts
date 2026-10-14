import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

// Content Guidelines §14. Deviations (see TODO.md "Decisions made"):
// - popover colours mapped (D5 / #20)
// - mono uses the next/font variable for JetBrains Mono (D3)
// - `dark` safelisted so the §15 dark tokens survive purging
// - plugin loaded with an ES import instead of require() (same plugin; require() fails the next/typescript lint rules)
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  // next-themes adds `dark` at runtime; without this Tailwind purges the `.dark {}` token block in globals.css.
  safelist: ['dark'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '6px',
        lg: '8px',
        full: '9999px',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
