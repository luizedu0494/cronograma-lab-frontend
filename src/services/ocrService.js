import { createWorker } from 'tesseract.js';

/**
 * Serviço de OCR Client-side para extração de texto de tabelas/fotos de cronograma
 */
class OCRService {
  /**
   * Converte uma imagem (File/Blob ou URL) em texto utilizando Tesseract.js no navegador
   */
  async extrairTextoDaImagem(imageFile, onProgress) {
    try {
      const worker = await createWorker('por');
      
      const ret = await worker.recognize(imageFile);
      await worker.terminate();
      
      return ret.data.text;
    } catch (error) {
      console.error("Erro no processamento OCR com Tesseract.js:", error);
      throw new Error("Não foi possível extrair o texto da imagem.");
    }
  }
}

export const ocrService = new OCRService();
export default ocrService;
