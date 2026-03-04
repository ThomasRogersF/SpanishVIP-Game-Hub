/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'brand-red': '#DC2626',
        'brand-yellow': '#FBBF24',
      },
    },
  },
  plugins: [],
};
