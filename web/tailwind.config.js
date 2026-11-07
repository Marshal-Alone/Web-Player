/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        'surface-hover': 'var(--bg-hover)',
        border: 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'text-main': 'var(--text-primary)',
        'text-muted': 'var(--text-secondary)',
        'text-dim': 'var(--text-dim)',
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
          text: 'var(--accent-text)',
        },
        activity: {
          0: 'var(--activity-level-0)',
          1: 'var(--activity-level-1)',
          2: 'var(--activity-level-2)',
          3: 'var(--activity-level-3)',
          4: 'var(--activity-level-4)',
          border: 'var(--activity-border)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    },
  },
  plugins: [],
}
