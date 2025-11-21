/**
 * ClassificadorIntencao.js
 * 
 * Sistema de classificação de intenção do usuário baseado em padrões e palavras-chave.
 * Identifica o tipo de consulta/ação que o usuário deseja realizar.
 */

export const TIPOS_INTENCAO = {
  CONSULTAR_AULA: 'consultar_aula',
  CONSULTAR_HORARIO: 'consultar_horario',
  CONSULTAR_QUANTIDADE: 'consultar_quantidade',
  CONSULTAR_ESTATISTICAS: 'consultar_estatisticas',
  ADICIONAR_AULA: 'adicionar_aula',
  EDITAR_AULA: 'editar_aula',
  EXCLUIR_AULA: 'excluir_aula',
  DESCONHECIDO: 'desconhecido'
};

class ClassificadorIntencao {
  constructor() {
    // Padrões de palavras-chave para cada tipo de intenção
    this.padroes = {
      [TIPOS_INTENCAO.CONSULTAR_AULA]: [
        /\b(qual|quais|tem|existe|mostrar|listar|ver|buscar|procurar)\b.*\b(aula|aulas)\b/i,
        /\b(aula|aulas)\b.*\b(de|sobre|do|da)\b/i,
        /\b(tem aula)\b/i
      ],
      [TIPOS_INTENCAO.CONSULTAR_HORARIO]: [
        /\b(qual|quando)\b.*\b(horário|horario|hora)\b/i,
        /\b(horário|horario|hora)\b.*\b(de|da|do)\b/i,
        /\b(que horas)\b/i
      ],
      [TIPOS_INTENCAO.CONSULTAR_QUANTIDADE]: [
        /\b(quantas|quantos|quanto)\b.*\b(aula|aulas)\b/i,
        /\b(total|número|numero)\b.*\b(de aulas|aulas)\b/i,
        /\b(contar|contagem)\b/i
      ],
      [TIPOS_INTENCAO.CONSULTAR_ESTATISTICAS]: [
        /\b(estatística|estatistica|análise|analise|resumo|relatório|relatorio)\b/i,
        /\b(mais usado|mais utilizado|distribuição|distribuicao)\b/i
      ],
      [TIPOS_INTENCAO.ADICIONAR_AULA]: [
        /\b(adicionar|criar|agendar|cadastrar|incluir|nova|novo)\b.*\b(aula)\b/i,
        /\b(aula)\b.*\b(para|no|em)\b.*\d{1,2}\/\d{1,2}\/\d{4}/i,
        /\b(marcar|reservar)\b.*\b(aula|lab|laboratório|laboratorio)\b/i
      ],
      [TIPOS_INTENCAO.EDITAR_AULA]: [
        /\b(editar|alterar|modificar|mudar|atualizar|trocar)\b.*\b(aula)\b/i,
        /\b(aula)\b.*\b(editar|alterar|modificar|mudar)\b/i,
        /\b(mudar|trocar)\b.*\b(horário|horario|data|laboratório|laboratorio)\b/i
      ],
      [TIPOS_INTENCAO.EXCLUIR_AULA]: [
        /\b(excluir|deletar|remover|cancelar|apagar)\b.*\b(aula)\b/i,
        /\b(aula)\b.*\b(excluir|deletar|remover|cancelar|apagar)\b/i
      ]
    };
  }

  /**
   * Classifica a intenção do usuário com base no texto da consulta
   * @param {string} texto - Texto da consulta do usuário
   * @returns {string} - Tipo de intenção identificado
   */
  classificar(texto) {
    if (!texto || typeof texto !== 'string') {
      return TIPOS_INTENCAO.DESCONHECIDO;
    }

    const textoNormalizado = texto.toLowerCase().trim();

    // Verifica cada tipo de intenção
    for (const [tipo, padroes] of Object.entries(this.padroes)) {
      for (const padrao of padroes) {
        if (padrao.test(textoNormalizado)) {
          return tipo;
        }
      }
    }

    // Se não encontrou padrão específico, tenta inferir pelo contexto
    if (this.contemData(textoNormalizado) && this.contemHorario(textoNormalizado)) {
      return TIPOS_INTENCAO.ADICIONAR_AULA;
    }

    // Padrão padrão: consulta de aula
    if (textoNormalizado.includes('aula')) {
      return TIPOS_INTENCAO.CONSULTAR_AULA;
    }

    return TIPOS_INTENCAO.DESCONHECIDO;
  }

  /**
   * Verifica se o texto contém uma data
   * @param {string} texto - Texto a ser verificado
   * @returns {boolean}
   */
  contemData(texto) {
    const padraoData = /\d{1,2}\/\d{1,2}\/\d{4}/;
    const palavrasData = /\b(hoje|amanhã|amanha|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)\b/i;
    return padraoData.test(texto) || palavrasData.test(texto);
  }

  /**
   * Verifica se o texto contém um horário
   * @param {string} texto - Texto a ser verificado
   * @returns {boolean}
   */
  contemHorario(texto) {
    const padraoHorario = /\d{1,2}:\d{2}/;
    const palavrasHorario = /\b(manhã|manha|tarde|noite|matutino|vespertino|noturno)\b/i;
    return padraoHorario.test(texto) || palavrasHorario.test(texto);
  }

  /**
   * Retorna uma descrição da intenção classificada
   * @param {string} tipo - Tipo de intenção
   * @returns {string} - Descrição da intenção
   */
  obterDescricao(tipo) {
    const descricoes = {
      [TIPOS_INTENCAO.CONSULTAR_AULA]: 'Consultar informações sobre aulas',
      [TIPOS_INTENCAO.CONSULTAR_HORARIO]: 'Consultar horário de aula específica',
      [TIPOS_INTENCAO.CONSULTAR_QUANTIDADE]: 'Consultar quantidade de aulas',
      [TIPOS_INTENCAO.CONSULTAR_ESTATISTICAS]: 'Consultar estatísticas e análises',
      [TIPOS_INTENCAO.ADICIONAR_AULA]: 'Adicionar nova aula',
      [TIPOS_INTENCAO.EDITAR_AULA]: 'Editar aula existente',
      [TIPOS_INTENCAO.EXCLUIR_AULA]: 'Excluir aula',
      [TIPOS_INTENCAO.DESCONHECIDO]: 'Intenção não identificada'
    };

    return descricoes[tipo] || descricoes[TIPOS_INTENCAO.DESCONHECIDO];
  }
}

export default ClassificadorIntencao;
