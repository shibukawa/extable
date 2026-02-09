import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        ssr: 'src/ssr/index.ts'
      },
      name: 'ExtableCore',
      fileName: (_format, entryName) =>
        entryName === 'ssr' ? 'ssr/index.js' : 'index.js',
      formats: ['es']
    },
    sourcemap: process.env.EXTABLE_RELEASE === '1' ? false : true,
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts']
  }
});
