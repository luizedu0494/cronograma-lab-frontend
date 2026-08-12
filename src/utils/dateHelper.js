import dayjs from 'dayjs';

/**
 * Converte qualquer formato de data do Firestore para 'YYYY-MM-DD' no fuso local.
 * Suporta: Timestamp instância, Timestamp serializado { seconds }, string ISO, Date nativa.
 */
export function toDataLocal(dataInicio) {
  if (!dataInicio) return '';
  if (typeof dataInicio.toDate === 'function') {
    return dayjs(dataInicio.toDate()).format('YYYY-MM-DD');
  }
  if (dataInicio.seconds !== undefined) {
    return dayjs(dataInicio.seconds * 1000).format('YYYY-MM-DD');
  }
  return dayjs(dataInicio).format('YYYY-MM-DD');
}

/**
 * Normaliza horarioSlotString para sempre retornar um array de strings.
 * Suporta: string única, array de strings, undefined/null.
 */
export function toHorariosArray(horarioSlotString) {
  if (!horarioSlotString) return [];
  if (Array.isArray(horarioSlotString)) return horarioSlotString;
  return [horarioSlotString];
}
