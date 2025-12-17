import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@extable/react': r('../react/src/index.tsx')
    }
  },
  server: {
    port: 5174
  },
  build: {
    outDir: 'dist'
  },
  test: {
    environment: 'jsdom'
  }
});
