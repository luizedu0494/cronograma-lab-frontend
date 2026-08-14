import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  writeBatch,
  doc,
  updateDoc,
  serverTimestamp,
  QueryConstraint,
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { notificadorTelegram } from '../services/NotificadorTelegram';
import { registrarLogExclusao } from '../services/loggerService';
import { LISTA_LABORATORIOS } from '../constants/laboratorios';
import { CriteriosBusca, DadosNovos, ResultadoProcessador } from './ProcessadorConsultas';

dayjs.locale('pt-br');

const TODOS_HORARIOS = [
  '07:00-09:10',
  '09:30-12:00',
  '13:00-15:10',
  '15:30-18:00',
  '18:30-20:10',
  '20:30-22:00',
];

const ORDEM_MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

const LABEL_TIPO: Record<string, string> = {
  prova: '📝 Prova',
  revisao: '📖 Revisão',
  aula_normal: '📚 Aula Normal',
};

export interface UsuarioAtual {
  uid?: string;
  displayName?: string;
  email?: string;
}

export interface ResultadoExecucao {
  tipo?: string;
  titulo?: string;
  valor?: string | number;
  descricao?: string;
  mensagem?: string;
  dados_consulta?: any;
  erro?: string;
}

class ExecutorAcoes {
  private currentUser: UsuarioAtual | null;

  constructor(currentUser?: UsuarioAtual | null) {
    this.currentUser = currentUser || null;
  }

  /**
   * Roteador Principal de Execução
   */
  async executar(dadosProcessados: ResultadoProcessador): Promise<ResultadoExecucao> {
    const {
      acao,
      criterios_busca,
      tipo_visual,
      agrupar_por,
      analise_especial,
      metrica,
      dados_novos,
      titulo_sugerido,
    } = dadosProcessados;

    try {
      const criterios: CriteriosBusca = criterios_busca || {};
      if (acao === 'consultar') {
        if (!criterios.data && !criterios.mes && !criterios.ano) {
          criterios.ano = dayjs().year().toString();
        }
        return await this.consultar(
          criterios,
          tipo_visual,
          agrupar_por,
          analise_especial,
          metrica,
          titulo_sugerido
        );
      }

      if (acao === 'adicionar' && dados_novos) return await this.adicionar(dados_novos);
      if (acao === 'editar' && dados_novos) return await this.editar(criterios, dados_novos);
      if (acao === 'excluir') return await this.excluir(criterios);

      return { erro: 'Ação desconhecida.' };
    } catch (e: any) {
      console.error(e);
      return { erro: `Erro na execução: ${e?.message || e}` };
    }
  }

  async consultar(
    criterios: CriteriosBusca,
    tipoVisual?: string,
    agruparPor?: string,
    analiseEspecial?: string | null,
    metrica?: string,
    tituloSugerido?: string
  ): Promise<ResultadoExecucao> {
    const aulas = await this.buscarAulas(criterios);

    if (analiseEspecial === 'taxa_ocupacao') return this.analisarTaxaOcupacao(aulas, criterios);
    if (analiseEspecial === 'horarios_vagos') return this.analisarHorariosVagos(aulas, criterios);
    if (analiseEspecial === 'nao_utilizados') return this.analisarOciosidade(aulas, criterios);
    if (analiseEspecial === 'media_diaria') return this.analisarMediaDiaria(aulas, criterios);
    if (analiseEspecial === 'dias_lotados') return this.analisarDiasLotados(aulas, criterios);
    if (analiseEspecial === 'comparar_tipos')
      return this.analisarComparacaoTipos(aulas, criterios, tituloSugerido);

    if (tipoVisual === 'grafico_linha') {
      return this.gerarEvolucaoTemporal(aulas, criterios, metrica, tituloSugerido);
    }

    if (tipoVisual === 'grafico_estatisticas') {
      return this.gerarEstatisticas(aulas, criterios, agruparPor, metrica, tituloSugerido);
    }

    if (tipoVisual === 'tabela_aulas') {
      return this.gerarTabelaAulas(aulas, criterios);
    }

    return {
      tipo: 'kpi_numero',
      titulo: metrica === 'duracao' ? 'Horas Totais' : this.gerarTituloKpi(criterios),
      valor:
        metrica === 'duracao'
          ? (this.calcularMinutosTotais(aulas) / 60).toFixed(1) + 'h'
          : aulas.length,
      descricao: this.gerarDescricaoFiltro(criterios),
    };
  }

