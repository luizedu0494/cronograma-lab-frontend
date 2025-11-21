/**
 * ExecutorAcoes.js
 * 
 * Executa ações no Firebase (consultar, adicionar, editar, excluir aulas)
 * e retorna dados estruturados para visualização.
 */

import { db } from '../firebaseConfig';
import {
  collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc,
  query, where, getDocs, Timestamp, writeBatch
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { notificadorTelegram } from './NotificadorTelegram';

dayjs.locale('pt-br');

class ExecutorAcoes {
  constructor(currentUser) {
    this.currentUser = currentUser;
  }

  /**
   * Executa a ação especificada
   * @param {Object} dadosProcessados - Dados processados pelo ProcessadorConsultas
   * @returns {Promise<Object>} - Resultado estruturado para visualização
   */
  async executar(dadosProcessados) {
    const { acao, criterios_busca, dados_novos } = dadosProcessados;

    try {
      switch (acao) {
        case 'consultar':
          return await this.consultar(criterios_busca, dadosProcessados.tipo_visual);
        
        case 'adicionar':
          return await this.adicionar(dados_novos);
        
        case 'editar':
          return await this.editar(criterios_busca, dados_novos);
        
        case 'excluir':
          return await this.excluir(criterios_busca);
        
        default:
          throw new Error(`Ação desconhecida: ${acao}`);
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      throw error;
    }
  }

  /**
   * Consulta aulas no Firebase
   * @param {Object} criterios - Critérios de busca
   * @param {string} tipoVisual - Tipo de visualização desejado
   * @returns {Promise<Object>} - Resultado estruturado
   */
  async consultar(criterios, tipoVisual) {
    const aulas = await this.buscarAulas(criterios);

    // Se o tipo visual for card_resumo, retorna estatísticas
    if (tipoVisual === 'card_resumo') {
      return this.gerarResumo(aulas, criterios);
    }

    // Se for grafico_estatisticas, retorna dados para gráfico
    if (tipoVisual === 'grafico_estatisticas') {
      return this.gerarEstatisticas(aulas, criterios);
    }

    // Padrão: retorna tabela de aulas
    return this.gerarTabelaAulas(aulas, criterios);
  }

  /**
   * Busca aulas no Firebase com base nos critérios
   * @param {Object} criterios - Critérios de busca
   * @returns {Promise<Array>} - Lista de aulas encontradas
   */
  async buscarAulas(criterios) {
    try {
      let q = collection(db, "aulas");
      const constraints = [];

      // Filtro por data
      if (criterios.data) {
        const dataInicio = dayjs(criterios.data, 'DD/MM/YYYY').startOf('day');
        const dataFim = dataInicio.endOf('day');
        constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
        constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
      } 
      // Filtro por mês
      else if (criterios.mes) {
        const [mes, ano] = criterios.mes.split('/');
        const dataInicio = dayjs().month(parseInt(mes) - 1).year(parseInt(ano)).startOf('month');
        const dataFim = dataInicio.endOf('month');
        constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
        constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
      } 
      // Filtro por ano
      else if (criterios.ano) {
        const dataInicio = dayjs().year(parseInt(criterios.ano)).startOf('year');
        const dataFim = dataInicio.endOf('year');
        constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
        constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
      }

      // Filtro por laboratório
      if (criterios.laboratorios && criterios.laboratorios.length > 0) {
        constraints.push(where("laboratorioSelecionado", "in", criterios.laboratorios.slice(0, 10)));
      }

      // Aplica constraints se houver
      if (constraints.length > 0) {
        q = query(q, ...constraints);
      } else if (!criterios.termoBusca && !criterios.assunto) {
        // Se não há critérios, retorna vazio para evitar buscar tudo
        return [];
      }

      const querySnapshot = await getDocs(q);
      let aulas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filtros locais (não suportados diretamente pelo Firebase)
      
      // Filtro por termo de busca
      if (criterios.termoBusca) {
        const termo = criterios.termoBusca.toLowerCase();
        aulas = aulas.filter(aula => 
          (aula.assunto && aula.assunto.toLowerCase().includes(termo)) ||
          (aula.tipoAtividade && aula.tipoAtividade.toLowerCase().includes(termo)) ||
          (aula.observacoes && aula.observacoes.toLowerCase().includes(termo))
        );
      }

      // Filtro por assunto
      if (criterios.assunto) {
        const assunto = criterios.assunto.toLowerCase();
        aulas = aulas.filter(aula => 
          aula.assunto && aula.assunto.toLowerCase().includes(assunto)
        );
      }

      // Filtro por cursos
      if (criterios.cursos && criterios.cursos.length > 0) {
        aulas = aulas.filter(aula => 
          aula.cursos && aula.cursos.some(curso => 
            criterios.cursos.some(c => curso.toLowerCase().includes(c.toLowerCase()))
          )
        );
      }

      // Filtro por horários
      if (criterios.horarios && criterios.horarios.length > 0) {
        aulas = aulas.filter(aula => 
          criterios.horarios.includes(aula.horarioSlotString)
        );
      }

      return aulas;
    } catch (error) {
      console.error('Erro ao buscar aulas:', error);
      return [];
    }
  }

  /**
   * Gera resumo estatístico das aulas
   * @param {Array} aulas - Lista de aulas
   * @param {Object} criterios - Critérios da consulta
   * @returns {Object} - Dados para card_resumo
   */
  gerarResumo(aulas, criterios) {
    const totalAulas = aulas.length;
    
    // Próxima aula (ordenada por data)
    const aulasOrdenadas = aulas
      .filter(aula => aula.dataInicio)
      .sort((a, b) => a.dataInicio.toDate() - b.dataInicio.toDate());
    
    const proximaAula = aulasOrdenadas.length > 0 
      ? aulasOrdenadas[0]
      : null;

    // Laboratório mais usado
    const contagemLabs = {};
    aulas.forEach(aula => {
      if (aula.laboratorioSelecionado) {
        contagemLabs[aula.laboratorioSelecionado] = (contagemLabs[aula.laboratorioSelecionado] || 0) + 1;
      }
    });

    const labMaisUsado = Object.entries(contagemLabs)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      tipo: 'card_resumo',
      titulo: this.gerarTituloResumo(criterios),
      dados_consulta: {
        total_aulas: totalAulas,
        proxima_aula: proximaAula 
          ? `${proximaAula.assunto} - ${dayjs(proximaAula.dataInicio.toDate()).format('DD/MM/YYYY')} às ${proximaAula.horarioSlotString?.split('-')[0] || 'N/A'}`
          : 'Nenhuma aula agendada',
        laboratorio_mais_usado: labMaisUsado
      }
    };
  }

  /**
   * Gera dados para tabela de aulas
   * @param {Array} aulas - Lista de aulas
   * @param {Object} criterios - Critérios da consulta
   * @returns {Object} - Dados para tabela_aulas
   */
  gerarTabelaAulas(aulas, criterios) {
    const dadosTabela = aulas.map(aula => ({
      id: aula.id,
      assunto: aula.assunto || 'Sem assunto',
      data: aula.dataInicio ? dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY') : 'N/A',
      horario: aula.horarioSlotString || 'N/A',
      laboratorio: aula.laboratorioSelecionado || 'N/A',
      cursos: aula.cursos || []
    }));

    return {
      tipo: 'tabela_aulas',
      titulo: this.gerarTituloTabela(criterios, aulas.length),
      dados_consulta: dadosTabela
    };
  }

  /**
   * Gera dados para gráfico de estatísticas
   * @param {Array} aulas - Lista de aulas
   * @param {Object} criterios - Critérios da consulta
   * @returns {Object} - Dados para grafico_estatisticas
   */
  gerarEstatisticas(aulas, criterios) {
    // Agrupa aulas por mês
    const aulasPorMes = {};
    aulas.forEach(aula => {
      if (aula.dataInicio) {
        const mes = dayjs(aula.dataInicio.toDate()).format('MMM/YY');
        aulasPorMes[mes] = (aulasPorMes[mes] || 0) + 1;
      }
    });

    const labels = Object.keys(aulasPorMes).sort();
    const valores = labels.map(label => aulasPorMes[label]);

    return {
      tipo: 'grafico_estatisticas',
      titulo: 'Distribuição de Aulas',
      dados_consulta: {
        labels,
        valores,
        tipo_grafico: 'bar'
      }
    };
  }

  /**
   * Adiciona nova aula no Firebase
   * @param {Object} dados - Dados da nova aula
   * @returns {Promise<Object>} - Resultado da operação
   */
  async adicionar(dados) {
    // Validação básica
    if (!dados.data || !dados.assunto) {
      throw new Error('Data e assunto são obrigatórios para adicionar aula.');
    }

    // Verifica conflitos
    const conflitos = await this.verificarConflitos(
      dados.data,
      dados.horarios || [],
      dados.laboratorios || []
    );

    if (conflitos.length > 0) {
      const listaConflitos = conflitos.map(c => 
        `${c.laboratorio} às ${c.horario}: ${c.aula.assunto}`
      ).join(', ');
      throw new Error(`Conflito detectado: ${listaConflitos}`);
    }

    // Adiciona aula(s) no Firebase
    const batch = writeBatch(db);
    const aulasAdicionadas = [];

    const cursos = dados.cursos || [];
    const laboratorios = dados.laboratorios || ['multidisciplinar_1'];
    const horarios = dados.horarios || ['07:00-09:10'];

    for (const lab of laboratorios) {
      for (const horario of horarios) {
        const aulaRef = doc(collection(db, "aulas"));
        const dadosAula = {
          assunto: dados.assunto,
          tipoAtividade: 'Aula Prática',
          laboratorioSelecionado: lab,
          horarioSlotString: horario,
          dataInicio: Timestamp.fromDate(dayjs(dados.data, 'DD/MM/YYYY').toDate()),
          cursos: cursos,
          observacoes: dados.observacoes || '',
          status: 'aprovada',
          createdAt: serverTimestamp(),
          propostoPorUid: this.currentUser?.uid || 'sistema',
          propostoPorNome: this.currentUser?.displayName || 'Assistente IA'
        };

        batch.set(aulaRef, dadosAula);
        aulasAdicionadas.push({ lab, horario });
      }
    }

    await batch.commit();

    // Enviar notificação Telegram para todos os usuários
    try {
      const chatIds = await this.buscarTodosChatIds();
      console.log('DEBUG TELEGRAM: Chat IDs encontrados para notificação:', chatIds);
      if (chatIds.length > 0) {
        const dadosNotificacao = {
          assunto: dados.assunto,
          data: dados.data,
          horario: horarios.join(', '),
          laboratorio: laboratorios.join(', '),
          cursos: cursos,
          observacoes: dados.observacoes
        };
        await notificadorTelegram.enviarParaMultiplos(chatIds, dadosNotificacao, 'adicionar');
      }
    } catch (erro) {
      console.warn('Erro ao enviar notificação Telegram para múltiplos usuários:', erro);
      // Não falha a operação se notificação não for enviada
    }

    return {
      tipo: 'confirmacao_acao',
      acao: 'adicionar',
      status: 'sucesso',
      mensagem: `${aulasAdicionadas.length} aula(s) adicionada(s) com sucesso!`,
      dados_afetados: {
        total_aulas_adicionadas: aulasAdicionadas.length,
        assunto: dados.assunto,
        data: dados.data,
        detalhes: aulasAdicionadas
      }
    };
  }

  /**
   * Edita aula existente
   * @param {Object} criterios - Critérios para encontrar a aula
   * @param {Object} dadosNovos - Novos dados
   * @returns {Promise<Object>} - Resultado da operação
   */
  async editar(criterios, dadosNovos) {
    // Busca aula(s) para editar
    const aulas = await this.buscarAulas(criterios);

    if (aulas.length === 0) {
      throw new Error('Nenhuma aula encontrada com os critérios fornecidos.');
    }

    if (aulas.length > 1) {
      throw new Error(`${aulas.length} aulas encontradas. Por favor, seja mais específico (use data e assunto).`);
    }

    const aula = aulas[0];

    // Verifica conflitos se estiver mudando data/horário/laboratório
    if (dadosNovos.data || dadosNovos.horarios || dadosNovos.laboratorios) {
      const data = dadosNovos.data || dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY');
      const horarios = dadosNovos.horarios || [aula.horarioSlotString];
      const laboratorios = dadosNovos.laboratorios || [aula.laboratorioSelecionado];

      const conflitos = await this.verificarConflitos(data, horarios, laboratorios, aula.id);

      if (conflitos.length > 0) {
        const listaConflitos = conflitos.map(c => 
          `${c.laboratorio} às ${c.horario}`
        ).join(', ');
        throw new Error(`Conflito detectado: ${listaConflitos}`);
      }
    }

    // Atualiza aula
    const dadosAtualizados = {
      updatedAt: serverTimestamp()
    };

    if (dadosNovos.assunto) dadosAtualizados.assunto = dadosNovos.assunto;
    if (dadosNovos.data) dadosAtualizados.dataInicio = Timestamp.fromDate(dayjs(dadosNovos.data, 'DD/MM/YYYY').toDate());
    if (dadosNovos.horarios && dadosNovos.horarios.length > 0) dadosAtualizados.horarioSlotString = dadosNovos.horarios[0];
    if (dadosNovos.laboratorios && dadosNovos.laboratorios.length > 0) dadosAtualizados.laboratorioSelecionado = dadosNovos.laboratorios[0];
    if (dadosNovos.cursos) dadosAtualizados.cursos = dadosNovos.cursos;
    if (dadosNovos.observacoes) dadosAtualizados.observacoes = dadosNovos.observacoes;

    await updateDoc(doc(db, "aulas", aula.id), dadosAtualizados);

    // Enviar notificação Telegram para todos os usuários
    try {
      const chatIds = await this.buscarTodosChatIds();
      console.log('DEBUG TELEGRAM: Chat IDs encontrados para notificação:', chatIds);
      if (chatIds.length > 0) {
        const dadosNotificacao = {
          assunto: dadosAtualizados.assunto || aula.assunto,
          data: dadosAtualizados.dataInicio 
            ? dayjs(dadosAtualizados.dataInicio.toDate()).format('DD/MM/YYYY')
            : dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY'),
          horario: dadosAtualizados.horarioSlotString || aula.horarioSlotString,
          laboratorio: dadosAtualizados.laboratorioSelecionado || aula.laboratorioSelecionado,
          cursos: dadosAtualizados.cursos || aula.cursos,
          observacoes: dadosAtualizados.observacoes || aula.observacoes
        };
        await notificadorTelegram.enviarParaMultiplos(chatIds, dadosNotificacao, 'editar');
      }
    } catch (erro) {
      console.warn('Erro ao enviar notificação Telegram para múltiplos usuários:', erro);
    }

    return {
      tipo: 'confirmacao_acao',
      acao: 'editar',
      status: 'sucesso',
      mensagem: 'Aula editada com sucesso!',
      dados_afetados: {
        aula_id: aula.id,
        assunto: aula.assunto,
        alteracoes: Object.keys(dadosNovos)
      }
    };
  }

  /**
   * Exclui aula
   * @param {Object} criterios - Critérios para encontrar a aula
   * @returns {Promise<Object>} - Resultado da operação
   */
  async excluir(criterios) {
    // Busca aula(s) para excluir
    const aulas = await this.buscarAulas(criterios);

    if (aulas.length === 0) {
      throw new Error('Nenhuma aula encontrada com os critérios fornecidos.');
    }

    if (aulas.length > 1) {
      throw new Error(`${aulas.length} aulas encontradas. Por favor, seja mais específico.`);
    }

    const aula = aulas[0];

    // Exclui aula
    await deleteDoc(doc(db, "aulas", aula.id));

    // Enviar notificação Telegram para todos os usuários
    try {
      const chatIds = await this.buscarTodosChatIds();
      console.log('DEBUG TELEGRAM: Chat IDs encontrados para notificação:', chatIds);
      if (chatIds.length > 0) {
        const dadosNotificacao = {
          assunto: aula.assunto,
          data: dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY'),
          horario: aula.horarioSlotString,
          laboratorio: aula.laboratorioSelecionado,
          cursos: aula.cursos,
          observacoes: aula.observacoes
        };
        await notificadorTelegram.enviarParaMultiplos(chatIds, dadosNotificacao, 'excluir');
      }
    } catch (erro) {
      console.warn('Erro ao enviar notificação Telegram para múltiplos usuários:', erro);
    }

    return {
      tipo: 'confirmacao_acao',
      acao: 'excluir',
      status: 'sucesso',
      mensagem: 'Aula excluída com sucesso!',
      dados_afetados: {
        aula_id: aula.id,
        assunto: aula.assunto,
        data: dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY')
      }
    };
  }

  /**
   * Busca todos os Chat IDs do Telegram dos usuários
   * @returns {Promise<Array<string>>} - Lista de Chat IDs válidos
   */
  async buscarTodosChatIds() {
    try {
      const q = query(collection(db, "users"), where("telegramChatId", "!=", null));
      const querySnapshot = await getDocs(q);
      const chatIds = querySnapshot.docs
        .map(doc => doc.data().telegramChatId)
        .filter(chatId => chatId && typeof chatId === 'string'); // Filtra nulos e garante que é string
      return chatIds;
    } catch (error) {
      console.error('Erro ao buscar todos os Chat IDs do Telegram:', error);
      return [];
    }
  }

  /**
   * Verifica conflitos de horário
   * @param {string} data - Data no formato DD/MM/YYYY
   * @param {Array} horarios - Lista de horários
   * @param {Array} laboratorios - Lista de laboratórios
   * @param {string} aulaIdExcluir - ID da aula a excluir da verificação
   * @returns {Promise<Array>} - Lista de conflitos
   */
  async verificarConflitos(data, horarios, laboratorios, aulaIdExcluir = null) {
    const conflitos = [];
    const dataAula = dayjs(data, 'DD/MM/YYYY');

    for (const lab of laboratorios) {
      for (const horario of horarios) {
        const q = query(
          collection(db, "aulas"),
          where("laboratorioSelecionado", "==", lab),
          where("horarioSlotString", "==", horario),
          where("dataInicio", ">=", Timestamp.fromDate(dataAula.startOf('day').toDate())),
          where("dataInicio", "<=", Timestamp.fromDate(dataAula.endOf('day').toDate()))
        );

        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach(docSnap => {
          if (docSnap.id !== aulaIdExcluir) {
            conflitos.push({
              laboratorio: lab,
              horario: horario,
              aula: { id: docSnap.id, ...docSnap.data() }
            });
          }
        });
      }
    }

    return conflitos;
  }

  /**
   * Gera título para o resumo
   * @param {Object} criterios - Critérios da consulta
   * @returns {string}
   */
  gerarTituloResumo(criterios) {
    if (criterios.data) return `Resumo - ${criterios.data}`;
    if (criterios.mes) return `Resumo - ${criterios.mes}`;
    if (criterios.ano) return `Resumo - ${criterios.ano}`;
    return 'Resumo Geral';
  }

  /**
   * Gera título para a tabela
   * @param {Object} criterios - Critérios da consulta
   * @param {number} total - Total de aulas encontradas
   * @returns {string}
   */
  gerarTituloTabela(criterios, total) {
    const partes = [`${total} aula(s) encontrada(s)`];
    
    if (criterios.termoBusca) partes.push(`"${criterios.termoBusca}"`);
    if (criterios.assunto) partes.push(`"${criterios.assunto}"`);
    if (criterios.data) partes.push(criterios.data);
    if (criterios.mes) partes.push(criterios.mes);
    if (criterios.cursos && criterios.cursos.length > 0) partes.push(criterios.cursos.join(', '));

    return partes.join(' - ');
  }
}

export default ExecutorAcoes;
