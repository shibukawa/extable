import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    rollupOptions: {
      input: 'src/server.ts'
    },
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    environment: 'node'
  }
});
