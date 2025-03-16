import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 将所有 /api 开头的请求代理到后端服务器
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // 如果后端API路径也是以 /api 开头，则不需要重写
        // 如果后端API路径不包含 /api 前缀，则需要重写路径
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
