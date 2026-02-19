import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  main: {
    build: {
      reportCompressedSize: false,
      bytecode: true
    }
  },
  preload: {
    build: {
      reportCompressedSize: false
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@config': resolve('src/config.ts')
      }
    },
    plugins: [vue(), vueDevTools()],
    build: {
      reportCompressedSize: false
    }
  }
})
