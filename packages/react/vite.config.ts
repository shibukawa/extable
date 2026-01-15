import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: 'ExtableReact',
      fileName: 'index',
      formats: ['es']
    },
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: ['react', 'react-dom', '@extable/core']
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts']
  }
});