  async buscarAulas(criterios: CriteriosBusca): Promise<any[]> {
    try {
      let q = collection(db, 'aulas');
      const constraints: any[] = [];

      if (criterios.data) {
        const d = dayjs(criterios.data, 'DD/MM/YYYY');
        constraints.push(where('dataInicio', '>=', Timestamp.fromDate(d.startOf('day').toDate())));
        constraints.push(where('dataInicio', '<=', Timestamp.fromDate(d.endOf('day').toDate())));
      } else if (criterios.mes) {
        const [mes, ano] = criterios.mes.split('/');
        const d = dayjs()
          .month(parseInt(mes) - 1)
          .year(parseInt(ano));
        constraints.push(
          where('dataInicio', '>=', Timestamp.fromDate(d.startOf('month').toDate()))
        );
        constraints.push(where('dataInicio', '<=', Timestamp.fromDate(d.endOf('month').toDate())));
      } else if (criterios.ano) {
        const d = dayjs().year(parseInt(criterios.ano));
        constraints.push(where('dataInicio', '>=', Timestamp.fromDate(d.startOf('year').toDate())));
        constraints.push(where('dataInicio', '<=', Timestamp.fromDate(d.endOf('year').toDate())));
      }

      let queryRef: any = q;
      for (const constraint of constraints) {
        queryRef = query(queryRef, constraint);
      }

      const snapshot = await getDocs(queryRef);
      let aulas: any[] = snapshot.docs.map(docSnap =>
        Object.assign({ id: docSnap.id }, docSnap.data())
      );

      if (criterios.laboratorio) {
        const t = criterios.laboratorio.toLowerCase().trim();
        aulas = aulas.filter(a => (a.laboratorioSelecionado || '').toLowerCase().includes(t));
      }

      if (criterios.cursos && criterios.cursos.length > 0) {
        const t = criterios.cursos.map(c => c.toLowerCase().trim());
        aulas = aulas.filter(a => {
          const cAula = Array.isArray(a.cursos) ? a.cursos : [];
          return cAula.some((ca: string) => t.some(tb => ca.toLowerCase().includes(tb)));
        });
      }

      if (criterios.termoBusca) {
        const t = criterios.termoBusca.toLowerCase().trim();
        aulas = aulas.filter(
          a =>
            (a.assunto || '').toLowerCase().includes(t) ||
            (a.observacoes || '').toLowerCase().includes(t)
        );
      }

      if (criterios.filtro_tipo === 'prova') {
        aulas = aulas.filter(a => a.isProva === true);
      } else if (criterios.filtro_tipo === 'revisao') {
        aulas = aulas.filter(a => a.isRevisao === true && !a.isProva);
      } else if (criterios.filtro_tipo === 'aula_normal') {
        aulas = aulas.filter(a => !a.isProva && !a.isRevisao);
      }

      if (criterios.termoBusca && criterios.termoBusca.toLowerCase().includes('pendente')) {
        aulas = aulas.filter(a => a.status === 'pendente');
      }

      return aulas;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  gerarEvolucaoTemporal(
    aulas: any[],
    criterios: CriteriosBusca,
    metrica?: string,
    tituloSugerido?: string
  ): ResultadoExecucao {
    const dadosTemporais: Record<string, number> = {};

    aulas.forEach(aula => {
      if (!aula.dataInicio) return;
      const chave = dayjs(aula.dataInicio.toDate()).format('MMM/YY').toLowerCase();

      if (!dadosTemporais[chave]) dadosTemporais[chave] = 0;

      if (metrica === 'duracao')
        dadosTemporais[chave] += this.calcularDuracaoAula(aula.horarioSlotString);
      else dadosTemporais[chave] += 1;
    });

    const labels = Object.keys(dadosTemporais).sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
      return (ORDEM_MESES[mesA] || 0) - (ORDEM_MESES[mesB] || 0);
    });

    const labelsFormatadas = labels.map(l => l.charAt(0).toUpperCase() + l.slice(1));
    const valores = labels.map(l => {
      const val = dadosTemporais[l];
      return metrica === 'duracao' ? parseFloat((val / 60).toFixed(1)) : val;
    });

    return {
      tipo: 'grafico_linha',
      titulo: tituloSugerido || this.gerarTituloComTipo(criterios, 'Evolução Temporal'),
      dados_consulta: { labels: labelsFormatadas, valores, tipo_grafico: 'line' },
    };
  }

