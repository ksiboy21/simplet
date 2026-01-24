import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      'import.meta.env.VITE_SOLAPI_API_KEY': JSON.stringify(env.VITE_SOLAPI_API_KEY),
      'import.meta.env.VITE_SOLAPI_API_SECRET': JSON.stringify(env.VITE_SOLAPI_API_SECRET),
      'import.meta.env.VITE_SOLAPI_SENDER_NUMBER': JSON.stringify(env.VITE_SOLAPI_SENDER_NUMBER),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/solapi': {
          target: 'https://api.solapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/solapi/, ''),
        },
      },
    },
  }
})
