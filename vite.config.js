import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/formulating_ayso_initial_rosters/',
  plugins: [vue(), tailwindcss()],
})
