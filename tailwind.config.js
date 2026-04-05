/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lob: {
          'teal':        '#3D7A8A',
          'teal-dark':   '#2A5A68',
          'teal-light':  '#EAF4F7',
          'coral':       '#D94F2B',
          'coral-light': '#FAEAE5',
          'amber':       '#E8A030',
          'cream':       '#FAF3E4',
          'dark':        '#1C2B30',
          'muted':       '#6B8A92',
        },
        // Keep old lobster names for backward compatibility
        lobster: {
          teal: '#3D7A8A',
          'teal-dark': '#2A5A68',
          'teal-light': '#EAF4F7',
          orange: '#D94F2B',
          'orange-light': '#FAEAE5',
          cream: '#FAF3E4',
          gold: '#E8A030',
        }
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
