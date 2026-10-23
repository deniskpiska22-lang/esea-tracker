import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { historyArchivePlugin } from './scripts/viteHistoryArchive.js'
import { localizedCatalogsPlugin } from './scripts/viteLocalizedCatalogs.js'

export default defineConfig({
  plugins: [
    localizedCatalogsPlugin(),
    historyArchivePlugin(),
    react(),
    tailwindcss(),
  ],
})
