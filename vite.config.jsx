import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ command } ) => {
  const config = {
    plugins: [
      react(),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      }
    }
  };

  // Adiciona o visualizer APENAS quando o comando é 'build'
  if (command === 'build') {
    config.plugins.push(
      visualizer({
        open: true, // Tenta abrir o relatório no navegador
        filename: 'dist/stats.html', // Caminho explícito para o arquivo de saída
        gzipSize: true,
        brotliSize: true,
      })
    );
  }

  return config;
});
