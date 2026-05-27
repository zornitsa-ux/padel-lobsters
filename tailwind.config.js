/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lob: {
          teal: '#3D7A8A',
          'teal-dark': '#2A5A68',
          'teal-light': '#EAF4F7',
          coral: '#D94F2B',
          'coral-light': '#FAEAE5',
          amber: '#E8A030',
          cream: '#F5F0E8',
          dark: '#1C2B30',
          muted: '#6B8A92',
        },
        // Keep old lobster names for backward compatibility
        lobster: {
          teal: '#3D7A8A',
          'teal-dark': '#2A5A68',
          'teal-light': '#EAF4F7',
          orange: '#D94F2B',
          'orange-light': '#FAEAE5',
          cream: '#F5F0E8',
          gold: '#E8A030',
        },
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
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
  plugins: [],
}
