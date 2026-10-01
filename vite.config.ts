import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => rutas relativas: funciona en https://usuario.github.io/NOMBRE-REPO/
// sin importar el nombre del repositorio (la app no usa rutas de URL).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
