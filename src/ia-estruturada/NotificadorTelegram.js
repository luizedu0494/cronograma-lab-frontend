import { LISTA_LABORATORIOS } from '../constants/laboratorios';

class NotificadorTelegram {
  constructor() {
    this.botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
    this.apiUrl = 'https://api.telegram.org';

    // CONFIGURAÇÃO DOS IDs DOS TÓPICOS
    // Certifique-se que o ID 5 (Química) existe no seu grupo, pois ele não apareceu no JSON anterior.
    this.idsDosTopicos = {
      ANATOMIA: 2,
      HABILIDADES: 3,       // Verifique se é 3 mesmo
      TECNICA_DIETETICA: 4,
      QUIMICA: 5,           // Verifique se é 5 mesmo
      PATOLOGIA: 6
    };
  }

  /**
   * Retorna uma LISTA (Array) de IDs de tópicos para onde a mensagem deve ir.
   */
  obterIdsDosTopicos(dadosLab) {
    // Se for 'Todos' ou vazio, retorna lista vazia (vai pro Geral)
    if (!dadosLab || dadosLab === 'Todos') return [];

    const labParaVerificar = Array.isArray(dadosLab) ? dadosLab[0] : dadosLab;
    
    // Busca na lista oficial para saber o tipo
    const infoLab = LISTA_LABORATORIOS.find(l => l.name === labParaVerificar || l.id === labParaVerificar);
    
    if (!infoLab) return []; // Manda no Geral

    const tipo = infoLab.tipo;

    // --- REGRAS DE DIRECIONAMENTO (Agora retornam Arrays) ---

    // 1. ANATOMIA
    if (tipo === 'anatomia') {
        return [this.idsDosTopicos.ANATOMIA];
    }

    // 2. HABILIDADES e UDA
    if (tipo.startsWith('habilidade_') || tipo === 'uda') {
        return [this.idsDosTopicos.HABILIDADES];
    }

    // 3. TÉCNICA DIETÉTICA
    if (tipo === 'tecdietetica') {
        return [this.idsDosTopicos.TECNICA_DIETETICA];
    }

    // 4. MICROSCÓPIAS (Somente Patologia)
    // Correção: Antes estava indo para Química
    if (tipo === 'microscopia_normal' || tipo === 'microscopia_galeria') {
        return [this.idsDosTopicos.PATOLOGIA];
    }

    // 5. MULTIDISCIPLINAR e FARMACÊUTICO (Compartilhados)
    // Manda para QUÍMICA **E** PATOLOGIA
    if (tipo === 'multidisciplinar' || tipo === 'farmaceutico') {
        return [this.idsDosTopicos.QUIMICA, this.idsDosTopicos.PATOLOGIA];
    }

    return []; // Geral
  }

  async enviarNotificacao(chatId, dados, tipoNotificacao) {
    if (!this.botToken || !chatId) return false;

    try {
      const mensagem = this.gerarMensagemTexto(dados, tipoNotificacao);
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;

      // Define os tópicos de destino (pode ser 1, 2 ou nenhum)
      // Se for evento, ignora tópicos e manda vazio (Geral)
      const listaDeTopicos = tipoNotificacao.startsWith('evento_') 
        ? [] 
        : this.obterIdsDosTopicos(dados.laboratorio);

      // Função auxiliar para fazer o fetch
      const enviarParaTopico = async (threadId) => {
        const payload = {
            chat_id: chatId,
            text: mensagem,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
        };
        if (threadId) payload.message_thread_id = threadId;

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
      };

      // Se a lista de tópicos estiver vazia, manda uma vez para o Geral (threadId = null)
      if (listaDeTopicos.length === 0) {
          await enviarParaTopico(null);
      } else {
          // Se tiver tópicos (ex: Química e Patologia), manda uma mensagem para cada um
          for (const idTopico of listaDeTopicos) {
              if (idTopico) await enviarParaTopico(idTopico);
          }
      }

      return true;
    } catch (error) {
      console.error('Erro Telegram:', error);
      return false;
    }
  }

