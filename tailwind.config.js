/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eefbff',
          100: '#d9f5ff',
          200: '#aced ff',
          300: '#6fe1ff',
          400: '#2aceff',
          500: '#00b0f0',
          600: '#008bcc',
          700: '#006fa5',
          800: '#005d88',
          900: '#064e70',
        },
        surface: {
          900: '#080c14',
          800: '#0d1321',
          700: '#111827',
          600: '#1a2235',
          500: '#1e293b',
          400: '#263348',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
