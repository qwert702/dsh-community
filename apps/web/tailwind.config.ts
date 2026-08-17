import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // dsh 主题色 —— 深蓝黑主色 + 电光青强调
        ink: {
          950: '#0a0e1a',
          900: '#0f1524',
          850: '#131a2e',
          800: '#1a2338',
          700: '#27334f',
        },
        brand: {
          400: '#4fd1ff',
          500: '#22b8f0',
          600: '#0d87d6',
        },
        accent: {
          400: '#7be8b8',
          500: '#3ddc94',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}

export default config