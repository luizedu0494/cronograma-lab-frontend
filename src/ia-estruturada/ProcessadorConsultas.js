/**
 * ProcessadorConsultas.js
 * 
 * Motor principal de processamento de consultas.
 * Integra classificação de intenção, extração de parâmetros e chamada à IA quando necessário.
 */

import ClassificadorIntencao, { TIPOS_INTENCAO } from './ClassificadorIntencao';
import ExtratorParametros from './ExtratorParametros';

class ProcessadorConsultas {
  constructor() {
    this.classificador = new ClassificadorIntencao();
    this.extrator = new ExtratorParametros();
    this.openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  }

  /**
   * Processa a consulta do usuário e retorna dados estruturados
   * @param {string} textoUsuario - Texto da consulta
   * @returns {Promise<Object>} - Objeto com ação, critérios e dados estruturados
   */
  async processar(textoUsuario) {
    try {
      // 1. Classifica a intenção
      const intencao = this.classificador.classificar(textoUsuario);
      
      // 2. Extrai parâmetros
      const parametros = this.extrator.extrair(textoUsuario);
      
      // 3. Valida parâmetros
      const validacao = this.extrator.validar(parametros, intencao);
      
      if (!validacao.valido) {
        return {
          erro: validacao.mensagemErro,
          sugestao: this.gerarSugestao(intencao)
        };
      }

      // 4. Se a intenção for clara e os parâmetros suficientes, processa localmente
      if (this.podeProcessarLocalmente(intencao, parametros)) {
        return this.processarLocalmente(intencao, parametros, textoUsuario);
      }

      // 5. Caso contrário, usa IA para processamento avançado
      return await this.processarComIA(textoUsuario, intencao, parametros);
      
    } catch (error) {
      console.error('Erro no processamento:', error);
      return {
        erro: 'Não foi possível processar sua consulta. Por favor, tente reformular.',
        detalhes: error.message
      };
    }
  }

  /**
   * Verifica se pode processar localmente sem IA
   * @param {string} intencao - Tipo de intenção
   * @param {Object} parametros - Parâmetros extraídos
   * @returns {boolean}
   */
  podeProcessarLocalmente(intencao, parametros) {
    switch (intencao) {
      case TIPOS_INTENCAO.CONSULTAR_AULA:
        return !!(parametros.data || parametros.mes || parametros.termoBusca || parametros.cursos.length > 0);
      
      case TIPOS_INTENCAO.CONSULTAR_HORARIO:
        return !!(parametros.assunto || parametros.termoBusca);
      
      case TIPOS_INTENCAO.CONSULTAR_QUANTIDADE:
        return true; // Sempre pode processar localmente
      
      case TIPOS_INTENCAO.ADICIONAR_AULA:
        return !!(parametros.data && (parametros.assunto || parametros.termoBusca));
      
      case TIPOS_INTENCAO.EDITAR_AULA:
      case TIPOS_INTENCAO.EXCLUIR_AULA:
        return !!(parametros.data || parametros.assunto || parametros.termoBusca);
      
      default:
        return false;
    }
  }

  /**
   * Processa a consulta localmente usando regras
   * @param {string} intencao - Tipo de intenção
   * @param {Object} parametros - Parâmetros extraídos
   * @param {string} textoOriginal - Texto original da consulta
   * @returns {Object} - Resultado estruturado
   */
  processarLocalmente(intencao, parametros, textoOriginal) {
    const resultado = {
      acao: this.mapearIntencaoParaAcao(intencao),
      criterios_busca: {},
      dados_novos: {},
      tipo_visual: null,
      confirmacao: null,
      processamento: 'local'
    };

    // Monta critérios de busca
    if (parametros.data) resultado.criterios_busca.data = parametros.data;
    if (parametros.mes) resultado.criterios_busca.mes = parametros.mes;
    if (parametros.ano) resultado.criterios_busca.ano = parametros.ano;
    if (parametros.termoBusca) resultado.criterios_busca.termoBusca = parametros.termoBusca;
    if (parametros.assunto) resultado.criterios_busca.assunto = parametros.assunto;
    if (parametros.cursos.length > 0) resultado.criterios_busca.cursos = parametros.cursos;
    if (parametros.laboratorios.length > 0) resultado.criterios_busca.laboratorios = parametros.laboratorios;
    if (parametros.horario) resultado.criterios_busca.horarios = [parametros.horario];

    // Processa de acordo com a intenção
    switch (intencao) {
      case TIPOS_INTENCAO.CONSULTAR_AULA:
      case TIPOS_INTENCAO.CONSULTAR_HORARIO:
        resultado.tipo_visual = 'tabela_aulas';
        resultado.resposta = this.gerarRespostaConsulta(parametros);
        break;

      case TIPOS_INTENCAO.CONSULTAR_QUANTIDADE:
        resultado.tipo_visual = 'card_resumo';
        resultado.resposta = 'Consultando quantidade de aulas...';
        break;

      case TIPOS_INTENCAO.CONSULTAR_ESTATISTICAS:
        resultado.tipo_visual = 'grafico_estatisticas';
        resultado.resposta = 'Gerando estatísticas...';
        break;

      case TIPOS_INTENCAO.ADICIONAR_AULA:
        resultado.dados_novos = {
          assunto: parametros.assunto || parametros.termoBusca,
          data: parametros.data,
          horarios: parametros.horario ? [parametros.horario] : [],
          cursos: parametros.cursos,
          laboratorios: parametros.laboratorios
        };
        resultado.confirmacao = `Confirma adicionar aula de "${resultado.dados_novos.assunto}" para ${parametros.data}${parametros.horario ? ' às ' + parametros.horario : ''}?`;
        break;

      case TIPOS_INTENCAO.EDITAR_AULA:
        resultado.dados_novos = {};
        if (parametros.horario) resultado.dados_novos.horarios = [parametros.horario];
        if (parametros.laboratorios.length > 0) resultado.dados_novos.laboratorios = parametros.laboratorios;
        if (parametros.cursos.length > 0) resultado.dados_novos.cursos = parametros.cursos;
        
        resultado.confirmacao = this.gerarConfirmacaoEdicao(resultado.criterios_busca, resultado.dados_novos);
        break;

      case TIPOS_INTENCAO.EXCLUIR_AULA:
        resultado.confirmacao = this.gerarConfirmacaoExclusao(resultado.criterios_busca);
        break;
    }

    return resultado;
  }

