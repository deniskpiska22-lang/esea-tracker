import { defineConfig } from 'vite'
import { desktopDensity } from './scripts/desktopDensity.js'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { historyArchivePlugin } from './scripts/viteHistoryArchive.js'
import { localizedCatalogsPlugin } from './scripts/viteLocalizedCatalogs.js'

export default defineConfig({
  css: { postcss: { plugins: [desktopDensity()] } },
  plugins: [
    localizedCatalogsPlugin(),
    historyArchivePlugin(),
    react(),
    tailwindcss(),
  ],
})
