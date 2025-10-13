import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Định nghĩa một biến global __VITE_API_KEYS__ thay vì dùng process.env
    // để tránh lỗi khi 'process' không tồn tại trong môi trường trình duyệt.
    // Vite sẽ thay thế biến này bằng một chuỗi JSON chứa các API key.
    '__VITE_API_KEYS__': JSON.stringify([
      process.env.VITE_API_KEY_1,
      process.env.VITE_API_KEY_2,
      process.env.VITE_API_KEY_3,
    ].filter(key => key)) // Lọc bỏ các key rỗng hoặc không được định nghĩa
  }
})
