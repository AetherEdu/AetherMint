/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        '44': '11rem',
      },
      minHeight: {
        'touch': '44px',
        'screen-safe': '100dvh',
      },
      minWidth: {
        'touch': '44px',
      },
      fontSize: {
        'body-sm': ['16px', { lineHeight: '1.5' }],
        'body-base': ['16px', { lineHeight: '1.625' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'skeleton-shimmer':
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
      },
      colors: {
        // WCAG 2.1 AA contrast-audited tokens (issue #271).
        // gray-400 (#9ca3af) on white is ~2.5:1 and fails AA for text;
        // use gray-500 (#6b7280, ~4.8:1) or darker for body text.
        'gray-400': '#9ca3af', // decorative / non-text only
        'gray-500': '#6b7280', // minimum for normal text on white
        'gray-600': '#4b5563', // preferred secondary text
        'gray-700': '#374151', // primary body text
        // blue-100 on blue-600 fails AA (~2.1:1); use blue-50 on blue-700
        // (~5.4:1) or blue-100 on blue-800 (~7.6:1) for text on solid blue.
        'blue-50': '#eff6ff',
        'blue-100': '#dbeafe', // decorative / non-text only on blue-600
        'blue-600': '#2563eb',
        'blue-700': '#1d4ed8', // AA-compliant text on blue-50
        'blue-800': '#1e40af', // AA-compliant text on blue-100
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
