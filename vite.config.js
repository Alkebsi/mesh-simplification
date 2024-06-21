import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pipeline: resolve(__dirname, 'pipeline/index.html'),
        gltfPipeline: resolve(__dirname, 'pipeline/glTF/index.html'),
      },
    },
  },
})