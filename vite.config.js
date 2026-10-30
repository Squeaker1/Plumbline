import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'public_app',
    emptyOutDir: true
  },
  server: {
    allowedHosts: true,
    hmr: false
  }
});