  gerarEstatisticas(
    aulas: any[],
    criterios: CriteriosBusca,
    agruparPor?: string,
    metrica?: string,
    tituloSugerido?: string
  ): ResultadoExecucao {
    const contagem: Record<string, { qtd: number; minutos: number }> = {};
    let tituloGrafico = 'Distribuição';

    aulas.forEach(aula => {
      let chaves: string[] = [];
      if (agruparPor === 'turno') {
        const h = parseInt(aula.horarioSlotString.split(':')[0]);
        chaves = [h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite'];
        tituloGrafico = 'Por Turno';
      } else if (agruparPor === 'dia_semana') {
        chaves = [dayjs(aula.dataInicio.toDate()).format('dddd')];
        tituloGrafico = 'Por Dia da Semana';
      } else if (agruparPor === 'horario') {
        chaves = [aula.horarioSlotString];
        tituloGrafico = 'Picos de Horário';
      } else if (agruparPor === 'laboratorio') {
        chaves = [aula.laboratorioSelecionado || 'N/A'];
        tituloGrafico = 'Por Laboratório';
      } else if (agruparPor === 'curso') {
        chaves = Array.isArray(aula.cursos) ? aula.cursos : [aula.cursos || 'N/A'];
        tituloGrafico = 'Por Curso';
      } else {
        chaves = [aula.dataInicio ? dayjs(aula.dataInicio.toDate()).format('MMM/YYYY') : 'N/A'];
        tituloGrafico = 'Evolução Mensal';
      }

      chaves.forEach(k => {
        const key = k.charAt(0).toUpperCase() + k.slice(1);
        if (!contagem[key]) contagem[key] = { qtd: 0, minutos: 0 };
        contagem[key].qtd += 1;
        contagem[key].minutos += this.calcularDuracaoAula(aula.horarioSlotString);
      });
    });

    let labels = Object.keys(contagem);

    if (agruparPor === 'dia_semana') {
      const dias = [
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
        'Domingo',
      ];
      labels.sort((a, b) => dias.indexOf(a) - dias.indexOf(b));
    } else if (agruparPor === 'horario') {
      labels.sort();
    } else if (agruparPor !== 'mes') {
      labels.sort((a, b) => {
        const valA = metrica === 'duracao' ? contagem[a].minutos : contagem[a].qtd;
        const valB = metrica === 'duracao' ? contagem[b].minutos : contagem[b].qtd;
        return valB - valA;
      });
      labels = labels.slice(0, 12);
    }

    const valores = labels.map(l =>
      metrica === 'duracao' ? parseFloat((contagem[l].minutos / 60).toFixed(1)) : contagem[l].qtd
    );
    if (metrica === 'duracao') tituloGrafico += ' (Horas Totais)';

    return {
      tipo: 'grafico_estatisticas',
      titulo: tituloSugerido || this.gerarTituloComTipo(criterios, tituloGrafico),
      dados_consulta: {
        labels,
        valores,
        tipo_grafico: agruparPor && ['turno', 'dia_semana'].includes(agruparPor) ? 'pie' : 'bar',
      },
    };
  }

  analisarComparacaoTipos(
    aulas: any[],
    criterios: CriteriosBusca,
    tituloSugerido?: string
  ): ResultadoExecucao {
    const contagem: Record<string, number> = { Provas: 0, Revisões: 0, 'Aulas Normais': 0 };

    aulas.forEach(a => {
      if (a.isProva) contagem['Provas']++;
      else if (a.isRevisao) contagem['Revisões']++;
      else contagem['Aulas Normais']++;
    });

    const labels = Object.keys(contagem);
    const valores = Object.values(contagem);

    return {
      tipo: 'grafico_estatisticas',
      titulo: tituloSugerido || `Distribuição por Tipo de Atividade`,
      dados_consulta: { labels, valores, tipo_grafico: 'pie' },
    };
  }

  analisarMediaDiaria(aulas: any[], criterios: CriteriosBusca): ResultadoExecucao {
    if (aulas.length === 0)
      return { tipo: 'kpi_numero', valor: 0, descricao: 'Nenhum registro encontrado' };
    const diasUnicos = new Set(aulas.map(a => dayjs(a.dataInicio.toDate()).format('YYYY-MM-DD')))
      .size;
    const media = aulas.length / (diasUnicos || 1);
    return {
      tipo: 'kpi_numero',
      titulo: `Média por Dia${this.sufixoTipo(criterios)}`,
      valor: media.toFixed(1),
      descricao: `Baseado em ${diasUnicos} dias letivos`,
    };
  }

  analisarTaxaOcupacao(aulas: any[], criterios: CriteriosBusca): ResultadoExecucao {
    let diasUteis = 1;
    if (criterios.mes) diasUteis = 22;
    if (criterios.ano) diasUteis = 264;
    const numLabs = criterios.laboratorio ? 1 : LISTA_LABORATORIOS.length;
    const capacidade = diasUteis * 6 * numLabs;
    let taxa = (aulas.length / capacidade) * 100;
    if (taxa > 100) taxa = 100;

    return {
      tipo: 'kpi_numero',
      titulo: `Taxa de Ocupação${this.sufixoTipo(criterios)}`,
      valor: taxa.toFixed(1) + '%',
      descricao: `Estimativa (${aulas.length} registros / ~${capacidade} slots)`,
    };
  }

  analisarHorariosVagos(aulas: any[], criterios: CriteriosBusca): ResultadoExecucao {
    const dataAlvo = criterios.data || dayjs().format('DD/MM/YYYY');
    const hora = dayjs().hour();
    const min = dayjs().minute();
    const hm = hora * 60 + min;

    let slotAtual = '07:00-09:10';
    if (hm >= 9 * 60 + 30 && hm < 12 * 60) slotAtual = '09:30-12:00';
    else if (hm >= 13 * 60 && hm < 15 * 60 + 30) slotAtual = '13:00-15:10';
    else if (hm >= 15 * 60 + 30 && hm < 18 * 60) slotAtual = '15:30-18:00';
    else if (hm >= 18 * 60 + 30 && hm < 20 * 60 + 30) slotAtual = '18:30-20:10';
    else if (hm >= 20 * 60 + 30) slotAtual = '20:30-22:00';

    if (criterios.laboratorio) {
      const ocupados = aulas.map(a => Array.isArray(a.horarioSlotString) ? a.horarioSlotString : [a.horarioSlotString]).flat();
      const livres = TODOS_HORARIOS.filter(h => !ocupados.includes(h));
      return {
        tipo: 'tabela_aulas',
        titulo: `Horários Livres em ${criterios.laboratorio} (${dataAlvo})`,
        dados_consulta: livres.map(h => ({
          assunto: h === slotAtual ? '🟢 DISPONÍVEL AGORA' : '🟢 Horário Livre',
          data: dataAlvo,
          horario: h,
          laboratorio: criterios.laboratorio,
          cursos: ['-'],
        })),
      };
    }

    const ocupacaoMap = new Set<string>();
    aulas.forEach(a => {
      const lab = a.laboratorioSelecionado || 'N/A';
      const slots = Array.isArray(a.horarioSlotString) ? a.horarioSlotString : [a.horarioSlotString];
      slots.forEach(s => ocupacaoMap.add(`${lab.toLowerCase()}___${s}`));
    });

    const disponiveis: any[] = [];
    LISTA_LABORATORIOS.forEach(labObj => {
      const labName = labObj.name;
      TODOS_HORARIOS.forEach(slot => {
        if (!ocupacaoMap.has(`${labName.toLowerCase()}___${slot}`)) {
          disponiveis.push({
            assunto: slot === slotAtual ? '🟢 DISPONÍVEL AGORA' : '🟢 Livre',
            data: dataAlvo,
            horario: slot,
            laboratorio: labName,
            cursos: ['-'],
          });
        }
      });
    });

    // Ordena colocando os slots disponíveis AGORA primeiro
    disponiveis.sort((a, b) => (a.horario === slotAtual ? -1 : 1));

    return {
      tipo: 'tabela_aulas',
      titulo: `Laboratórios e Horários Livres (${dataAlvo}) — Total: ${disponiveis.length} slots`,
      dados_consulta: disponiveis.slice(0, 50),
    };
  }

  analisarOciosidade(aulas: any[], criterios: CriteriosBusca): ResultadoExecucao {
    const todosLabs = LISTA_LABORATORIOS.map(l => l.name);
    const usados = new Set(aulas.map(a => a.laboratorioSelecionado));
    const vazios = todosLabs.filter(l => !usados.has(l));
    return {
      tipo: 'tabela_aulas',
      titulo: `Laboratórios Ociosos (Sem Uso)`,
      dados_consulta: vazios.map(l => ({
        assunto: 'LIVRE',
        data: '-',
        horario: '-',
        laboratorio: l,
        cursos: ['Ocioso'],
      })),
    };
  }

  analisarDiasLotados(aulas: any[], criterios: CriteriosBusca): ResultadoExecucao {
    const contagem: Record<string, number> = {};
    aulas.forEach(a => {
      const data = dayjs(a.dataInicio.toDate()).format('DD/MM/YYYY');
      contagem[data] = (contagem[data] || 0) + 1;
    });
    const dias = Object.entries(contagem)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([data, qtd]) => ({
        assunto: `${qtd} atividades`,
        data,
        horario: 'Dia Todo',
        laboratorio: 'Vários',
        cursos: ['Pico de Demanda'],
      }));

    return { tipo: 'tabela_aulas', titulo: 'Dias com Maior Demanda', dados_consulta: dias };
  }

