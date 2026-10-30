const teal = '#3D7A8A'
const tealDark = '#2A5A68'
const coral = '#D94F2B'
const gold = '#FACC15'
/** Deep crimson, kept well apart from coral. Text and fills share one shade. */
const danger = '#9B1C31'
const darkRgb = '28 43 48' // lob.dark
const ink = (alpha) => `rgb(${darkRgb} / ${alpha})`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lob: {
          teal,
          'teal-dark': tealDark,
          'teal-light': '#EAF4F7',
          coral,
          amber: '#E8A030',
          cream: '#F5F0E8',
          dark: `rgb(${darkRgb})`,
          muted: '#6B8A92',
          'muted-light': '#97ADB3',
          slate: '#40565C',
          well: '#F9FAFB',
          line: '#F3F4F6',
          'line-strong': '#E5E7EB',
          success: {
            DEFAULT: '#15803D',
            light: '#F0FDF4',
            soft: '#DCFCE7',
            border: '#BBF7D0',
            'on-dark': '#86EFAC',
            solid: '#16A34A',
            strong: '#166534',
          },
          warning: {
            DEFAULT: '#B45309',
            light: '#FFFBEB',
            soft: '#FEF3C7',
            border: '#FDE68A',
            'on-dark': '#FCD34D',
            solid: '#F59E0B',
            strong: '#92400E',
          },
          danger: {
            DEFAULT: danger,
            light: '#FEF2F2',
            soft: '#FEE2E2',
            border: '#FECACA',
            'on-dark': '#FCA5A5',
            solid: danger,
            strong: '#7A1526',
          },
          info: {
            DEFAULT: '#0369A1',
            light: '#F0F9FF',
            soft: '#E0F2FE',
            border: '#BAE6FD',
            'on-dark': '#7DD3FC',
            solid: '#0EA5E9',
            strong: '#075985',
          },
        },
      },
      fontSize: {
        '2xs': '10px',
      },
      backgroundImage: {
        celebrate: `linear-gradient(to right, ${gold}, ${coral})`,
        header: `linear-gradient(135deg, ${teal} 0%, ${tealDark} 100%)`,
      },
      boxShadow: {
        card: `0 1px 3px ${ink(0.08)}, 0 4px 16px ${ink(0.05)}`,
        'card-elevated': `0 2px 8px ${ink(0.12)}, 0 8px 24px ${ink(0.08)}`,
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'confetti-fall': {
          '0%': { opacity: '1', transform: 'translateY(-10vh) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateY(110vh) rotate(720deg)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out both',
        'confetti-fall': 'confetti-fall linear forwards',
      },
    },
  },
  plugins: [
    // Tailwind v4's built-in `not-disabled:`. Unlike `enabled:`, it also matches links.
    ({ addVariant }) => addVariant('not-disabled', '&:not(:disabled)'),
  ],
}
