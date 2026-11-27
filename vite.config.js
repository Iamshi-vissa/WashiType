import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The deployed commit, attached to error reports (see src/reportError.js).
  define: { __RELEASE__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)) },
  // Absolute paths, so 404.html works at any address Vercel serves it from.
  base: '/',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        notFound: new URL('./404.html', import.meta.url).pathname
      }
    }
  }
});