  sufixoTipo(criterios: CriteriosBusca): string {
    if (criterios.filtro_tipo === 'prova') return ' (Provas)';
    if (criterios.filtro_tipo === 'revisao') return ' (Revisões)';
    if (criterios.filtro_tipo === 'aula_normal') return ' (Aulas Normais)';
    return '';
  }

  gerarTituloKpi(criterios: CriteriosBusca): string {
    if (criterios.filtro_tipo === 'prova') return 'Total de Provas';
    if (criterios.filtro_tipo === 'revisao') return 'Total de Revisões';
    if (criterios.filtro_tipo === 'aula_normal') return 'Total de Aulas';
    return 'Total Encontrado';
  }

  gerarTituloComTipo(criterios: CriteriosBusca, base: string): string {
    if (criterios.filtro_tipo === 'prova') return `Provas — ${base}`;
    if (criterios.filtro_tipo === 'revisao') return `Revisões — ${base}`;
    if (criterios.filtro_tipo === 'aula_normal') return `Aulas Normais — ${base}`;
    return base;
  }

  calcularDuracaoAula(slot?: string): number {
    if (!slot || !slot.includes('-')) return 0;
    try {
      const [i, f] = slot.split('-');
      const [h1, m1] = i.split(':').map(Number);
      const [h2, m2] = f.split(':').map(Number);
      return h2 * 60 + m2 - (h1 * 60 + m1);
    } catch {
      return 0;
    }
  }

