import { Document } from "@langchain/core/documents";

/**
 * Serviço de Recuperação de Contexto Client-Side
 * Permite buscar dados relevantes no Firestore antes de enviar o contexto para a IA
 */
class RAGService {
  constructor() {
    this.documents = [];
    this.indexed = false;
  }

  /**
   * Converte uma lista de aulas do Firestore em documentos indexáveis
   */
  async indexarAulas(aulas) {
    if (!aulas || aulas.length === 0) return;

    try {
      this.documents = aulas.map(aula => new Document({
        pageContent: `Aula: ${aula.assunto || 'Sem assunto'}. Laboratório: ${aula.laboratorioSelecionado || 'N/A'}. Cursos: ${Array.isArray(aula.cursos) ? aula.cursos.join(', ') : 'N/A'}. Observações: ${aula.observacoes || 'Nenhum'}.`,
        metadata: {
          id: aula.id,
          laboratorio: aula.laboratorioSelecionado,
          status: aula.status
        }
      }));
      this.indexed = true;
    } catch (error) {
      console.warn("Aviso ao indexar RAG local em memória:", error);
    }
  }

  /**
   * Busca os N documentos mais relevantes para a dúvida do usuário via pontuação de termos
   */
  async buscarContextoRelevante(pergunta, k = 3) {
    if (!this.documents || this.documents.length === 0) return [];
    try {
      const termos = pergunta.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      if (termos.length === 0) return this.documents.slice(0, k).map(d => d.pageContent);

      const pontuados = this.documents.map(doc => {
        const texto = doc.pageContent.toLowerCase();
        const score = termos.reduce((acc, t) => acc + (texto.includes(t) ? 1 : 0), 0);
        return { doc, score };
      });

      pontuados.sort((a, b) => b.score - a.score);
      return pontuados.slice(0, k).map(p => p.doc.pageContent);
    } catch (err) {
      console.error("Erro na busca de contexto RAG:", err);
      return [];
    }
  }
}

export const ragService = new RAGService();
export default ragService;

