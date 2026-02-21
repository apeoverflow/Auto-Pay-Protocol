import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Stub module for unused LI.FI peer deps (Solana, Sui, UTXO)
const emptyModule = resolve(__dirname, 'src/lib/empty-module.ts')

export default defineConfig({
  plugins: [react()],
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
