// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'   // ← add this import

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // ← add this line
  ],
  // ... other config if you have any
})
