/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:  '#111118',
        panel:    '#16161f',
        border:   'rgba(255,255,255,0.07)',
        accent:   '#6366f1',
        'accent-hover': '#818cf8',
        success:  '#10b981',
        danger:   '#ef4444',
        warning:  '#f59e0b',
        muted:    '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