  calcularMinutosTotais(aulas: any[]): number {
    return aulas.reduce((acc, a) => acc + this.calcularDuracaoAula(a.horarioSlotString), 0);
  }

  gerarDescricaoFiltro(criterios: CriteriosBusca): string {
    let p: string[] = [];
    if (criterios.filtro_tipo) p.push(LABEL_TIPO[criterios.filtro_tipo] || criterios.filtro_tipo);
    if (criterios.cursos?.length) p.push(`Curso: ${criterios.cursos.join(', ')}`);
    if (criterios.laboratorio) p.push(`Lab: ${criterios.laboratorio}`);
    if (criterios.data) p.push(`Dia: ${criterios.data}`);
    if (criterios.mes) p.push(`Mês: ${criterios.mes}`);
    if (criterios.ano) p.push(`Ano: ${criterios.ano}`);
    return p.length ? p.join(' | ') : 'Geral';
  }

  gerarTabelaAulas(aulas: any[], criterios: CriteriosBusca): ResultadoExecucao {
    return {
      tipo: 'tabela_aulas',
      titulo: `${this.gerarTituloKpi(criterios)} (${aulas.length})`,
      dados_consulta: aulas.slice(0, 50).map(a => ({
        assunto: a.assunto,
        data: dayjs(a.dataInicio.toDate()).format('DD/MM/YYYY'),
        horario: a.horarioSlotString,
        laboratorio: a.laboratorioSelecionado,
        cursos: a.cursos || [],
        isProva: a.isProva || false,
        isRevisao: a.isRevisao || false,
        tipoRevisao: a.tipoRevisao || null,
      })),
    };
  }