  /**
   * Processa a consulta usando IA (OpenAI)
   * @param {string} textoUsuario - Texto da consulta
   * @param {string} intencao - Intenção identificada
   * @param {Object} parametros - Parâmetros já extraídos
   * @returns {Promise<Object>} - Resultado estruturado
   */
  async processarComIA(textoUsuario, intencao, parametros) {
    if (!this.openaiApiKey) {
      // Fallback para processamento local se não tiver API key
      return this.processarLocalmente(intencao, parametros, textoUsuario);
    }

    const prompt = this.construirPromptIA(textoUsuario, intencao, parametros);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: this.obterPromptSistema()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1000,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na API OpenAI: ${response.status}`);
      }

      const data = await response.json();
      const respostaIA = JSON.parse(data.choices[0].message.content);
      
      return {
        ...respostaIA,
        processamento: 'ia'
      };

    } catch (error) {
      console.error('Erro ao chamar OpenAI:', error);
      // Fallback para processamento local
      return this.processarLocalmente(intencao, parametros, textoUsuario);
    }
  }

  /**
   * Constrói o prompt do sistema para a IA
   * @returns {string}
   */
  obterPromptSistema() {
    return `Você é um assistente especializado em processar consultas sobre cronograma de aulas.

Sua tarefa é analisar a consulta do usuário e retornar um JSON estruturado com os seguintes campos:

{
  "acao": "consultar|adicionar|editar|excluir",
  "criterios_busca": {
    "data": "DD/MM/YYYY",
    "mes": "MM/YYYY",
    "ano": "YYYY",
    "assunto": "string",
    "termoBusca": "string",
    "cursos": ["curso1", "curso2"],
    "laboratorios": ["lab1", "lab2"],
    "horarios": ["HH:MM-HH:MM"]
  },
  "dados_novos": {
    "assunto": "string",
    "data": "DD/MM/YYYY",
    "horarios": ["HH:MM-HH:MM"],
    "cursos": ["curso1"],
    "laboratorios": ["lab1"],
    "observacoes": "string"
  },
  "tipo_visual": "card_resumo|tabela_aulas|grafico_estatisticas|confirmacao_acao",
  "confirmacao": "Texto de confirmação para ações",
  "resposta": "Resposta descritiva"
}

REGRAS:
1. Para consultas, preencha "criterios_busca" e defina "tipo_visual"
2. Para adicionar/editar, preencha "dados_novos" e gere "confirmacao"
3. Para excluir, preencha "criterios_busca" e gere "confirmacao"
4. Sempre retorne JSON válido
5. Use apenas dados fornecidos pelo usuário

CURSOS VÁLIDOS: Biomedicina, Farmácia, Enfermagem, Odontologia, Medicina, Fisioterapia, Nutrição, Ed. Física, Psicologia, Medicina Veterinária, Química Tecnológica, Engenharia, Tec. e Cosmético

HORÁRIOS VÁLIDOS: 07:00-09:10, 09:30-12:00, 13:00-15:10, 15:30-18:00, 18:30-20:10, 20:30-22:00`;
  }

  /**
   * Constrói o prompt do usuário para a IA
   * @param {string} textoUsuario - Texto da consulta
   * @param {string} intencao - Intenção identificada
   * @param {Object} parametros - Parâmetros já extraídos
   * @returns {string}
   */
  construirPromptIA(textoUsuario, intencao, parametros) {
    return `Consulta do usuário: "${textoUsuario}"

Intenção identificada: ${intencao}

Parâmetros já extraídos:
${JSON.stringify(parametros, null, 2)}

Por favor, processe esta consulta e retorne o JSON estruturado conforme as instruções.`;
  }

  /**
   * Mapeia intenção para ação
   * @param {string} intencao - Tipo de intenção
   * @returns {string} - Ação correspondente
   */
  mapearIntencaoParaAcao(intencao) {
    const mapeamento = {
      [TIPOS_INTENCAO.CONSULTAR_AULA]: 'consultar',
      [TIPOS_INTENCAO.CONSULTAR_HORARIO]: 'consultar',
      [TIPOS_INTENCAO.CONSULTAR_QUANTIDADE]: 'consultar',
      [TIPOS_INTENCAO.CONSULTAR_ESTATISTICAS]: 'consultar',
      [TIPOS_INTENCAO.ADICIONAR_AULA]: 'adicionar',
      [TIPOS_INTENCAO.EDITAR_AULA]: 'editar',
      [TIPOS_INTENCAO.EXCLUIR_AULA]: 'excluir'
    };

    return mapeamento[intencao] || 'consultar';
  }

  /**
   * Gera resposta descritiva para consulta
   * @param {Object} parametros - Parâmetros da consulta
   * @returns {string}
   */
  gerarRespostaConsulta(parametros) {
    const partes = [];

    if (parametros.termoBusca) partes.push(`"${parametros.termoBusca}"`);
    if (parametros.assunto) partes.push(`"${parametros.assunto}"`);
    if (parametros.cursos.length > 0) partes.push(`curso(s): ${parametros.cursos.join(', ')}`);
    if (parametros.data) partes.push(`data: ${parametros.data}`);
    if (parametros.mes) partes.push(`mês: ${parametros.mes}`);
    if (parametros.ano) partes.push(`ano: ${parametros.ano}`);

    return `Buscando aulas ${partes.length > 0 ? 'com ' + partes.join(', ') : ''}...`;
  }

  /**
   * Gera confirmação para edição
   * @param {Object} criterios - Critérios de busca
   * @param {Object} dadosNovos - Novos dados
   * @returns {string}
   */
  gerarConfirmacaoEdicao(criterios, dadosNovos) {
    const identificacao = criterios.assunto || criterios.termoBusca || `aula de ${criterios.data}`;
    const mudancas = [];

    if (dadosNovos.horarios) mudancas.push(`horário para ${dadosNovos.horarios[0]}`);
    if (dadosNovos.laboratorios) mudancas.push(`laboratório para ${dadosNovos.laboratorios.join(', ')}`);
    if (dadosNovos.cursos) mudancas.push(`cursos para ${dadosNovos.cursos.join(', ')}`);

    return `Confirma editar ${identificacao}, alterando ${mudancas.join(', ')}?`;
  }

  /**
   * Gera confirmação para exclusão
   * @param {Object} criterios - Critérios de busca
   * @returns {string}
   */
  gerarConfirmacaoExclusao(criterios) {
    const identificacao = criterios.assunto || criterios.termoBusca || `aula de ${criterios.data}`;
    return `Confirma excluir ${identificacao}?`;
  }

  /**
   * Gera sugestão de como reformular a consulta
   * @param {string} intencao - Intenção identificada
   * @returns {string}
   */
  gerarSugestao(intencao) {
    const sugestoes = {
      [TIPOS_INTENCAO.ADICIONAR_AULA]: 'Exemplo: "Adicionar aula de Anatomia para 25/12/2025 às 07:00 no Anatomia 1"',
      [TIPOS_INTENCAO.EDITAR_AULA]: 'Exemplo: "Editar aula de Anatomia do dia 25/12/2025, mudar horário para 09:30"',
      [TIPOS_INTENCAO.EXCLUIR_AULA]: 'Exemplo: "Excluir aula de Anatomia do dia 25/12/2025"',
      [TIPOS_INTENCAO.CONSULTAR_AULA]: 'Exemplo: "Aulas de Medicina em dezembro" ou "Tem aula de anatomia?"',
      [TIPOS_INTENCAO.CONSULTAR_HORARIO]: 'Exemplo: "Qual o horário da aula de anatomia?"',
      [TIPOS_INTENCAO.CONSULTAR_QUANTIDADE]: 'Exemplo: "Quantas aulas tem em novembro?"'
    };

    return sugestoes[intencao] || 'Tente ser mais específico na sua consulta.';
  }
}

export default ProcessadorConsultas;
