/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lobster: {
          teal: '#2E7D8C',
          'teal-dark': '#1E5F6E',
          'teal-light': '#4A9BAB',
          orange: '#E05A2B',
          'orange-light': '#F07040',
          cream: '#FDF4E3',
          gold: '#F4C430',
        }
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
