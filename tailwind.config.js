/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design system colors matching the mockup
        surface: {
          base: '#F5F5F7',
          card: '#FFFFFF',
          hover: '#F0F0F2',
          active: '#E8E8EC',
        },
        border: {
          default: '#E5E5EA',
          subtle: '#F0F0F2',
        },
        text: {
          primary: '#1D1D1F',
          secondary: '#6E6E73',
          tertiary: '#AEAEB2',
        },
        accent: {
          blue: '#007AFF',
          green: '#34C759',
          orange: '#FF9500',
          red: '#FF3B30',
          purple: '#AF52DE',
        },
        status: {
          active: '#34C759',
          warning: '#FF9500',
          error: '#FF3B30',
          info: '#007AFF',
          neutral: '#AEAEB2',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'toast-in': 'toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