  async adicionar(dados: DadosNovos): Promise<ResultadoExecucao> {
    if (!dados.data || !dados.assunto) {
      throw new Error('Dados incompletos. Preciso de Data e Assunto.');
    }

    const batch = writeBatch(db);

    let labs =
      dados.laboratorios && dados.laboratorios.length ? dados.laboratorios : ['multidisciplinar_1'];
    let horarios = dados.horarios && dados.horarios.length ? dados.horarios : ['07:00-09:10'];

    horarios = horarios.map(h => {
      const match = TODOS_HORARIOS.find(slot => slot.startsWith(h.substring(0, 5)));
      return match || h;
    });

    labs = labs.map(l => {
      const match = LISTA_LABORATORIOS.find(
        labOficial =>
          labOficial.name.toLowerCase().includes(l.toLowerCase()) ||
          labOficial.tipo.toLowerCase().includes(l.toLowerCase())
      );
      return match ? match.name : l;
    });

    const dataISO = dayjs(dados.data, 'DD/MM/YYYY').format('YYYY-MM-DD');
    let count = 0;

    const isProva = dados.isProva === true;
    const isRevisao = !isProva && dados.isRevisao === true;
    const tipoRevisao = isRevisao ? dados.tipoRevisao || 'revisao_conteudo' : null;

    for (const lab of labs) {
      for (const h of horarios) {
        const ref = doc(collection(db, 'aulas'));
        batch.set(ref, {
          assunto: dados.assunto,
          laboratorioSelecionado: lab,
          horarioSlotString: h,
          dataInicio: Timestamp.fromDate(dayjs(dados.data, 'DD/MM/YYYY').toDate()),
          cursos: dados.cursos || [],
          status: 'aprovada',
          createdAt: serverTimestamp(),
          observacoes: dados.observacoes || 'Agendado via Assistente IA',
          propostoPorUid: this.currentUser?.uid || 'sys',
          propostoPorNome: this.currentUser?.displayName || 'IA',
          isProva,
          isRevisao,
          tipoRevisao,
        });
        count++;
      }
    }
    await batch.commit();

    this.notificar(dados, horarios, labs, 'adicionar', dataISO);

    const tipoLabel = isProva ? 'prova(s)' : isRevisao ? 'revisão(ões)' : 'aula(s)';

    return {
      tipo: 'aviso_acao',
      titulo: 'Agendamento Realizado',
      mensagem: `${count} ${tipoLabel} de "${dados.assunto}" criada(s) para ${dados.data}.`,
    };
  }

