export const CURSO_COLORS: Record<string, string> = {
  biomedicina: '#4CAF50',
  farmacia: '#F44336',
  enfermagem: '#2196F3',
  odontologia: '#FF9800',
  medicina: '#9C27B0',
  fisioterapia: '#FFC107',
  nutricao: '#00BCD4',
  ed_fisica: '#795548',
  psicologia: '#E91E63',
  med_veterinaria: '#8BC34A',
  quimica_tecnologica: '#607D8B',
  engenharia: '#9E9E9E',
  tec_cosmetico: '#3F51B5',
  default: '#616161',
};

export const getCursoColor = (cursoKey?: string): string => {
  if (!cursoKey) return CURSO_COLORS.default;
  const key = cursoKey.toLowerCase().trim();
  return CURSO_COLORS[key] || CURSO_COLORS.default;
};
