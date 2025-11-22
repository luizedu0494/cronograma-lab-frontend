import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

class ExecutorAcoes {
  constructor(currentUser) {
    this.currentUser = currentUser;
  }

  async executar(dadosProcessados) {
    const { acao, criterios_busca, tipo_visual } = dadosProcessados;

    if (acao === 'consultar') {
      return await this.consultar(criterios_busca, tipo_visual);
    }
    
    // Retorna o objeto para o front-end lidar com ações de escrita
    return { ...dadosProcessados, status: 'aguardando_confirmacao' };
  }

  async consultar(criterios, tipoVisual) {
    const aulas = await this.buscarAulas(criterios);

    // Se a IA pediu um Número Gigante (KPI)
    if (tipoVisual === 'kpi_numero') {
      return {
        tipo: 'kpi_numero',
        titulo: 'Total Encontrado',
        valor: aulas.length,
        descricao: this.gerarDescricaoFiltro(criterios)
      };
    }

    // Se pediu Tabela
    if (tipoVisual === 'tabela_aulas') {
        return this.gerarTabelaAulas(aulas, criterios);
    }

    // Padrão: Resumo
    return this.gerarResumo(aulas, criterios);
  }

  async buscarAulas(criterios) {
    try {
      let q = collection(db, "aulas");
      const constraints = [];

      // 1. Filtros de Data (Firebase)
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

      // 2. Filtro de Laboratório
      if (criterios.laboratorio) {
         constraints.push(where("laboratorioSelecionado", "==", criterios.laboratorio));
      }

      // Executa query inicial
      if (constraints.length > 0) {
        q = query(q, ...constraints);
      }

      const snapshot = await getDocs(q);
      let aulas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // 3. Filtros Avançados (JavaScript)
      
      // Filtro de Curso (Robusto)
      if (criterios.cursos && criterios.cursos.length > 0) {
        const cursosBusca = criterios.cursos.map(c => c.toLowerCase());
        
        aulas = aulas.filter(aula => {
            // Garante que aula.cursos seja um array e normaliza
            const cursosAula = Array.isArray(aula.cursos) ? aula.cursos : [];
            // Verifica se algum curso da aula contém algum curso da busca
            return cursosAula.some(c => 
                cursosBusca.some(cb => c.toLowerCase().includes(cb))
            );
        });
      }

      // Filtro de Termo (Busca no Assunto)
      if (criterios.termoBusca) {
          const termo = criterios.termoBusca.toLowerCase();
          aulas = aulas.filter(a => 
              (a.assunto && a.assunto.toLowerCase().includes(termo)) ||
              (a.observacoes && a.observacoes.toLowerCase().includes(termo))
          );
      }

      return aulas;

    } catch (e) {
      console.error("Erro na busca:", e);
      return [];
    }
  }

  gerarDescricaoFiltro(criterios) {
      let desc = "";
      if (criterios.cursos?.length) desc += ` de ${criterios.cursos.join(', ')}`;
      if (criterios.data) desc += ` em ${criterios.data}`;
      if (criterios.mes) desc += ` em ${criterios.mes}`;
      if (criterios.ano) desc += ` em ${criterios.ano}`;
      return desc || "Geral";
  }

  gerarTabelaAulas(aulas, criterios) {
      return {
          tipo: 'tabela_aulas',
          titulo: `Encontrei ${aulas.length} aulas`,
          dados_consulta: aulas.map(a => ({
              assunto: a.assunto,
              data: dayjs(a.dataInicio.toDate()).format('DD/MM/YYYY'),
              horario: a.horarioSlotString,
              laboratorio: a.laboratorioSelecionado,
              cursos: a.cursos || []
          }))
      };
  }

  gerarResumo(aulas, criterios) {
      // Se a contagem for 0, retorna vazio
      if (aulas.length === 0) return { tipo: 'kpi_numero', valor: 0, descricao: 'Nenhuma aula encontrada' };

      return {
          tipo: 'kpi_numero', // Usa o KPI como padrão para resumos simples
          valor: aulas.length,
          descricao: `Aulas encontradas${this.gerarDescricaoFiltro(criterios)}`
      };
  }
}

export default ExecutorAcoes;