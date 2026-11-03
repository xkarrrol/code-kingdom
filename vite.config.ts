import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['pyodide'] },
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        jspi: fileURLToPath(new URL('./experiments/jspi.html', import.meta.url)),
      },
    },
  },
})
