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
    },
  },
  plugins: [],
}
