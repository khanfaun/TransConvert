import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Thay thế process.env.API_KEY bằng giá trị từ biến môi trường của Netlify
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY)
  }
})