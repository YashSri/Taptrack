/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0A1F44',
        accent: '#1E3A8A',
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 16px 50px rgba(30, 58, 138, 0.45)',
      },
    },
  },
}
