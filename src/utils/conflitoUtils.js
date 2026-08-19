import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from '../firebaseConfig';
import { notificadorTelegram } from '../services/NotificadorTelegram';

const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

/**
 * Converte string de horário "HH:mm-HH:mm" ou similares em minutos para comparação.
 */
function converterHoraParaMinutos(horaStr) {
  if (!horaStr) return null;
  const limpo = String(horaStr).replace(/[^\d:]/g, '');
  const partes = limpo.split(':');
  if (partes.length < 2) return null;
  const h = parseInt(partes[0], 10);
  const m = parseInt(partes[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function verificarColisao(inicio1, fim1, inicio2, fim2) {
  const mI1 = converterHoraParaMinutos(inicio1);
  const mF1 = converterHoraParaMinutos(fim1);
  const mI2 = converterHoraParaMinutos(inicio2);
  const mF2 = converterHoraParaMinutos(fim2);
  if (mI1 === null || mF1 === null || mI2 === null || mF2 === null) return true;
  return Math.max(mI1, mI2) < Math.min(mF1, mF2);
}

/**
 * Busca propostas pendentes no mesmo laboratório e horário e altera status para 'rejeitada',
 * enviando notificação no Telegram.
 * 
 * @param {Object} params
 * @param {string} params.laboratorioSelecionado - Nome ou ID do laboratório (ou 'Todos')
 * @param {Date|Timestamp|string} params.dataInicio - Data/Hora de início do agendamento do coordenador
 * @param {Date|Timestamp|string} [params.dataFim] - Data/Hora de fim do agendamento do coordenador
 * @param {string|string[]} [params.horarioSlotString] - Ex: "07:00-09:10"
 * @param {string} params.assuntoAgendamento - Nome da aula ou evento que ocupou o horário
 * @param {string} [params.idAgendamentoIgnorar] - ID do próprio agendamento (ex: aula que acabou de ser aprovada)
 * @returns {Promise<Array>} Lista de propostas pendentes que foram auto-rejeitadas
 */
export async function autoRejeitarPendentesConflitantes({
  laboratorioSelecionado,
  dataInicio,
  dataFim,
  horarioSlotString,
  assuntoAgendamento,
  idAgendamentoIgnorar
}) {
  if (!dataInicio) return [];

  const dtInicio = dayjs(dataInicio.toDate ? dataInicio.toDate() : dataInicio);
  if (!dtInicio.isValid()) return [];

  const inicioDia = Timestamp.fromDate(dtInicio.startOf('day').toDate());
  const fimDia = Timestamp.fromDate(dtInicio.endOf('day').toDate());

  try {
    const snap = await getDocs(query(
      collection(db, 'aulas'),
      where('dataInicio', '>=', inicioDia),
      where('dataInicio', '<=', fimDia),
      where('status', '==', 'pendente')
    ));

    if (snap.empty) return [];

    const novohInicio = dtInicio.format('HH:mm');
    const novohFim = dataFim ? dayjs(dataFim.toDate ? dataFim.toDate() : dataFim).format('HH:mm') : novohInicio;

    const pendentesRejeitadas = [];

    for (const d of snap.docs) {
      if (idAgendamentoIgnorar && d.id === idAgendamentoIgnorar) continue;

      const pData = d.data();
      if (pData.status === 'rejeitada') continue;

      // Verifica laboratório (se for agendamento geral/Todos ou o mesmo lab)
      const mesmoLab = laboratorioSelecionado === 'Todos' ||
        !pData.laboratorioSelecionado ||
        pData.laboratorioSelecionado === laboratorioSelecionado ||
        pData.laboratorioId === laboratorioSelecionado;

      if (!mesmoLab) continue;

      // Verifica horário
      let pInicio = pData.horarioInicio;
      let pFim = pData.horarioFim;
      if ((!pInicio || !pFim) && pData.horarioSlotString) {
        const slotStr = Array.isArray(pData.horarioSlotString) ? pData.horarioSlotString[0] : pData.horarioSlotString;
        const [i, f] = slotStr.split('-');
        pInicio = i;
        pFim = f;
      }

      if (!pInicio || !pFim) {
        const pDtI = dayjs(pData.dataInicio?.toDate?.() || pData.dataInicio);
        const pDtF = dayjs(pData.dataFim?.toDate?.() || pData.dataFim);
        if (pDtI.isValid()) pInicio = pDtI.format('HH:mm');
        if (pDtF.isValid()) pFim = pDtF.format('HH:mm');
      }

      const colidiu = verificarColisao(novohInicio, novohFim, pInicio, pFim);

      if (colidiu) {
        const motivo = `Rejeitada automaticamente por sobreposição com agendamento do coordenador: "${assuntoAgendamento || 'Agendamento Direto'}"`;

        await updateDoc(doc(db, 'aulas', d.id), {
          status: 'rejeitada',
          motivoRejeicao: motivo,
          updatedAt: serverTimestamp()
        });

        if (TELEGRAM_CHAT_ID) {
          const dtNotif = pData.dataInicio?.toDate ? dayjs(pData.dataInicio.toDate()) : dayjs(pData.dataInicio);
          await notificadorTelegram.enviarNotificacao(
            TELEGRAM_CHAT_ID,
            {
              assunto: pData.assunto,
              data: dtNotif.isValid() ? dtNotif.format('DD/MM/YYYY') : 'N/A',
              dataISO: dtNotif.isValid() ? dtNotif.format('YYYY-MM-DD') : null,
              horario: pData.horarioSlotString || `${pInicio}-${pFim}`,
              laboratorio: pData.laboratorioSelecionado || laboratorioSelecionado,
              cursos: pData.cursos,
              observacoes: `Proposta cancelada devido ao agendamento de "${assuntoAgendamento || 'Aula/Evento'}" pelo coordenador.`,
              propostoPorNome: pData.propostoPorNome || pData.professorNome || 'Técnico',
              isRevisao: pData.isRevisao || false,
              isProva: pData.isProva || false,
            },
            'rejeitada'
          );
        }

        pendentesRejeitadas.push({ id: d.id, ...pData });
      }
    }

    return pendentesRejeitadas;
  } catch (error) {
    console.error('Erro ao auto-rejeitar pendências conflitantes:', error);
    return [];
  }
}
