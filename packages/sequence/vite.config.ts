import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ExtableSequence',
      fileName: 'index',
      formats: ['es']
    },
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false
  },
  test: {
    environment: 'node'
  }
});
