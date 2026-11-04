/** @type {import('tailwindcss').Config} */

// Apple's dynamic system colors live as CSS custom properties in
// src/index.css (:root = light appearance, .dark = dark appearance) and are
// referenced here. One semantic class therefore adapts to the active
// appearance, the way UIKit's systemBackground does. The values are stored as
// RGB channels, so Tailwind opacity modifiers keep working:
// bg-system-background/80, text-label/60, border-separator/40.
const systemColor = (token) => `rgb(var(--${token}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ECFDF9',
          100: '#D1FAF2',
          200: '#A7F3E3',
          300: '#6EE7D2',
          400: '#35CBB5',
          500: '#14A896',
          600: '#0C8175',
          700: '#0F6D64',
          800: '#115750',
          900: '#124842',
          950: '#062D2A'
        },
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F'
        },
        sidebar: {
          DEFAULT: '#0A1628',
          hover: '#14243B',
          active: '#173049',
          border: '#20344D',
          text: '#D8E4EF',
          muted: '#7890A8'
        },

        // ── Apple semantic backgrounds ──────────────────────────────────
        // UIKit: systemBackground, secondarySystemBackground, tertiary… and
        // the grouped set. Primary is the overall view, secondary groups
        // content inside it, tertiary groups content inside secondary.
        'system-background': systemColor('system-background'),
        'secondary-system-background': systemColor('secondary-system-background'),
        'tertiary-system-background': systemColor('tertiary-system-background'),
        'system-grouped-background': systemColor('system-grouped-background'),
        'secondary-system-grouped-background': systemColor('secondary-system-grouped-background'),
        'tertiary-system-grouped-background': systemColor('tertiary-system-grouped-background'),

        // ── Apple foreground content ────────────────────────────────────
        // UIKit: label, secondaryLabel, tertiaryLabel, quaternaryLabel,
        // placeholderText, separator, opaqueSeparator.
        label: systemColor('label'),
        'secondary-label': systemColor('secondary-label'),
        'tertiary-label': systemColor('tertiary-label'),
        'quaternary-label': systemColor('quaternary-label'),
        'placeholder-text': systemColor('placeholder-text'),
        separator: systemColor('separator'),
        'opaque-separator': systemColor('opaque-separator'),

        // ── Apple fills ─────────────────────────────────────────────────
        // Translucent layers in UIKit; pre-composited in src/index.css so
        // they behave as solid colors with working opacity modifiers.
        'system-fill': systemColor('system-fill'),
        'secondary-system-fill': systemColor('secondary-system-fill'),
        'tertiary-system-fill': systemColor('tertiary-system-fill'),
        'quaternary-system-fill': systemColor('quaternary-system-fill'),

        // ── Apple system accent colors ──────────────────────────────────
        'system-red': systemColor('system-red'),
        'system-orange': systemColor('system-orange'),
        'system-yellow': systemColor('system-yellow'),
        'system-green': systemColor('system-green'),
        'system-mint': systemColor('system-mint'),
        'system-teal': systemColor('system-teal'),
        'system-cyan': systemColor('system-cyan'),
        'system-blue': systemColor('system-blue'),
        'system-indigo': systemColor('system-indigo'),
        'system-purple': systemColor('system-purple'),
        'system-pink': systemColor('system-pink'),
        'system-brown': systemColor('system-brown'),
        'system-gray': systemColor('system-gray'),
        'system-gray-2': systemColor('system-gray-2'),
        'system-gray-3': systemColor('system-gray-3'),
        'system-gray-4': systemColor('system-gray-4'),
        'system-gray-5': systemColor('system-gray-5'),
        'system-gray-6': systemColor('system-gray-6')
      },
      fontFamily: {
        // SF Pro first: -apple-system/BlinkMacSystemFont resolve to the
        // dynamic optical-size system font on Apple platforms. Inter stays
        // next so Windows and Android keep the current face; the named
        // SF Pro entries cover machines with the font installed manually.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Inter',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'Outfit',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      fontSize: {
        // Tailwind's scale, retuned to SF Pro's tracking table
        // (HIG › Typography › Tracking values, iOS/iPadOS, 1/1000 em).
        // Line heights are unchanged, so nothing shifts vertically.
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0em' }], // 12 pt
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.011em' }], // 14 pt
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.02em' }], // 16 pt
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }], // 18 pt
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.023em' }], // 20 pt
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0.003em' }], // 24 pt
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '0.014em' }], // 30 pt
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '0.01em' }], // 36 pt
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '0.008em' }], // 48 pt
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '0.004em' }], // 60 pt
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '0.002em' }], // 72 pt
        '8xl': ['6rem', { lineHeight: '1', letterSpacing: '0em' }], // 96 pt
        '9xl': ['8rem', { lineHeight: '1', letterSpacing: '0em' }], // 128 pt

        // Apple's iOS text styles at the default ("Large") Dynamic Type size.
        // Size / line height / tracking / weight, straight from
        // HIG › Typography › iOS, iPadOS, visionOS default type sizes.
        'large-title': [
          '2.125rem',
          { lineHeight: '2.5625rem', letterSpacing: '0.012em', fontWeight: '400' }
        ], // 34 / 41
        'title-1': [
          '1.75rem',
          { lineHeight: '2.125rem', letterSpacing: '0.014em', fontWeight: '400' }
        ], // 28 / 34
        'title-2': [
          '1.375rem',
          { lineHeight: '1.75rem', letterSpacing: '-0.012em', fontWeight: '400' }
        ], // 22 / 28
        'title-3': [
          '1.25rem',
          { lineHeight: '1.5625rem', letterSpacing: '-0.023em', fontWeight: '400' }
        ], // 20 / 25
        headline: [
          '1.0625rem',
          { lineHeight: '1.375rem', letterSpacing: '-0.026em', fontWeight: '600' }
        ], // 17 / 22
        body: [
          '1.0625rem',
          { lineHeight: '1.375rem', letterSpacing: '-0.026em', fontWeight: '400' }
        ], // 17 / 22
        callout: ['1rem', { lineHeight: '1.3125rem', letterSpacing: '-0.02em', fontWeight: '400' }], // 16 / 21
        subheadline: [
          '0.9375rem',
          { lineHeight: '1.25rem', letterSpacing: '-0.016em', fontWeight: '400' }
        ], // 15 / 20
        footnote: [
          '0.8125rem',
          { lineHeight: '1.125rem', letterSpacing: '-0.006em', fontWeight: '400' }
        ], // 13 / 18
        'caption-1': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0em', fontWeight: '400' }], // 12 / 16
        'caption-2': [
          '0.6875rem',
          { lineHeight: '0.8125rem', letterSpacing: '0.006em', fontWeight: '400' }
        ], // 11 / 13

        // Product-specific styles kept from the existing design system.
        'metric-lg': ['2.25rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.025em' }],
        'metric-sm': [
          '1.5rem',
          { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.025em' }
        ],
        eyebrow: ['0.6875rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.05em' }]
      },
      // Standalone tracking for cases where size and tracking are set
      // independently. Everything else comes from the type scale above.
      letterSpacing: {
        'apple-display': '0.012em', // 34 pt and up
        'apple-title': '0.014em', // 28 pt
        'apple-body': '-0.026em', // 17 pt
        'apple-caption': '0.006em' // 11 pt
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem'
      },
      boxShadow: {
        // Apple elevation is shallow and neutral: a contact shadow plus a
        // soft ambient one. No colored glows; hierarchy comes from surfaces.
        xs: '0 1px 2px rgba(16, 24, 40, 0.05)',
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.03)',
        'card-hover': '0 4px 16px rgba(16, 24, 40, 0.07), 0 1px 3px rgba(16, 24, 40, 0.04)',
        elevated: '0 8px 28px rgba(16, 24, 40, 0.1), 0 2px 6px rgba(16, 24, 40, 0.05)',
        popover: '0 12px 32px rgba(16, 24, 40, 0.14), 0 0 0 0.5px rgba(16, 24, 40, 0.05)',
        segmented: '0 1px 2px rgba(16, 24, 40, 0.1), 0 0 0 0.5px rgba(16, 24, 40, 0.04)',
        sidebar: '1px 0 0 rgba(255, 255, 255, 0.04), 8px 0 32px rgba(7, 20, 38, 0.12)',
        modal: '0 24px 64px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.06)',
        'input-focus': '0 0 0 3px rgba(20, 168, 150, 0.15)',
        'button-primary': '0 1px 2px rgba(16, 24, 40, 0.08)',
        soft: '0 2px 15px rgba(16, 24, 40, 0.04)',
        glow: '0 0 20px rgba(20, 168, 150, 0.12)'
      },
      transitionTimingFunction: {
        // UIKit's standard curve for state changes, spring for entrances.
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        spring: 'cubic-bezier(0.34, 1.2, 0.64, 1)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-down': 'fade-in-down 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) forwards',
        'slide-down': 'slide-down 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) forwards',
        skeleton: 'skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin-slow 1s linear infinite'
      },
      spacing: {
        4.5: '1.125rem',
        sidebar: '16rem',
        'sidebar-collapsed': '4.5rem',
        header: '4rem'
      },
      transitionDuration: {
        250: '250ms',
        350: '350ms'
      }
    }
  },
  plugins: []
};
