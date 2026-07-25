/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#ECFDF9',
          100: '#D1FAF2',
          200: '#A7F3E3',
          300: '#6EE7D2',
          400: '#35CBB5',
          500: '#14A896',
          600: '#0D897B',
          700: '#0F6D64',
          800: '#115750',
          900: '#124842',
          950: '#062D2A',
        },
        accent: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        sidebar: {
          DEFAULT: '#0A1628',
          hover: '#14243B',
          active: '#173049',
          border: '#20344D',
          text: '#D8E4EF',
          muted: '#7890A8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'metric-lg': ['2.25rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.025em' }],
        'metric-sm': ['1.5rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.025em' }],
        'label': ['0.6875rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'elevated': '0 12px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'sidebar': '8px 0 36px rgba(7,20,38,0.16)',
        'modal': '0 25px 80px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.08)',
        'input-focus': '0 0 0 3px rgba(79, 70, 229, 0.15)',
        'button-primary': '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(79, 70, 229, 0.4)',
        'soft': '0 2px 15px rgba(0,0,0,0.04)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.15)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-down': 'fade-in-down 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'skeleton': 'skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin-slow 1s linear infinite',
      },
      spacing: {
        'sidebar': '16rem',
        'sidebar-collapsed': '4.5rem',
        'header': '4rem',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [],
}
