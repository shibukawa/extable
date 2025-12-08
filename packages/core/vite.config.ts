import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ExtableCore',
      fileName: 'index',
      formats: ['es']
    },
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false
  },
  test: {
    environment: 'jsdom'
  }
});
