// Configuración de pruebas del frontend (Camilo Vásquez, tester - T-HU03-08).
// Se mantiene aparte de vite.config.js para no tocar la configuración de la app.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
});
