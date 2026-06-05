import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#050505',
        surface: '#121212',
        'surface-hover': '#1A1A1A',
        'text-primary': '#F3F4F6',
        'text-secondary': '#9CA3AF',
        accent: '#3ae86d', // Brighter green for AgentNet look
        'accent-dim': 'rgba(58, 232, 109, 0.15)',
        'border-subtle': 'rgba(255, 255, 255, 0.08)',
        success: '#3ae86d',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
