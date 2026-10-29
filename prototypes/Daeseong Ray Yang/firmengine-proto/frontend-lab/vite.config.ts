import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dailyPlugin } from './daily-plugin';

export default defineConfig({
  plugins: [react(), dailyPlugin()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