  gerarMensagemTexto(dados, tipo) {
    if (tipo.startsWith('evento_')) return this.gerarMensagemEvento(dados, tipo);

    const dataFormatada = dados.data || 'Data n/a';
    const horario = Array.isArray(dados.horario) ? dados.horario.join(', ') : (dados.horario || 'Horário n/a');
    const laboratorio = dados.laboratorio || 'Lab n/a';
    const assunto = dados.assunto || 'Sem assunto';
    
    let cursos = 'Cursos n/a';
    if (Array.isArray(dados.cursos)) cursos = dados.cursos.join(', ');
    else if (dados.cursos) cursos = dados.cursos;

    let textoLink = '';
    if (tipo !== 'excluir') {
        const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const complemento = dados.dataISO ? `?date=${dados.dataISO}` : '';
        const linkFinal = `${baseUrl}/calendario${complemento}`;
        textoLink = `\n🔗 <b>Ver no Cronograma:</b>\n${linkFinal}`;
    }

    let titulo = '';
    let emoji = '';

    switch (tipo) {
      case 'adicionar': titulo = 'NOVA AULA ADICIONADA'; emoji = '✅'; break;
      case 'editar': titulo = 'AULA EDITADA'; emoji = '✏️'; break;
      case 'excluir': titulo = 'AULA EXCLUÍDA'; emoji = '🗑️'; break;
      default: titulo = 'NOTIFICAÇÃO'; emoji = '📢';
    }

    return `
${emoji} <b>${titulo}</b>

📖 <b>Assunto:</b> ${assunto}
📅 <b>Data:</b> ${dataFormatada}
🕐 <b>Horário:</b> ${horario}
🏢 <b>Laboratório:</b> ${laboratorio}
👥 <b>Cursos:</b> ${cursos}

${dados.observacoes ? `📝 <b>Obs:</b> ${dados.observacoes}\n` : ''}
${textoLink}
    `.trim();
  }

  gerarMensagemEvento(dados, tipo) {
    const tituloEvento = dados.titulo || 'Sem título';
    const tipoEvento = dados.tipoEvento || 'Evento';
    const laboratorio = dados.laboratorio === 'Todos' ? 'Todos os Laboratórios' : (dados.laboratorio || 'N/A');
    const dataInicio = dados.dataInicio || 'N/A';
    const dataFim = dados.dataFim || 'N/A';
    
    let acao = '';
    let emoji = '📅';

    if (tipo === 'evento_adicionar') { acao = 'NOVO EVENTO CADASTRADO'; emoji = '🆕'; }
    else if (tipo === 'evento_editar') { acao = 'EVENTO ATUALIZADO'; emoji = '🔄'; }
    else if (tipo === 'evento_excluir') { acao = 'EVENTO REMOVIDO'; emoji = '❌'; }

    let textoLink = '';
    if (tipo !== 'evento_excluir') {
        const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const linkFinal = `${baseUrl}/calendario`;
        textoLink = `\n🔗 <b>Ver no Cronograma:</b>\n${linkFinal}`;
    }

    return `
${emoji} <b>${acao}</b>

📌 <b>Título:</b> ${tituloEvento}
🏷️ <b>Tipo:</b> ${tipoEvento}
🏢 <b>Local:</b> ${laboratorio}
📅 <b>Início:</b> ${dataInicio}
📅 <b>Fim:</b> ${dataFim}

${dados.descricao ? `📝 <b>Descrição:</b> ${dados.descricao}\n` : ''}
${textoLink}
    `.trim();
  }

  async enviarParaMultiplos(chatIds, dados, tipo) {
    if (!Array.isArray(chatIds) || chatIds.length === 0) return { sucesso: 0, falha: 0 };
    const resultados = await Promise.all(chatIds.map(id => this.enviarNotificacao(id, dados, tipo)));
    return { sucesso: resultados.filter(r => r).length, falha: resultados.filter(r => !r).length };
  }
}

export const notificadorTelegram = new NotificadorTelegram();
export default NotificadorTelegram;