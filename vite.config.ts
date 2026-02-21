import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'My ToDo App',
        short_name: 'ToDo',
        description: 'A collaborative to-do application.',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        icons: [
          {
            src: 'todo-logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'todo-logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'todo-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
