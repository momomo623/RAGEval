import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

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
  },
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      // 你可以在这里加更多别名
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'), 
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@router': path.resolve(__dirname, 'src/router'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@context': path.resolve(__dirname, 'src/context'),
    }
  }
})
