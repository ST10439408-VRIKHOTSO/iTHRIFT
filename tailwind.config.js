/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/index.html',
    './public/mobile/index.html',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      // Color palette based on design system
      colors: {
        // Primary backgrounds
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#F5F5F5',
        'bg-tertiary': '#FAFAFA',
        
        // Text colors
        'text-primary': '#111111',
        'text-secondary': '#222222',
        'text-muted': '#666666',
        'text-muted-dark': '#888888',
        
        // Accent and status colors
        'accent-subtle': '#E5E5E5',
        'accent-soft': '#b49d6f',
        
        // Status colors
        'status-good': '#2f7d4f',
        'status-good-bg': '#e9f4e8',
        'status-warn': '#8b6a2f',
        'status-warn-bg': '#f8f2de',
        'status-bad': '#a93f3f',
        'status-bad-bg': '#fbe7e7',
        'status-info': '#32689f',
        'status-info-bg': '#e8eff7',
      },
      
      // Border radius - rounded everywhere
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '18px',
        'full': '999px',
      },
      
      // Shadows - soft and subtle
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'lg': '0 18px 50px rgba(17, 17, 22, 0.08)',
      },
      
      // Spacing - generous whitespace
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
      },
      
      // Typography
      fontFamily: {
        sans: [
          'Inter',
          'SF Pro Display',
          'Helvetica Neue',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      
      fontSize: {
        'xs': ['12px', { lineHeight: '1.5' }],
        'sm': ['14px', { lineHeight: '1.6' }],
        'base': ['16px', { lineHeight: '1.6' }],
        'lg': ['18px', { lineHeight: '1.7' }],
        'xl': ['20px', { lineHeight: '1.7' }],
        '2xl': ['24px', { lineHeight: '1.8' }],
        '3xl': ['32px', { lineHeight: '1.8' }],
        '4xl': ['40px', { lineHeight: '1.2' }],
        '5xl': ['48px', { lineHeight: '1.2' }],
      },
      
      // Max width for container
      maxWidth: {
        'container': '1440px',
        'wide': '1760px',
      },
      
      // Grid system - 12 columns
      gridTemplateColumns: {
        '3': 'repeat(3, minmax(0, 1fr))',
        '4': 'repeat(4, minmax(0, 1fr))',
        '12': 'repeat(12, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}
