import { db } from '../firebaseConfig';
import { 
    collection, query, where, getDocs, Timestamp, writeBatch, doc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { notificadorTelegram } from './NotificadorTelegram';
// Importante: Lista de labs para calcular ociosidade e normalizar nomes
import { LISTA_LABORATORIOS } from '../constants/laboratorios'; 

dayjs.locale('pt-br');

// Horários oficiais para cálculo de vagas e normalização
const TODOS_HORARIOS = [
    "07:00-09:10", "09:30-12:00", "13:00-15:10", 
    "15:30-18:00", "18:30-20:10", "20:30-22:00"
];

// Helper para ordenação de meses
const ORDEM_MESES = { 'jan':1, 'fev':2, 'mar':3, 'abr':4, 'mai':5, 'jun':6, 'jul':7, 'ago':8, 'set':9, 'out':10, 'nov':11, 'dez':12 };

class ExecutorAcoes {
  constructor(currentUser) {
    this.currentUser = currentUser;
  }

  /**
   * Roteador Principal de Execução
   */
  async executar(dadosProcessados) {
    const { acao, criterios_busca, tipo_visual, agrupar_por, analise_especial, metrica, dados_novos, titulo_sugerido } = dadosProcessados;

    try {
        if (acao === 'consultar') {
            // Proteção: Se não tiver filtro temporal, assume ANO ATUAL para não travar
            if (!criterios_busca.data && !criterios_busca.mes && !criterios_busca.ano) {
                criterios_busca.ano = dayjs().year().toString();
            }
            return await this.consultar(criterios_busca, tipo_visual, agrupar_por, analise_especial, metrica, titulo_sugerido);
        }
        
        // Ações de Escrita
        if (acao === 'adicionar') return await this.adicionar(dados_novos);
        if (acao === 'editar') return await this.editar(criterios_busca, dados_novos);
        if (acao === 'excluir') return await this.excluir(criterios_busca);

        return { erro: "Ação desconhecida." };
    } catch (e) {
        console.error(e);
        return { erro: `Erro na execução: ${e.message}` };
    }
  }

  // =========================================================================
  // LÓGICA DE CONSULTA E ANÁLISE (BI)
  // =========================================================================

  async consultar(criterios, tipoVisual, agruparPor, analiseEspecial, metrica, tituloSugerido) {
    // 1. Busca os dados brutos no Firebase (com filtro inteligente)
    const aulas = await this.buscarAulas(criterios);

    // 2. Roteamento para Análises Especiais (Hardcore)
    if (analiseEspecial === 'taxa_ocupacao') return this.analisarTaxaOcupacao(aulas, criterios);
    if (analiseEspecial === 'horarios_vagos') return this.analisarHorariosVagos(aulas, criterios);
    if (analiseEspecial === 'nao_utilizados') return this.analisarOciosidade(aulas, criterios);
    if (analiseEspecial === 'media_diaria') return this.analisarMediaDiaria(aulas, criterios);
    if (analiseEspecial === 'dias_lotados') return this.analisarDiasLotados(aulas, criterios);

    // 3. Gráfico de LINHA (Evolução Temporal)
    if (tipoVisual === 'grafico_linha') {
        return this.gerarEvolucaoTemporal(aulas, criterios, metrica, tituloSugerido);
    }

    // 4. Gráfico de BARRAS/PIZZA (Distribuição/Ranking)
    if (tipoVisual === 'grafico_estatisticas') {
        return this.gerarEstatisticas(aulas, criterios, agruparPor, metrica, tituloSugerido);
    }

    // 5. Tabela Simples
    if (tipoVisual === 'tabela_aulas') {
        return this.gerarTabelaAulas(aulas, criterios);
    }

    // 6. Padrão: KPI Numérico
    return {
        tipo: 'kpi_numero',
        titulo: metrica === 'duracao' ? 'Horas Totais' : 'Total Encontrado',
        valor: metrica === 'duracao' 
            ? (this.calcularMinutosTotais(aulas)/60).toFixed(1) + 'h' 
            : aulas.length,
        descricao: this.gerarDescricaoFiltro(criterios)
    };
  }

  // =========================================================================
  // ALGORITMO DE BUSCA HÍBRIDA (Firebase + JS Fuzzy)
  // =========================================================================
  async buscarAulas(criterios) {
    try {
      let q = collection(db, "aulas");
      const constraints = [];

      // A. Filtros de Data no Firebase (Rápido)
      if (criterios.data) {
        const d = dayjs(criterios.data, 'DD/MM/YYYY');
        constraints.push(where("dataInicio", ">=", Timestamp.fromDate(d.startOf('day').toDate())));
        constraints.push(where("dataInicio", "<=", Timestamp.fromDate(d.endOf('day').toDate())));
      } else if (criterios.mes) {
        const [mes, ano] = criterios.mes.split('/');
        const d = dayjs().month(parseInt(mes)-1).year(parseInt(ano));
        constraints.push(where("dataInicio", ">=", Timestamp.fromDate(d.startOf('month').toDate())));
        constraints.push(where("dataInicio", "<=", Timestamp.fromDate(d.endOf('month').toDate())));
      } else if (criterios.ano) {
        const d = dayjs().year(parseInt(criterios.ano));
        constraints.push(where("dataInicio", ">=", Timestamp.fromDate(d.startOf('year').toDate())));
        constraints.push(where("dataInicio", "<=", Timestamp.fromDate(d.endOf('year').toDate())));
      }

      if (constraints.length > 0) q = query(q, ...constraints);
      
      const snapshot = await getDocs(q);
      let aulas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // B. Filtros de Texto "Fuzzy" (Local - Resolve letras maiúsculas/minúsculas)
      
      // Filtro de Laboratório
      if (criterios.laboratorio) {
          const t = criterios.laboratorio.toLowerCase().trim();
          aulas = aulas.filter(a => (a.laboratorioSelecionado || '').toLowerCase().includes(t));
      }
      
      // Filtro de Curso (Busca dentro do array de cursos)
      if (criterios.cursos && criterios.cursos.length > 0) {
          const t = criterios.cursos.map(c => c.toLowerCase().trim());
          aulas = aulas.filter(a => {
              const cAula = Array.isArray(a.cursos) ? a.cursos : [];
              return cAula.some(ca => t.some(tb => ca.toLowerCase().includes(tb)));
          });
      }
      
      // Filtro de Termo Geral (Assunto ou Obs)
      if (criterios.termoBusca) {
          const t = criterios.termoBusca.toLowerCase().trim();
          aulas = aulas.filter(a => 
              (a.assunto||'').toLowerCase().includes(t) || (a.observacoes||'').toLowerCase().includes(t)
          );
      }

      return aulas;
    } catch (e) { console.error(e); return []; }
  }

  // =========================================================================
  // CÁLCULOS ESTATÍSTICOS E GRÁFICOS
  // =========================================================================

  gerarEvolucaoTemporal(aulas, criterios, metrica, tituloSugerido) {
      const dadosTemporais = {};
      
      aulas.forEach(aula => {
          if (!aula.dataInicio) return;
          // Agrupa por Mês/Ano (ex: "nov/2025")
          const chave = dayjs(aula.dataInicio.toDate()).format('MMM/YY').toLowerCase();
          
          if (!dadosTemporais[chave]) dadosTemporais[chave] = 0;
          
          if (metrica === 'duracao') dadosTemporais[chave] += this.calcularDuracaoAula(aula.horarioSlotString);
          else dadosTemporais[chave] += 1;
      });

      // Ordenação Cronológica dos Meses
      const labels = Object.keys(dadosTemporais).sort((a, b) => {
          const [mesA, anoA] = a.split('/');
          const [mesB, anoB] = b.split('/');
          if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
          return (ORDEM_MESES[mesA] || 0) - (ORDEM_MESES[mesB] || 0);
      });

      const labelsFormatadas = labels.map(l => l.charAt(0).toUpperCase() + l.slice(1));
      const valores = labels.map(l => {
          const val = dadosTemporais[l];
          return metrica === 'duracao' ? parseFloat((val/60).toFixed(1)) : val;
      });

      return {
          tipo: 'grafico_linha',
          titulo: tituloSugerido || 'Evolução Temporal',
          dados_consulta: { labels: labelsFormatadas, valores, tipo_grafico: 'line' }
      };
  }

  gerarEstatisticas(aulas, criterios, agruparPor, metrica, tituloSugerido) {
      const contagem = {};
      let tituloGrafico = 'Distribuição';

      aulas.forEach(aula => {
          let chaves = [];
          if (agruparPor === 'turno') {
              const h = parseInt(aula.horarioSlotString.split(':')[0]);
              chaves = [h < 12 ? 'Manhã' : (h < 18 ? 'Tarde' : 'Noite')];
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
      
      // Ordenação
      if (agruparPor === 'dia_semana') {
          const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
          labels.sort((a, b) => dias.indexOf(a) - dias.indexOf(b));
      } else if (agruparPor === 'horario') {
          labels.sort();
      } else if (agruparPor !== 'mes') {
          labels.sort((a, b) => {
              const valA = metrica === 'duracao' ? contagem[a].minutos : contagem[a].qtd;
              const valB = metrica === 'duracao' ? contagem[b].minutos : contagem[b].qtd;
              return valB - valA;
          });
          labels = labels.slice(0, 12); // Top 12
      }

      const valores = labels.map(l => metrica === 'duracao' ? parseFloat((contagem[l].minutos/60).toFixed(1)) : contagem[l].qtd);
      if (metrica === 'duracao') tituloGrafico += " (Horas Totais)";

      return {
          tipo: 'grafico_estatisticas',
          titulo: tituloSugerido || tituloGrafico,
          dados_consulta: { labels, valores, tipo_grafico: (['turno', 'dia_semana'].includes(agruparPor)) ? 'pie' : 'bar' }
      };
  }

  // =========================================================================
  // CÁLCULOS ESPECIAIS (Hardcore)
  // =========================================================================

  analisarMediaDiaria(aulas, criterios) {
      if (aulas.length === 0) return { tipo: 'kpi_numero', valor: 0, descricao: 'Nenhuma aula' };
      const diasUnicos = new Set(aulas.map(a => dayjs(a.dataInicio.toDate()).format('YYYY-MM-DD'))).size;
      const media = aulas.length / (diasUnicos || 1);
      return {
          tipo: 'kpi_numero',
          titulo: 'Média de Aulas/Dia',
          valor: media.toFixed(1),
          descricao: `Baseado em ${diasUnicos} dias letivos`
      };
  }

  analisarTaxaOcupacao(aulas, criterios) {
      let diasUteis = 1;
      if (criterios.mes) diasUteis = 22;
      if (criterios.ano) diasUteis = 264;
      const numLabs = criterios.laboratorio ? 1 : LISTA_LABORATORIOS.length;
      const capacidade = diasUteis * 6 * numLabs;
      let taxa = (aulas.length / capacidade) * 100;
      if (taxa > 100) taxa = 100;

      return {
          tipo: 'kpi_numero',
          titulo: 'Taxa de Ocupação',
          valor: taxa.toFixed(1) + '%',
          descricao: `Estimativa (${aulas.length} aulas / ~${capacidade} slots)`
      };
  }

  analisarHorariosVagos(aulas, criterios) {
      if (!criterios.data || !criterios.laboratorio) return { tipo: 'aviso_acao', titulo: 'Filtro Necessário', mensagem: 'Informe DATA e LABORATÓRIO.' };
      const ocupados = aulas.map(a => a.horarioSlotString);
      const livres = TODOS_HORARIOS.filter(h => !ocupados.includes(h));
      return {
          tipo: 'tabela_aulas',
          titulo: `Horários Livres em ${criterios.data}`,
          dados_consulta: livres.map(h => ({ assunto: 'DISPONÍVEL', data: criterios.data, horario: h, laboratorio: criterios.laboratorio, cursos: ['-'] }))
      };
  }

  analisarOciosidade(aulas, criterios) {
      const todosLabs = LISTA_LABORATORIOS.map(l => l.name);
      const usados = new Set(aulas.map(a => a.laboratorioSelecionado));
      const vazios = todosLabs.filter(l => !usados.has(l));
      return {
          tipo: 'tabela_aulas',
          titulo: `Laboratórios Ociosos (Sem Uso)`,
          dados_consulta: vazios.map(l => ({ assunto: 'LIVRE', data: '-', horario: '-', laboratorio: l, cursos: ['Ocioso'] }))
      };
  }

  analisarDiasLotados(aulas, criterios) {
      const contagem = {};
      aulas.forEach(a => {
          const data = dayjs(a.dataInicio.toDate()).format('DD/MM/YYYY');
          contagem[data] = (contagem[data] || 0) + 1;
      });
      const dias = Object.entries(contagem)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([data, qtd]) => ({ assunto: `${qtd} aulas`, data, horario: 'Dia Todo', laboratorio: 'Vários', cursos: ['Pico de Demanda'] }));

      return { tipo: 'tabela_aulas', titulo: 'Dias com Maior Demanda', dados_consulta: dias };
  }

  // =========================================================================
  // UTILITÁRIOS
  // =========================================================================

  calcularDuracaoAula(slot) {
      if (!slot || !slot.includes('-')) return 0;
      try {
          const [i, f] = slot.split('-');
          const [h1, m1] = i.split(':').map(Number);
          const [h2, m2] = f.split(':').map(Number);
          return (h2*60 + m2) - (h1*60 + m1);
      } catch { return 0; }
  }

  calcularMinutosTotais(aulas) {
      return aulas.reduce((acc, a) => acc + this.calcularDuracaoAula(a.horarioSlotString), 0);
  }

  gerarDescricaoFiltro(criterios) {
      let p = [];
      if (criterios.cursos?.length) p.push(`Curso: ${criterios.cursos}`);
      if (criterios.laboratorio) p.push(`Lab: ${criterios.laboratorio}`);
      if (criterios.data) p.push(`Dia: ${criterios.data}`);
      if (criterios.mes) p.push(`Mês: ${criterios.mes}`);
      if (criterios.ano) p.push(`Ano: ${criterios.ano}`);
      return p.length ? p.join(' | ') : "Geral";
  }

  gerarTabelaAulas(aulas, criterios) {
      return {
          tipo: 'tabela_aulas',
          titulo: `Lista (${aulas.length})`,
          dados_consulta: aulas.slice(0, 50).map(a => ({
              assunto: a.assunto,
              data: dayjs(a.dataInicio.toDate()).format('DD/MM/YYYY'),
              horario: a.horarioSlotString,
              laboratorio: a.laboratorioSelecionado,
              cursos: a.cursos || []
          }))
      };
  }

  // =========================================================================
  // AÇÕES DE ESCRITA (ADICIONAR / EDITAR / EXCLUIR)
  // =========================================================================

  async adicionar(dados) {
      // 1. Validação Flexível
      if (!dados.data || !dados.assunto) {
          throw new Error('Dados incompletos. Preciso de Data e Assunto.');
      }
      
      const batch = writeBatch(db);
      
      // 2. Normalização Inteligente (Correção de erros da IA)
      // Garante que se a IA mandar "07:00", usamos "07:00-09:10"
      let labs = (dados.laboratorios && dados.laboratorios.length) ? dados.laboratorios : ['multidisciplinar_1'];
      let horarios = (dados.horarios && dados.horarios.length) ? dados.horarios : ['07:00-09:10'];

      horarios = horarios.map(h => {
          const match = TODOS_HORARIOS.find(slot => slot.startsWith(h.substring(0, 5)));
          return match || h;
      });

      // Busca Fuzzy no nome do lab (Ex: "Anatomia" -> "anatomia_1")
      labs = labs.map(l => {
          const match = LISTA_LABORATORIOS.find(labOficial => 
              labOficial.name.toLowerCase().includes(l.toLowerCase()) || 
              labOficial.tipo.toLowerCase().includes(l.toLowerCase())
          );
          return match ? match.name : l;
      });

      const dataISO = dayjs(dados.data, 'DD/MM/YYYY').format('YYYY-MM-DD');
      let count = 0;

      for (const lab of labs) {
          for (const h of horarios) {
              const ref = doc(collection(db, "aulas"));
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
                  propostoPorNome: this.currentUser?.displayName || 'IA'
              });
              count++;
          }
      }
      await batch.commit();
      
      // Notificação com Link
      this.notificar(dados, horarios, labs, 'adicionar', dataISO);
      
      return { 
          tipo: 'aviso_acao', 
          titulo: 'Agendamento Realizado', 
          mensagem: `${count} aula(s) de "${dados.assunto}" criada(s) para ${dados.data}.` 
      };
  }

  async editar(criterios, dadosNovos) {
      const aulas = await this.buscarAulas(criterios);
      if (aulas.length === 0) throw new Error('Nenhuma aula encontrada para editar.');
      // Edita apenas a primeira encontrada para segurança
      const aula = aulas[0];
      
      const updateData = { updatedAt: serverTimestamp() };
      if (dadosNovos.assunto) updateData.assunto = dadosNovos.assunto;
      if (dadosNovos.data) updateData.dataInicio = Timestamp.fromDate(dayjs(dadosNovos.data, 'DD/MM/YYYY').toDate());
      if (dadosNovos.horarios?.length) updateData.horarioSlotString = dadosNovos.horarios[0];
      if (dadosNovos.laboratorios?.length) updateData.laboratorioSelecionado = dadosNovos.laboratorios[0];
      if (dadosNovos.cursos) updateData.cursos = dadosNovos.cursos;

      await updateDoc(doc(db, "aulas", aula.id), updateData);
      
      const dataISO = dayjs(updateData.dataInicio ? updateData.dataInicio.toDate() : aula.dataInicio.toDate()).format('YYYY-MM-DD');
      this.notificar({...aula, ...updateData}, [updateData.horarioSlotString || aula.horarioSlotString], [updateData.laboratorioSelecionado || aula.laboratorioSelecionado], 'editar', dataISO);
      
      return { tipo: 'aviso_acao', titulo: 'Sucesso', mensagem: 'Aula editada com sucesso.' };
  }

  async excluir(criterios) {
      const aulas = await this.buscarAulas(criterios);
      if (aulas.length === 0) throw new Error('Nenhuma aula encontrada para excluir.');
      
      const batch = writeBatch(db);
      aulas.forEach(a => batch.delete(doc(db, "aulas", a.id)));
      await batch.commit();
      
      if (aulas.length === 1) {
          this.notificar(aulas[0], [aulas[0].horarioSlotString], [aulas[0].laboratorioSelecionado], 'excluir', null);
      }
      
      return { tipo: 'aviso_acao', titulo: 'Sucesso', mensagem: `${aulas.length} aula(s) excluída(s).` };
  }

  async notificar(dados, horarios, laboratorios, tipo, dataISO) {
      try {
        const ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;
        if (ID) {
            await notificadorTelegram.enviarNotificacao(ID, {
                assunto: dados.assunto,
                data: dados.data || (dados.dataInicio ? dayjs(dados.dataInicio.toDate()).format('DD/MM/YYYY') : 'N/A'),
                dataISO: dataISO,
                horario: Array.isArray(horarios) ? horarios.join(', ') : horarios,
                laboratorio: Array.isArray(laboratorios) ? laboratorios.join(', ') : laboratorios,
                cursos: dados.cursos || [],
                observacoes: dados.observacoes
            }, tipo);
        }
      } catch (e) { console.error(e); }
  }
}

export default ExecutorAcoes;