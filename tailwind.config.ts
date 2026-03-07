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
      colors: {
        bg:      '#0F0F1A',
        card:    '#16162A',
        border:  'rgba(255,255,255,0.08)',
        accent:  '#6366F1',
        accent2: '#8B5CF6',
        muted:   '#9CA3AF',
        success: '#16A34A',
        warning: '#D97706',
        error:   '#DC2626',
        gold:    '#C9A227',
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
