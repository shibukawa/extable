import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ExtableVue',
      fileName: 'index',
      formats: ['es']
    },
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: ['vue', '@extable/core']
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts']
  }
});
