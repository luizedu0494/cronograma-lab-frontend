import ClassificadorIntencao, { TIPOS_INTENCAO } from './ClassificadorIntencao';
import ExtratorParametros from './ExtratorParametros';
import dayjs from 'dayjs';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

class ProcessadorConsultas {
  constructor() {
    this.classificador = new ClassificadorIntencao();
    this.extrator = new ExtratorParametros();
  }

  async processar(textoUsuario) {
    try {
      // IGNORA AÇÕES DE ESCRITA LOCAIS
      // Vamos direto para o Groq apenas para consultas
      return await this.processarComGroq(textoUsuario);
    } catch (error) {
      return { erro: 'Erro interno: ' + error.message };
    }
  }

  async processarComGroq(textoUsuario) {
    if (!GROQ_API_KEY) return { erro: "Chave API Groq não configurada." };

    const agora = dayjs();
    const contextoTemporal = `
    DATA HOJE: ${agora.format('DD/MM/YYYY')} (${agora.format('dddd')})
    ANO ATUAL: ${agora.year()}
    `;

    const systemPrompt = `
    Você é um Analista de Dados de Cronograma Acadêmico.
    ${contextoTemporal}

    SUA MISSÃO: Apenas CONSULTAR dados. Você NÃO PODE agendar, editar ou excluir.

    **REGRAS DE INTERPRETAÇÃO:**

    1. **SE O USUÁRIO PEDIR PARA ADICIONAR/EDITAR/EXCLUIR:**
       - Retorne: "tipo_visual": "aviso_acao".
       - Mensagem: "Sou um assistente de consulta. Para alterar o cronograma, use o calendário oficial."

    2. **ANÁLISES E GRÁFICOS (PERMITIDO):**
       - "Gráfico", "Ranking", "Evolução" -> "tipo_visual": "grafico_estatisticas" ou "grafico_linha".
       - "Taxa de Ocupação" -> "analise_especial": "taxa_ocupacao".
       - "Vagas/Livres" -> "analise_especial": "horarios_vagos".
       - "Ociosidade" -> "analise_especial": "nao_utilizados".

    3. **CONSULTAS PADRÃO:**
       - "Quantas..." -> "tipo_visual": "kpi_numero".
       - "Listar..." -> "tipo_visual": "tabela_aulas".

    JSON DE SAÍDA:
    {
      "acao": "consultar", 
      "criterios_busca": {
        "data": "DD/MM/YYYY",
        "mes": "MM/YYYY",
        "ano": "YYYY",
        "termoBusca": "string",
        "laboratorio": "string",
        "cursos": ["string"]
      },
      "tipo_visual": "grafico_estatisticas|grafico_linha|kpi_numero|tabela_aulas|aviso_acao",
      "agrupar_por": "laboratorio|curso|mes|dia_semana|turno|horario",
      "analise_especial": "taxa_ocupacao|horarios_vagos|nao_utilizados|media_diaria|dias_lotados|null",
      "metrica": "quantidade|duracao",
      "titulo_sugerido": "Título",
      "mensagem": "Mensagem de erro caso tente escrever"
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
        return { erro: "Falha na IA." };
    }
  }
}

export default ProcessadorConsultas;