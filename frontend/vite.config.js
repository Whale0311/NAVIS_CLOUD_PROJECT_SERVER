import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Cấu hình proxy cho môi trường dev (chạy npm run dev)
    proxy: {
      // Bắt mọi request bắt đầu bằng /api và chuyển đến backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Nếu API backend của bạn không có tiền tố /api, bạn cần rewrite path:
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
      // Bắt mọi request WebSocket bắt đầu bằng /ws
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      }
    }
  }
})