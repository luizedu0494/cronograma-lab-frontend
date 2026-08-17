import { useState, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

export interface ConsultaParams {
  dataInicio: Date | dayjs.Dayjs;
  dataFim: Date | dayjs.Dayjs;
  diasSemana: number[]; // Array de números [0..6], onde 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab
  horarios: string[]; // ex: ["13:00-15:10", "15:30-18:00"]
  laboratorios: string[]; // ex: ["Lab Anatomia 1", "Microscopia da Galeria"]
  apenasLivres?: boolean;
}

export interface ConflitoItem {
  id?: string;
  tipo: 'aula' | 'evento';
  laboratorio: string;
  horario: string;
  titulo: string;
  detalhe?: string;
}

export interface SlotDisponibilidade {
  horario: string;
  laboratorio: string;
  livre: boolean;
  conflitos: ConflitoItem[];
}

export interface ResultadoDataDisponibilidade {
  data: Date;
  dataIso: string;
  dataFormatted: string;
  diaSemanaNome: string;
  status: 'livre' | 'parcial' | 'ocupado';
  slotsStatus: SlotDisponibilidade[];
  conflitos: ConflitoItem[];
}

export function gerarDatasNoPeriodo(inicio: Date | dayjs.Dayjs, fim: Date | dayjs.Dayjs, diasSemana: number[]): Date[] {
  const datas: Date[] = [];
  let cursor = dayjs(inicio).startOf('day');
  const limitDate = dayjs(fim).endOf('day');

  while (cursor.isBefore(limitDate)) {
    if (diasSemana.includes(cursor.day())) {
      datas.push(cursor.toDate());
    }
    cursor = cursor.add(1, 'day');
  }

  return datas;
}

export function useDisponibilidade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoDataDisponibilidade[]>([]);

  const consultarDisponibilidade = useCallback(async (params: ConsultaParams): Promise<ResultadoDataDisponibilidade[]> => {
    setLoading(true);
    setError(null);

    try {
      const startDt = dayjs(params.dataInicio).startOf('day');
      const endDt = dayjs(params.dataFim).endOf('day');

      const datasAlvo = gerarDatasNoPeriodo(startDt, endDt, params.diasSemana);

      if (datasAlvo.length === 0) {
        setResultados([]);
        setLoading(false);
        return [];
      }

      // Executar APENAS 2 queries no Firestore para cobrir todo o período
      const startTs = Timestamp.fromDate(startDt.toDate());
      const endTs = Timestamp.fromDate(endDt.toDate());

      const [snapAulas, snapEventos] = await Promise.all([
        getDocs(query(
          collection(db, 'aulas'),
          where('dataInicio', '>=', startTs),
          where('dataInicio', '<=', endTs),
          where('status', '==', 'aprovada')
        )),
        getDocs(query(
          collection(db, 'eventosManutencao'),
          where('dataInicio', '>=', startTs),
          where('dataInicio', '<=', endTs)
        ))
      ]);

      // Mapeamento local dos ocupados por: "YYYY-MM-DD_HORARIO_LAB"
      const ocupadosMap = new Map<string, ConflitoItem[]>();

      const registrarOcupacao = (key: string, conflito: ConflitoItem) => {
        if (!ocupadosMap.has(key)) {
          ocupadosMap.set(key, []);
        }
        ocupadosMap.get(key)!.push(conflito);
      };

      // Processar Aulas
      snapAulas.docs.forEach(docSnap => {
        const data = docSnap.data();
        const start = data.dataInicio instanceof Timestamp ? data.dataInicio.toDate() : new Date(data.dataInicio);
        const dateKey = dayjs(start).format('YYYY-MM-DD');
        const lab = data.laboratorioSelecionado || data.laboratorio;

        if (params.laboratorios.includes(lab) || params.laboratorios.includes('Todos')) {
          let slotStr = data.horarioSlotString;
          if (!slotStr) {
            slotStr = `${dayjs(start).format('HH:mm')}-${dayjs(data.dataFim?.toDate?.() || start).format('HH:mm')}`;
          }

          const conflito: ConflitoItem = {
            id: docSnap.id,
            tipo: 'aula',
            laboratorio: lab,
            horario: slotStr,
            titulo: data.assunto || data.disciplina || 'Aula Agendada',
            detalhe: `Prof: ${data.propostoPorNome || data.professor || 'N/A'}${data.cursos ? ` (${data.cursos.join(', ')})` : ''}`,
          };

          registrarOcupacao(`${dateKey}_${slotStr}_${lab}`, conflito);
          // Se lab for genérico
          registrarOcupacao(`${dateKey}_${slotStr}_Todos`, conflito);
        }
      });

      // Processar Eventos de Manutenção
      snapEventos.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'cancelado') return;

        const start = data.dataInicio instanceof Timestamp ? data.dataInicio.toDate() : new Date(data.dataInicio);
        const dateKey = dayjs(start).format('YYYY-MM-DD');
        const lab = data.laboratorio || 'Todos';

        if (lab === 'Todos' || params.laboratorios.includes(lab) || params.laboratorios.includes('Todos')) {
          let slotStr = data.horarioSlotString;
          if (!slotStr) {
            slotStr = `${dayjs(start).format('HH:mm')}-${dayjs(data.dataFim?.toDate?.() || start).format('HH:mm')}`;
          }

          const conflito: ConflitoItem = {
            id: docSnap.id,
            tipo: 'evento',
            laboratorio: lab,
            horario: slotStr,
            titulo: data.titulo || 'Evento / Manutenção',
            detalhe: `${data.tipo || 'Manutenção'}${data.descricao ? `: ${data.descricao}` : ''}`,
          };

          if (lab === 'Todos') {
            params.laboratorios.forEach(l => {
              registrarOcupacao(`${dateKey}_${slotStr}_${l}`, conflito);
            });
            registrarOcupacao(`${dateKey}_${slotStr}_Todos`, conflito);
          } else {
            registrarOcupacao(`${dateKey}_${slotStr}_${lab}`, conflito);
          }
        }
      });

      // Processar cada data alvo
      const listaResultados: ResultadoDataDisponibilidade[] = datasAlvo.map(dt => {
        const dateObj = dayjs(dt);
        const dateKey = dateObj.format('YYYY-MM-DD');
        const slotsStatus: SlotDisponibilidade[] = [];
        const conflitosData: ConflitoItem[] = [];

        let totalSlots = 0;
        let slotsLivresCount = 0;

        params.horarios.forEach(slot => {
          params.laboratorios.forEach(lab => {
            totalSlots++;
            const keyEspecifica = `${dateKey}_${slot}_${lab}`;
            const keyTodos = `${dateKey}_${slot}_Todos`;

            const cEspecificos = ocupadosMap.get(keyEspecifica) || [];
            const cTodos = ocupadosMap.get(keyTodos) || [];
            const conflitosCombinados = [...cEspecificos, ...cTodos];

            const isLivre = conflitosCombinados.length === 0;

            if (isLivre) {
              slotsLivresCount++;
            } else {
              conflitosData.push(...conflitosCombinados);
            }

            slotsStatus.push({
              horario: slot,
              laboratorio: lab,
              livre: isLivre,
              conflitos: conflitosCombinados,
            });
          });
        });

        let statusFinal: 'livre' | 'parcial' | 'ocupado' = 'ocupado';
        if (slotsLivresCount === totalSlots) {
          statusFinal = 'livre';
        } else if (slotsLivresCount > 0) {
          statusFinal = 'parcial';
        }

        return {
          data: dt,
          dataIso: dateKey,
          dataFormatted: dateObj.format('DD/MM/YYYY'),
          diaSemanaNome: dateObj.format('dddd'),
          status: statusFinal,
          slotsStatus,
          conflitos: Array.from(new Set(conflitosData.map(c => JSON.stringify(c)))).map(s => JSON.parse(s)),
        };
      });

      let filtrados = listaResultados;
      if (params.apenasLivres) {
        filtrados = listaResultados.filter(r => r.status === 'livre');
      }

      setResultados(filtrados);
      return filtrados;
    } catch (err: any) {
      console.error("Erro na consulta de disponibilidade:", err);
      setError("Falha ao consultar disponibilidade. Verifique os parâmetros.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    consultarDisponibilidade,
    resultados,
    loading,
    error,
  };
}
