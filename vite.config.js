import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Gom tất cả các biến VITE_API_KEY_* từ môi trường (Netlify hoặc file .env)
    // vào một mảng để ứng dụng có thể sử dụng và xoay vòng.
    'process.env.API_KEYS': JSON.stringify([
      process.env.VITE_API_KEY_1,
      process.env.VITE_API_KEY_2,
      process.env.VITE_API_KEY_3,
    ].filter(key => key)) // Lọc bỏ các key rỗng hoặc không được định nghĩa
  }
})
