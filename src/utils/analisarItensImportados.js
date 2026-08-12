import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { LISTA_LABORATORIOS } from '../constants/laboratorios';

dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

function normalizarTexto(texto) {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tentarParseData(dataStr) {
  if (!dataStr) return null;
  const formatos = ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'D/M/YYYY', 'DD/MM/YY'];
  for (const fmt of formatos) {
    const d = dayjs(dataStr, fmt, true);
    if (d.isValid()) return d;
  }
  const dFlex = dayjs(dataStr);
  return dFlex.isValid() ? dFlex : null;
}

function converterHoraParaMinutos(horaStr) {
  if (!horaStr) return null;
  const limpo = horaStr.replace(/[^\d:]/g, '');
  const partes = limpo.split(':');
  if (partes.length < 2) return null;
  const h = parseInt(partes[0], 10);
  const m = parseInt(partes[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function verificarColisaoHorario(inicio1, fim1, inicio2, fim2) {
  const mInicio1 = converterHoraParaMinutos(inicio1);
  const mFim1 = converterHoraParaMinutos(fim1);
  const mInicio2 = converterHoraParaMinutos(inicio2);
  const mFim2 = converterHoraParaMinutos(fim2);

  if (mInicio1 === null || mFim1 === null || mInicio2 === null || mFim2 === null) {
    return false;
  }

  return Math.max(mInicio1, mInicio2) < Math.min(mFim1, mFim2);
}

function buscarLaboratorioReconhecido(nomeInformado) {
  if (!nomeInformado) return null;
  const norm = normalizarTexto(nomeInformado);

  const exato = LISTA_LABORATORIOS.find(l => 
    normalizarTexto(l.name) === norm || normalizarTexto(l.id) === norm
  );
  if (exato) return exato;

  return LISTA_LABORATORIOS.find(l => 
    normalizarTexto(l.name).includes(norm) || norm.includes(normalizarTexto(l.name))
  ) || null;
}

export async function analisarItensImportados(itensBrutos, contexto) {
  const { aulasExistentes = [], periodosAtivos = [], feriados = [] } = contexto || {};
  const resultados = [];

  for (let i = 0; i < itensBrutos.length; i++) {
    const item = itensBrutos[i];
    const motivos = [];
    let status = 'valido';

    const objData = tentarParseData(item.data);
    const labReconhecido = buscarLaboratorioReconhecido(item.laboratorio);

    if (!objData) {
      motivos.push('Data inválida ou em formato não reconhecido.');
      status = 'invalido';
    }

    if (!item.laboratorio) {
      motivos.push('Laboratório não informado.');
      status = 'invalido';
    } else if (!labReconhecido) {
      motivos.push(`Laboratório "${item.laboratorio}" não encontrado no cadastro do sistema.`);
      status = 'conflito';
    }

    if (!item.disciplina) {
      motivos.push('Disciplina/Assunto não informado.');
      if (status !== 'invalido') status = 'atencao';
    }

    if (objData && labReconhecido) {
      const dataIso = objData.format('YYYY-MM-DD');

      if (periodosAtivos.length > 0) {
        const dentroDePeriodo = periodosAtivos.some(p => {
          const inicio = dayjs(p.dataInicio);
          const fim = dayjs(p.dataFim);
          return objData.isBetween(inicio, fim, 'day', '[]');
        });

        if (!dentroDePeriodo) {
          motivos.push('Data fora de qualquer período acadêmico ativo.');
          if (status === 'valido') status = 'atencao';
        }
      }

      const dataStr = objData.format('DD/MM/YYYY');
      const ehFeriado = feriados.find(f => f.date === dataStr || f.data === dataStr || f.date === dataIso);
      if (ehFeriado) {
        motivos.push(`Data coincide com feriado: ${ehFeriado.name || ehFeriado.nome || 'Feriado'}`);
        if (status === 'valido') status = 'atencao';
      }

      if (item.horarioInicio && item.horarioFim) {
        const conflitoAula = aulasExistentes.find(a => {
          const mesmaData = a.dataInicio ? dayjs(a.dataInicio.toDate ? a.dataInicio.toDate() : a.dataInicio).format('YYYY-MM-DD') === dataIso : false;
          const mesmoLab = a.laboratorioId === labReconhecido.id || a.laboratorioSelecionado === labReconhecido.id || a.laboratorio === labReconhecido.name;
          
          if (!mesmaData || !mesmoLab) return false;

          let aInicio = a.horarioInicio;
          let aFim = a.horarioFim;

          if ((!aInicio || !aFim) && a.horarioSlotString) {
            const [i, f] = a.horarioSlotString.split('-');
            aInicio = i;
            aFim = f;
          }

          return verificarColisaoHorario(item.horarioInicio, item.horarioFim, aInicio, aFim);
        });

        if (conflitoAula) {
          motivos.push(`Conflito de horário com a aula "${conflitoAula.assunto || conflitoAula.disciplina || 'Existente'}" (${conflitoAula.horarioSlotString || conflitoAula.horarioInicio || 'horário'})`);
          status = 'conflito';
        }
      }
    }

    const itemNormalizado = (status !== 'invalido' && objData && labReconhecido) ? {
      dataInicio: objData.toDate(),
      dataFim: objData.toDate(),
      dataFormatted: objData.format('DD/MM/YYYY'),
      laboratorioId: labReconhecido.id,
      laboratorioNome: labReconhecido.name,
      assunto: item.disciplina || 'Aula Importada',
      professor: item.professor || '',
      cursos: item.curso ? [item.curso] : [],
      horarioInicio: item.horarioInicio || '07:00',
      horarioFim: item.horarioFim || '09:10',
      horarioSlotString: (item.horarioInicio && item.horarioFim) ? `${item.horarioInicio}-${item.horarioFim}` : '07:00-09:10',
      turno: item.turno || 'Matutino',
      observacoes: item.observacoes || '',
    } : null;

    resultados.push({
      idTemp: `item-${i}-${Date.now()}`,
      original: item,
      normalizado: itemNormalizado,
      labReconhecidoName: labReconhecido ? labReconhecido.name : null,
      status,
      motivos,
      selecionado: status === 'valido' || status === 'atencao',
    });
  }

  return resultados;
}
