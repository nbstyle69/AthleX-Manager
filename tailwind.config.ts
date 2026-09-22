import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'ax-control': 'var(--ax-radius-control)',
        'ax-badge': 'var(--ax-radius-badge)',
        'ax-card': 'var(--ax-radius-card)',
        'ax-panel': 'var(--ax-radius-panel)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'ax-panel': 'var(--ax-shadow-panel)',
      },
      backdropBlur: {
        'ax-glass': 'var(--ax-blur-glass)',
      },
      colors: {
        ax: {
          background: 'var(--ax-background)',
          surface: 'var(--ax-surface)',
          'surface-secondary': 'var(--ax-surface-secondary)',
          text: 'var(--ax-text)',
          'text-secondary': 'var(--ax-text-secondary)',
          'text-muted': 'var(--ax-text-muted)',
          accent: 'var(--ax-accent)',
          'accent-foreground': 'var(--ax-accent-foreground)',
          'accent-text': 'var(--ax-accent-text)',
          'accent-soft': 'var(--ax-accent-soft)',
          focus: 'var(--ax-focus)',
          border: 'var(--ax-border)',
          'input-border': 'var(--ax-input-border)',
          glass: 'var(--ax-glass)',
          overlay: 'var(--ax-overlay)',
          hover: 'var(--ax-hover)',
          success: 'var(--ax-success)',
          'success-soft': 'var(--ax-success-soft)',
          warning: 'var(--ax-warning)',
          'warning-soft': 'var(--ax-warning-soft)',
          danger: 'var(--ax-danger)',
          'danger-soft': 'var(--ax-danger-soft)',
          info: 'var(--ax-info)',
          'info-soft': 'var(--ax-info-soft)',
          neutral: 'var(--ax-neutral)',
          'neutral-soft': 'var(--ax-neutral-soft)',
          purple: 'var(--ax-purple)',
        },
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        // landing surfaces — translucent glass used by the pricing / CTA chrome
        landing: {
          surface: 'rgba(255,255,255,0.10)',
          'surface-hover': 'rgba(255,255,255,0.16)',
          border: 'rgba(255,255,255,0.10)',
        },
        // brand accent — emerald, used for glows and the featured plan ring
        brand: {
          DEFAULT: '#10B981',
          light: '#6EE7B7',
          dark: '#047857',
        },
        // legacy tokens (back office) — kept until its restyle
        bg:      '#0A0A0A',
        accent2: '#FFFFFF',
        success: '#16A34A',
        warning: '#D97706',
        error:   '#DC2626',
        gold:    '#FFFFFF',
      },
      animation: { 'accordion-down': 'accordion-down 0.2s ease-out', 'accordion-up': 'accordion-up 0.2s ease-out' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
