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

  /**
   * Processa o texto do usuário.
   * Se for uma adição simples e completa, faz localmente (rápido).
   * Se for consulta, gráfico ou edição complexa, usa a IA (inteligente).
   */
  async processar(textoUsuario) {
    try {
      // 1. Tentativa de extração local (RegEx)
      const intencao = this.classificador.classificar(textoUsuario);
      const parametros = this.extrator.extrair(textoUsuario);
      const validacao = this.extrator.validar(parametros, intencao);

      // OTIMIZAÇÃO: Se for "Adicionar Aula" e o usuário disse tudo (Data, Assunto, Lab, Horário),
      // não gastamos tempo chamando a IA. Montamos o objeto direto.
      if (
          validacao.valido && 
          intencao === TIPOS_INTENCAO.ADICIONAR_AULA && 
          parametros.data && 
          parametros.assunto && 
          parametros.laboratorios?.length > 0 &&
          parametros.horario
      ) {
        return {
            acao: 'adicionar',
            dados_novos: { 
                ...parametros,
                laboratorios: parametros.laboratorios,
                horarios: [parametros.horario] 
            },
            criterios_busca: {},
            tipo_visual: 'confirmacao_acao'
        };
      }

      // 2. Para todo o resto (Consultas de BI, Gráficos, Perguntas vagas), chamamos a IA
      return await this.processarComGroq(textoUsuario);
      
    } catch (error) {
      console.error('Erro no Processador:', error);
      return { erro: 'Erro interno ao processar consulta: ' + error.message };
    }
  }

  async processarComGroq(textoUsuario) {
    if (!GROQ_API_KEY) return { erro: "Chave API Groq não configurada no .env." };

    // Injeta contexto temporal para a IA saber "hoje", "ontem", "amanhã"
    const agora = dayjs();
    const contextoTemporal = `
    DATA DE HOJE: ${agora.format('DD/MM/YYYY')} (${agora.format('dddd')})
    HORA ATUAL: ${agora.format('HH:mm')}
    ANO ATUAL: ${agora.year()}
    `;

    const systemPrompt = `
    Você é um Cientista de Dados e Especialista em Gestão de Cronogramas Acadêmicos.
    ${contextoTemporal}

    SUA MISSÃO: Traduzir a pergunta do usuário em um JSON técnico.
    NÃO responda a pergunta. Apenas gere os parâmetros para o sistema buscar.

    **REGRAS DE INTERPRETAÇÃO AVANÇADA (BI & GESTÃO):**

    1. **GRÁFICOS DE LINHA (EVOLUÇÃO TEMPORAL):**
       - Gatilhos: "evolução", "crescimento", "tendência", "histórico", "ao longo do tempo", "mensal", "anual".
       - Output: "tipo_visual": "grafico_linha".
       - Agrupamento: "mes" (padrão) ou "ano".

    2. **GRÁFICOS DE BARRAS/PIZZA (DISTRIBUIÇÃO):**
       - Gatilhos: "gráfico", "ranking", "distribuição", "comparar", "quais mais usados".
       - Output: "tipo_visual": "grafico_estatisticas".
       - Agrupamento: "laboratorio" | "curso" | "dia_semana" | "turno" | "horario".
       - Métrica: Se falar "tempo", "horas", "duração" -> "metrica": "duracao".

    3. **ANÁLISES ESPECIAIS (KPIs):**
       - **Taxa de Ocupação:** "eficiência", "taxa de uso", "ocupação %". -> "analise_especial": "taxa_ocupacao", "tipo_visual": "kpi_numero".
       - **Ociosidade:** "não usados", "nunca usados", "vazios", "sem aula". -> "analise_especial": "nao_utilizados", "tipo_visual": "tabela_aulas".
       - **Vagas:** "horários vagos", "buracos", "livres amanhã". -> "analise_especial": "horarios_vagos", "tipo_visual": "tabela_aulas".
       - **Intensidade:** "média por dia", "frequência". -> "analise_especial": "media_diaria", "tipo_visual": "kpi_numero".
       - **Saturação:** "dias lotados", "picos", "mais cheios". -> "analise_especial": "dias_lotados", "tipo_visual": "tabela_aulas".

    4. **CONSULTAS SIMPLES:**
       - "Quantas..." -> "tipo_visual": "kpi_numero".
       - "Listar...", "Agenda...", "Ver aulas..." -> "tipo_visual": "tabela_aulas".

    5. **AÇÕES DE ESCRITA (Adicionar/Editar/Excluir):**
       - Extraia os dados para "dados_novos" (assunto, data, lab, horario).
       - "laboratorios" e "horarios" devem ser Arrays de strings.

    **FORMATO JSON OBRIGATÓRIO (Retorne APENAS isso):**
    {
      "acao": "consultar|adicionar|editar|excluir",
      "criterios_busca": {
        "data": "DD/MM/YYYY",
        "mes": "MM/YYYY",
        "ano": "YYYY",
        "termoBusca": "string",
        "laboratorio": "string",
        "cursos": ["string"]
      },
      "dados_novos": { 
          "assunto": "string",
          "data": "DD/MM/YYYY",
          "laboratorios": ["string"],
          "horarios": ["string"],
          "cursos": ["string"],
          "observacoes": "string"
      },
      "tipo_visual": "grafico_estatisticas|grafico_linha|kpi_numero|tabela_aulas|confirmacao_acao",
      "agrupar_por": "laboratorio|curso|mes|dia_semana|turno|horario",
      "analise_especial": "taxa_ocupacao|horarios_vagos|nao_utilizados|media_diaria|dias_lotados|null",
      "metrica": "quantidade|duracao|diversidade",
      "titulo_sugerido": "Título curto para o gráfico",
      "confirmacao": "Texto descritivo da ação (apenas para escrita)"
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
                temperature: 0.1, // Baixa temperatura = Mais obediência ao JSON
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error(`Erro API Groq: ${response.status}`);

        const data = await response.json();
        const conteudo = data.choices[0].message.content;
        
        // Tenta fazer o parse do JSON retornado pela IA
        return JSON.parse(conteudo);

    } catch (error) {
        console.error("Erro Groq:", error);
        return { erro: "Falha na inteligência do processador. Verifique a conexão." };
    }
  }
}

export default ProcessadorConsultas;