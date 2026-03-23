import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Stub module for unused LI.FI peer deps (Solana, Sui, UTXO)
const emptyModule = resolve(__dirname, 'src/lib/empty-module.ts')

// Move CSS <link> tags before <script> tags in built HTML to prevent FOUC
function cssBeforeJs() {
  return {
    name: 'css-before-js',
    transformIndexHtml(html: string) {
      const cssLinks = html.match(/<link rel="stylesheet"[^>]*>/g) || []
      let result = html
      for (const link of cssLinks) {
        result = result.replace(link, '')
      }
      const firstScript = result.indexOf('<script')
      if (firstScript > -1 && cssLinks.length > 0) {
        result =
          result.slice(0, firstScript) +
          cssLinks.join('\n    ') +
          '\n    ' +
          result.slice(firstScript)
      }
      return result
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    cssBeforeJs(),
    nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }),
  ],
  build: {
    outDir: 'dist/client',
  },
  resolve: {
    alias: {
      '@bigmi/react': emptyModule,
      '@solana/wallet-adapter-react': emptyModule,
      '@mysten/dapp-kit': emptyModule,
    },
  },
  optimizeDeps: {
    exclude: ['@mysten/dapp-kit'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
