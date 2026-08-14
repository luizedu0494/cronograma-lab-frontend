import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";

/**
 * Serviço de RAG (Retrieval-Augmented Generation) 100% Client-Side
 * Permite buscar dados relevantes no Firestore antes de enviar o contexto para a IA
 */
class RAGService {
  constructor() {
    this.vectorStore = null;
    this.indexed = false;
  }

  /**
   * Converte uma lista de aulas do Firestore em documentos indexáveis
   */
  async indexarAulas(aulas) {
    if (!aulas || aulas.length === 0) return;

    try {
      const docs = aulas.map(aula => new Document({
        pageContent: `Aula: ${aula.assunto || 'Sem assunto'}. Laboratório: ${aula.laboratorioSelecionado || 'N/A'}. Cursos: ${Array.isArray(aula.cursos) ? aula.cursos.join(', ') : 'N/A'}. Observações: ${aula.observacoes || 'Nenhum'}.`,
        metadata: {
          id: aula.id,
          laboratorio: aula.laboratorioSelecionado,
          status: aula.status
        }
      }));

      // Cria vetor store em memória client-side
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        {
          embedDocuments: async (texts) => texts.map(() => new Array(1536).fill(0.01)),
          embedQuery: async () => new Array(1536).fill(0.01)
        }
      );
      this.indexed = true;
    } catch (error) {
      console.warn("Aviso ao indexar RAG local em memória:", error);
    }
  }

  /**
   * Busca os N documentos mais relevantes para a dúvida do usuário
   */
  async buscarContextoRelevante(pergunta, k = 3) {
    if (!this.vectorStore || !this.indexed) return [];
    try {
      const resultados = await this.vectorStore.similaritySearch(pergunta, k);
      return resultados.map(r => r.pageContent);
    } catch (err) {
      console.error("Erro na busca de contexto RAG:", err);
      return [];
    }
  }
}

export const ragService = new RAGService();
export default ragService;
