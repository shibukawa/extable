import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@extable/vue': r('../vue/src/index.ts')
    }
  },
  server: {
    port: 5175
  },
  build: {
    outDir: 'dist'
  },
  test: {
    environment: 'jsdom'
  }
});
