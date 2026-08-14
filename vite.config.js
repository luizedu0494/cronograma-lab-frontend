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
            if (id.includes('@xenova/transformers')) return 'ai-embeddings';
            if (id.includes('tesseract.js')) return 'ocr';
            if (id.includes('brain.js')) return 'ml';
            if (id.includes('mammoth')) return 'docx-parser';
            if (id.includes('exceljs') || id.includes('xlsx') || id.includes('papaparse')) return 'spreadsheet';
            if (id.includes('jspdf')) return 'pdf';
            if (id.includes('framer-motion')) return 'animation';
            if (id.includes('@mui') || id.includes('@emotion')) return 'ui';
            if (id.includes('langchain') || id.includes('@langchain')) return 'langchain';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
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
