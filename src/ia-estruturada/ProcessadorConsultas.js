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
                horarios: [parametros.horario],
                isProva: false,
                isRevisao: false,
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
    Você é um Cientista de Dados e Especialista em Gestão de Cronogramas Acadêmicos do CESMAC.
    ${contextoTemporal}

    SUA MISSÃO: Traduzir a pergunta do usuário em um JSON técnico.
    NÃO responda a pergunta. Apenas gere os parâmetros para o sistema buscar.

    **COLEÇÕES DISPONÍVEIS:**
    - "aulas": agendamentos de aulas, revisões e provas do cronograma oficial

    **ESTRUTURA DOS DOCUMENTOS NA COLEÇÃO "aulas":**
    Cada documento pode ter os seguintes campos de classificação de tipo:
    - "isProva: true"    → é uma **prova** (avaliação formal). Aparece com borda vermelha no calendário.
    - "isRevisao: true"  → é uma **revisão ou reforço** (e isProva é false). Aparece com borda roxa.
      - O campo "tipoRevisao" guarda o subtipo: revisao_conteudo | revisao_pre_prova | aula_reforco | pratica_extra | monitoria | outro
    - Se ambos forem false/ausentes → é uma **aula normal**.

    **CAMPO "filtro_tipo" — USE SEMPRE QUE IDENTIFICAR O TIPO:**
    - Pergunta sobre provas     → "filtro_tipo": "prova"
    - Pergunta sobre revisões   → "filtro_tipo": "revisao"
    - Pergunta sobre aulas normais → "filtro_tipo": "aula_normal"
    - Pergunta geral (sem tipo) → "filtro_tipo": null  (não filtrar por tipo)

    **EXEMPLOS DE MAPEAMENTO TIPO:**
    - "quantas provas esse mês"         → filtro_tipo: "prova"
    - "labs com mais provas"            → filtro_tipo: "prova", agrupar_por: "laboratorio"
    - "revisões da semana"              → filtro_tipo: "revisao"
    - "quantas aulas de anatomia"       → filtro_tipo: null (pode ser qualquer tipo)
    - "evolução de provas por mês"      → filtro_tipo: "prova", tipo_visual: "grafico_linha"
    - "comparar provas vs revisões"     → filtro_tipo: null, analise_especial: "comparar_tipos"
    - "há prova amanhã?"                → filtro_tipo: "prova"
    - "quais cursos têm mais provas?"   → filtro_tipo: "prova", agrupar_por: "curso"

    **REGRAS DE INTERPRETAÇÃO:**

    1. **GRÁFICOS DE LINHA (EVOLUÇÃO TEMPORAL):**
       - Gatilhos: "evolução", "crescimento", "tendência", "histórico", "ao longo do tempo", "mensal", "anual".
       - Output: "tipo_visual": "grafico_linha".
       - Agrupamento: "mes" (padrão) ou "ano".

    2. **GRÁFICOS DE BARRAS/PIZZA (DISTRIBUIÇÃO):**
       - Gatilhos: "gráfico", "ranking", "distribuição", "comparar", "quais mais usados".
       - Output: "tipo_visual": "grafico_estatisticas".
       - Agrupamento: "laboratorio" | "curso" | "dia_semana" | "turno" | "horario".

    3. **ANÁLISES ESPECIAIS (KPIs):**
       - Taxa de Ocupação: "eficiência", "taxa de uso", "ocupação %" → "analise_especial": "taxa_ocupacao", "tipo_visual": "kpi_numero".
       - Ociosidade: "não usados", "vazios", "sem aula" → "analise_especial": "nao_utilizados".
       - Vagas: "horários vagos", "livres amanhã" → "analise_especial": "horarios_vagos".
       - Média: "média por dia", "frequência" → "analise_especial": "media_diaria".
       - Saturação: "dias lotados", "picos" → "analise_especial": "dias_lotados".
       - Comparar tipos: "provas vs revisões", "comparar tipos de atividade" → "analise_especial": "comparar_tipos".

    4. **CONSULTAS SIMPLES:**
       - "Quantas..." → "tipo_visual": "kpi_numero".
       - "Listar...", "Ver aulas...", "Ver provas...", "Ver revisões..." → "tipo_visual": "tabela_aulas".

    5. **AÇÕES DE ESCRITA:**
       - Extraia dados para "dados_novos" (assunto, data, lab, horario).
       - "laboratorios" e "horarios" devem ser Arrays.
       - Se for prova: "isProva": true, "isRevisao": false.
       - Se for revisão: "isRevisao": true, "isProva": false. Extraia "tipoRevisao" se mencionado.
       - Se for aula normal: "isProva": false, "isRevisao": false.

    **FORMATO JSON OBRIGATÓRIO (retorne APENAS isso):**
    {
      "acao": "consultar|adicionar|editar|excluir",
      "colecao": "aulas",
      "criterios_busca": {
        "data": "DD/MM/YYYY",
        "mes": "MM/YYYY",
        "ano": "YYYY",
        "termoBusca": "string",
        "laboratorio": "string",
        "cursos": ["string"],
        "filtro_tipo": "prova|revisao|aula_normal|null"
      },
      "dados_novos": {
        "assunto": "string",
        "data": "DD/MM/YYYY",
        "laboratorios": ["string"],
        "horarios": ["string"],
        "cursos": ["string"],
        "observacoes": "string",
        "isProva": false,
        "isRevisao": false,
        "tipoRevisao": "revisao_conteudo|revisao_pre_prova|aula_reforco|pratica_extra|monitoria|outro|null"
      },
      "tipo_visual": "grafico_estatisticas|grafico_linha|kpi_numero|tabela_aulas|confirmacao_acao",
      "agrupar_por": "laboratorio|curso|mes|dia_semana|turno|horario",
      "analise_especial": "taxa_ocupacao|horarios_vagos|nao_utilizados|media_diaria|dias_lotados|comparar_tipos|null",
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
