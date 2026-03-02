/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f1a',
        surface: '#1a1a2e',
        'surface-hover': '#252542',
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: 'rgba(99, 102, 241, 0.1)',
        },
        success: {
          DEFAULT: '#22c55e',
          light: 'rgba(34, 197, 94, 0.1)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: 'rgba(245, 158, 11, 0.1)',
        },
        danger: {
          DEFAULT: '#ef4444',
          light: 'rgba(239, 68, 68, 0.1)',
        },
      },
    },
  },
  plugins: [],
}