  async editar(criterios: CriteriosBusca, dadosNovos: DadosNovos): Promise<ResultadoExecucao> {
    const aulas = await this.buscarAulas(criterios);
    if (aulas.length === 0) throw new Error('Nenhuma aula encontrada para editar.');
    const aula = aulas[0];

    const updateData: any = { updatedAt: serverTimestamp() };
    if (dadosNovos.assunto) updateData.assunto = dadosNovos.assunto;
    if (dadosNovos.data)
      updateData.dataInicio = Timestamp.fromDate(dayjs(dadosNovos.data, 'DD/MM/YYYY').toDate());
    if (dadosNovos.horarios?.length) updateData.horarioSlotString = dadosNovos.horarios[0];
    if (dadosNovos.laboratorios?.length)
      updateData.laboratorioSelecionado = dadosNovos.laboratorios[0];
    if (dadosNovos.cursos) updateData.cursos = dadosNovos.cursos;
    if (dadosNovos.isProva !== undefined) updateData.isProva = dadosNovos.isProva;
    if (dadosNovos.isRevisao !== undefined) updateData.isRevisao = dadosNovos.isRevisao;
    if (dadosNovos.tipoRevisao !== undefined) updateData.tipoRevisao = dadosNovos.tipoRevisao;

    await updateDoc(doc(db, 'aulas', aula.id), updateData);

    const dataISO = dayjs(
      updateData.dataInicio ? updateData.dataInicio.toDate() : aula.dataInicio.toDate()
    ).format('YYYY-MM-DD');
    this.notificar(
      { ...aula, ...updateData },
      [updateData.horarioSlotString || aula.horarioSlotString],
      [updateData.laboratorioSelecionado || aula.laboratorioSelecionado],
      'editar',
      dataISO
    );

    return { tipo: 'aviso_acao', titulo: 'Sucesso', mensagem: 'Atividade editada com sucesso.' };
  }

  async excluir(criterios: CriteriosBusca): Promise<ResultadoExecucao> {
    const aulas = await this.buscarAulas(criterios);
    if (aulas.length === 0) throw new Error('Nenhuma atividade encontrada para excluir.');

    const batch = writeBatch(db);
    aulas.forEach(a => batch.delete(doc(db, 'aulas', a.id)));
    await batch.commit();

    for (const a of aulas) {
      await registrarLogExclusao(a, this.currentUser);
    }

    if (aulas.length === 1) {
      this.notificar(
        aulas[0],
        [aulas[0].horarioSlotString],
        [aulas[0].laboratorioSelecionado],
        'excluir',
        null
      );
    }

    return {
      tipo: 'aviso_acao',
      titulo: 'Sucesso',
      mensagem: `${aulas.length} atividade(s) excluída(s).`,
    };
  }

  async notificar(
    dados: any,
    horarios: string | string[],
    laboratorios: string | string[],
    tipo: string,
    dataISO: string | null
  ) {
    try {
      const ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;
      if (ID) {
        await notificadorTelegram.enviarNotificacao(
          ID,
          {
            assunto: dados.assunto,
            data:
              dados.data ||
              (dados.dataInicio ? dayjs(dados.dataInicio.toDate()).format('DD/MM/YYYY') : 'N/A'),
            dataISO: dataISO,
            horario: Array.isArray(horarios) ? horarios.join(', ') : horarios,
            laboratorio: Array.isArray(laboratorios) ? laboratorios.join(', ') : laboratorios,
            cursos: dados.cursos || [],
            observacoes: dados.observacoes,
          },
          tipo
        );
      }
    } catch (e) {
      console.error(e);
    }
  }
}

export default ExecutorAcoes;
