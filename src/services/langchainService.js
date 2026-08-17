import { ChatGroq } from "@langchain/groq";
import { TODAS_FERRAMENTAS_LANGCHAIN } from "../ia-estruturada/langchainTools";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

class LangChainService {
  constructor() {
    this.model = null;
    this.modelWithTools = null;

    if (GROQ_API_KEY) {
      try {
        this.model = new ChatGroq({
          apiKey: GROQ_API_KEY,
          model: import.meta.env.VITE_GROQ_MODEL || "qwen/qwen3.6-27b",
          temperature: 0.3,
        });

        if (this.model.bindTools) {
          this.modelWithTools = this.model.bindTools(TODAS_FERRAMENTAS_LANGCHAIN);
        }
      } catch (err) {
        console.warn("LangChain ChatGroq não pôde ser inicializado:", err);
      }
    }
  }

  /**
   * Processa uma mensagem utilizando LangChain e Groq com streaming
   */
  async processarMensagemStream(promptText, systemPromptText, onTokenCallback) {
    if (!this.model) {
      throw new Error("GROQ_API_KEY não configurada para LangChain.");
    }

    try {
      const messages = [
        { role: "system", content: systemPromptText },
        { role: "user", content: promptText }
      ];

      const stream = await this.model.stream(messages);
      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk?.content || "";
        fullResponse += content;
        if (onTokenCallback) {
          onTokenCallback(content, fullResponse);
        }
      }

      return fullResponse;
    } catch (error) {
      console.error("Erro no processarMensagemStream com LangChain:", error);
      throw error;
    }
  }

  /**
   * Limpa a memória de sessão do LangChain
   */
  limparMemoria() {
    if (this.memory && typeof this.memory.clear === 'function') {
      this.memory.clear();
    }
  }
}

export const langchainService = new LangChainService();
export default langchainService;
