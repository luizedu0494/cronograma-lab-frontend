/**
 * Serviço de Análise Preditiva de Ocupação dos Laboratórios
 * Calcula o risco de conflitos e taxa esperada de uso nas próximas semanas
 */
class PredictionService {
  /**
   * Calcula a taxa de ocupação esperada por laboratório com base no histórico
   * @param {Array} aulas - Lista de aulas do Firestore
   * @param {Array} laboratorios - Lista de laboratórios
   */
  calcularPrevisaoOcupacao(aulas, laboratorios) {
    if (!aulas || aulas.length === 0) return [];

    const contagemPorLab = {};
    laboratorios.forEach(lab => {
      contagemPorLab[lab.id || lab.nome] = 0;
    });

    aulas.forEach(aula => {
      const labName = aula.laboratorioSelecionado;
      if (contagemPorLab[labName] !== undefined) {
        contagemPorLab[labName] += 1;
      }
    });

    const totalAulas = aulas.length;
    return Object.entries(contagemPorLab).map(([lab, count]) => {
      const porcentagem = totalAulas > 0 ? Math.round((count / totalAulas) * 100) : 0;
      let nivelRisco = 'Baixo';
      if (porcentagem > 70) nivelRisco = 'Crítico';
      else if (porcentagem > 40) nivelRisco = 'Moderado';

      return {
        laboratorio: lab,
        totalAgendamentos: count,
        taxaOcupacaoEsperada: porcentagem,
        nivelRisco
      };
    });
  }

  /**
   * Identifica horários com maior probabilidade de pico/conflito
   */
  detectarHorariosDePico(aulas) {
    const contagemHorarios = {};
    aulas.forEach(aula => {
      const slot = aula.horarioSlotString || '07:00-09:10';
      const slots = Array.isArray(slot) ? slot : [slot];
      slots.forEach(s => {
        contagemHorarios[s] = (contagemHorarios[s] || 0) + 1;
      });
    });

    return Object.entries(contagemHorarios)
      .map(([horario, quantidade]) => ({ horario, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }
}

export const predictionService = new PredictionService();
export default predictionService;
