/**
 * ProcessadorConsultas.js
 * Cérebro da IA: Interpreta linguagem natural e converte em JSON técnico.
 * Suporta: Gráficos (Barra, Pizza, Linha), KPIs, Tabelas e Ações de Gestão.
 */

import ClassificadorIntencao, { TIPOS_INTENCAO } from './ClassificadorIntencao';
import ExtratorParametros from './ExtratorParametros';
import dayjs from 'dayjs';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Modelo potente para lógica complexa

class ProcessadorConsultas {
  constructor() {
    this.classificador = new ClassificadorIntencao();
    this.extrator = new ExtratorParametros();
  }

  /**
   * Ponto de entrada principal
   */
  async processar(textoUsuario) {
    try {
      // 1. Tentativa Local (Rápida para comandos simples de Adicionar)
      const intencao = this.classificador.classificar(textoUsuario);
      const parametros = this.extrator.extrair(textoUsuario);
      const validacao = this.extrator.validar(parametros, intencao);

      // Se for ADICIONAR e tiver todos os dados, não gasta token da IA
      if (validacao.valido && intencao === TIPOS_INTENCAO.ADICIONAR_AULA && parametros.data && parametros.assunto) {
        return {
            acao: 'adicionar',
            dados_novos: { ...parametros },
            criterios_busca: {},
            tipo_visual: 'confirmacao_acao'
        };
      }

      // 2. Processamento Inteligente (Groq) para todo o resto
      return await this.processarComGroq(textoUsuario);
      
    } catch (error) {
      console.error('Erro no Processador:', error);
      return { erro: 'Erro interno ao processar consulta: ' + error.message };
    }
  }

  async processarComGroq(textoUsuario) {
    if (!GROQ_API_KEY) return { erro: "Chave API Groq não configurada no .env." };

    // Injeta contexto temporal para a IA não se perder
    const agora = dayjs();
    const contextoTemporal = `
    DATA DE HOJE: ${agora.format('DD/MM/YYYY')} (${agora.format('dddd')})
    HORA ATUAL: ${agora.format('HH:mm')}
    ANO ATUAL: ${agora.year()}
    `;

    const systemPrompt = `
    Você é um Cientista de Dados e Especialista em Gestão de Cronogramas Acadêmicos.
    ${contextoTemporal}

    SUA MISSÃO: Traduzir a pergunta do usuário em um JSON técnico de busca ou ação.
    NÃO responda a pergunta. Apenas gere os parâmetros para o sistema.

    **REGRAS DE INTERPRETAÇÃO AVANÇADA (BI):**

    1. **ANÁLISES DE TENDÊNCIA (EVOLUÇÃO):**
       - Palavras: "evolução", "crescimento", "tendência", "histórico", "ao longo do tempo", "mensal", "anual".
       - Ação: "tipo_visual": "grafico_linha".
       - Agrupamento: "mes" (padrão) ou "ano".

    2. **ANÁLISES DE EFICIÊNCIA E OCIOSIDADE:**
       - **Taxa de Ocupação:** "eficiência", "taxa de uso", "ocupação", "porcentagem de uso".
         -> "analise_especial": "taxa_ocupacao", "tipo_visual": "kpi_numero".
       - **Ociosidade:** "não usados", "nunca usados", "vazios o mês todo", "sem aula".
         -> "analise_especial": "nao_utilizados", "tipo_visual": "tabela_aulas".
       - **Vagas/Disponibilidade:** "horários vagos", "buracos na agenda", "livres amanhã".
         -> "analise_especial": "horarios_vagos", "tipo_visual": "tabela_aulas".
       - **Intensidade:** "média por dia", "frequência diária".
         -> "analise_especial": "media_diaria", "tipo_visual": "kpi_numero".
       - **Saturação:** "dias lotados", "dias de pico", "mais cheios".
         -> "analise_especial": "dias_lotados", "tipo_visual": "tabela_aulas".

    3. **COMPARAÇÕES E RANKINGS (GRÁFICOS):**
       - Palavras: "gráfico", "ranking", "distribuição", "comparar", "quais mais usados".
       - Ação: "tipo_visual": "grafico_estatisticas".
       - Agrupamento: "laboratorio" | "curso" | "dia_semana" | "turno" | "horario".
       - Se falar "tempo", "horas", "duração" -> "metrica": "duracao".

    4. **CONSULTAS PADRÃO:**
       - "Quantas..." -> "tipo_visual": "kpi_numero", "metrica": "quantidade".
       - "Listar...", "Agenda...", "Ver aulas..." -> "tipo_visual": "tabela_aulas".

    **FORMATO JSON OBRIGATÓRIO:**
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
      "dados_novos": { ... },
      "tipo_visual": "grafico_estatisticas|grafico_linha|kpi_numero|tabela_aulas",
      "agrupar_por": "laboratorio|curso|mes|dia_semana|turno|horario",
      "analise_especial": "taxa_ocupacao|horarios_vagos|nao_utilizados|media_diaria|dias_lotados|null",
      "metrica": "quantidade|duracao|diversidade",
      "titulo_sugerido": "Título curto para o gráfico/tabela",
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
                temperature: 0.1, // Baixa temperatura para precisão técnica
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error(`Erro API Groq: ${response.status}`);

        const data = await response.json();
        const conteudo = data.choices[0].message.content;
        
        return JSON.parse(conteudo);

    } catch (error) {
        console.error("Erro Groq:", error);
        return { erro: "Falha na inteligência do processador. Verifique a conexão." };
    }
  }
}

export default ProcessadorConsultas;