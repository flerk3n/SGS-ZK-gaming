import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    // Copy WASM files to public directory
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@noir-lang/*/web/*.wasm',
          dest: 'noir'
        },
        {
          src: 'node_modules/@noir-lang/backend_barretenberg/dest/node/barretenberg_wasm/*.wasm',
          dest: 'barretenberg'
        }
      ]
    })
  ],
  // Load .env files from the parent directory (repo root)
  envDir: '..',
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: path.resolve(__dirname, './node_modules/buffer/')
    },
    dedupe: ['@stellar/stellar-sdk']
  },
  optimizeDeps: {
    include: ['@stellar/stellar-sdk', '@stellar/stellar-sdk/contract', '@stellar/stellar-sdk/rpc', 'buffer'],
    exclude: ['@noir-lang/noir_js', '@noir-lang/backend_barretenberg'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    },
    target: 'esnext'
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  // Ensure WASM files are served with correct MIME type
  assetsInclude: ['**/*.wasm']
})
