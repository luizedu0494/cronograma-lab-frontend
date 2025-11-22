import ClassificadorIntencao, { TIPOS_INTENCAO } from './ClassificadorIntencao';
import ExtratorParametros from './ExtratorParametros';
import dayjs from 'dayjs';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.1-8b-instant';

class ProcessadorConsultas {
  constructor() {
    this.classificador = new ClassificadorIntencao();
    this.extrator = new ExtratorParametros();
  }

  async processar(textoUsuario) {
    try {
      const intencao = this.classificador.classificar(textoUsuario);
      const parametros = this.extrator.extrair(textoUsuario);
      const validacao = this.extrator.validar(parametros, intencao);

      // Atalho local para Adicionar Aula (se os dados estiverem perfeitos)
      if (validacao.valido && intencao === TIPOS_INTENCAO.ADICIONAR_AULA && parametros.data && parametros.assunto) {
        return {
            acao: 'adicionar',
            dados_novos: { ...parametros },
            criterios_busca: {},
            processamento: 'local'
        };
      }

      // Processamento Inteligente com Groq
      return await this.processarComGroq(textoUsuario);
      
    } catch (error) {
      console.error('Erro no Processador:', error);
      return { erro: 'Erro interno: ' + error.message };
    }
  }

  async processarComGroq(textoUsuario) {
    if (!GROQ_API_KEY) return { erro: "Chave API Groq não configurada." };

    const agora = dayjs();
    const contextoTemporal = `
    DATA DE HOJE: ${agora.format('DD/MM/YYYY')} (${agora.format('dddd')})
    HORA ATUAL: ${agora.format('HH:mm')}
    `;

    const systemPrompt = `
    Você é o cérebro de um sistema de gestão de aulas.
    ${contextoTemporal}

    SUA FUNÇÃO: Traduzir a intenção do usuário para um JSON de consulta.
    NÃO RESPONDA A PERGUNTA. Gere os parâmetros para a busca no banco de dados.

    REGRAS VISUAIS (IMPORTANTE):
    1. Se a pergunta for sobre QUANTIDADE (ex: "Quantas aulas...", "Total de..."), use "tipo_visual": "kpi_numero".
    2. Se a pergunta for sobre LISTAGEM (ex: "Quais aulas...", "Ver agenda..."), use "tipo_visual": "tabela_aulas".
    3. Se for uma dúvida geral ou resumo, use "tipo_visual": "card_resumo".

    FORMATO JSON OBRIGATÓRIO:
    {
      "acao": "consultar|adicionar|editar|excluir",
      "criterios_busca": {
        "data": "DD/MM/YYYY",
        "mes": "MM/YYYY",
        "ano": "YYYY",
        "termoBusca": "string (ex: anatomia)",
        "cursos": ["string"],
        "laboratorio": "string"
      },
      "dados_novos": { ... },
      "tipo_visual": "kpi_numero|tabela_aulas|card_resumo",
      "confirmacao": "Texto descritivo se for ação de escrita"
    }
    `;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: textoUsuario }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);

    } catch (error) {
        console.error("Erro Groq:", error);
        return { erro: "Falha na comunicação com a IA." };
    }
  }
}

export default ProcessadorConsultas;