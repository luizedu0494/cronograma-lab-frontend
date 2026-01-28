import { LISTA_LABORATORIOS } from '../constants/laboratorios';

class NotificadorTelegram {
  constructor() {
    this.botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    this.apiUrl = 'https://api.telegram.org';

    // CONFIGURAÇÃO DOS IDs DOS TÓPICOS
    // Certifique-se que estes IDs existem no seu grupo
    this.idsDosTopicos = {
      ANATOMIA: 2,
      HABILIDADES: 3,      
      TECNICA_DIETETICA: 4,
      QUIMICA: 5,          
      PATOLOGIA: 6
    };
  }

  // --- FUNÇÃO DE SEGURANÇA PARA EVITAR ERRO 400 ---
  escaparHtml(texto) {
    if (!texto) return '';
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  obterIdsDosTopicos(dadosLab) {
    if (!dadosLab || dadosLab === 'Todos') return [];

    const labParaVerificar = Array.isArray(dadosLab) ? dadosLab[0] : dadosLab;
    const infoLab = LISTA_LABORATORIOS.find(l => l.name === labParaVerificar || l.id === labParaVerificar);
    
    if (!infoLab) {
        console.warn(`⚠️ [Notificador] Lab "${labParaVerificar}" não mapeado. Enviando para Geral.`);
        return [];
    }

    const tipo = infoLab.tipo;

    if (tipo === 'anatomia') return [this.idsDosTopicos.ANATOMIA];
    if (tipo.startsWith('habilidade_') || tipo === 'uda') return [this.idsDosTopicos.HABILIDADES];
    if (tipo === 'tecdietetica') return [this.idsDosTopicos.TECNICA_DIETETICA];
    if (tipo === 'microscopia_normal' || tipo === 'microscopia_galeria') return [this.idsDosTopicos.PATOLOGIA];
    if (tipo === 'multidisciplinar' || tipo === 'farmaceutico') {
        return [this.idsDosTopicos.QUIMICA, this.idsDosTopicos.PATOLOGIA];
    }

    return []; 
  }

  async enviarNotificacao(chatId, dados, tipoNotificacao) {
    if (!this.botToken) {
        console.error('❌ ERRO: Token do Bot não encontrado no .env');
        return false;
    }
    if (!chatId) {
        console.error('❌ ERRO: Chat ID não fornecido.');
        return false;
    }

    try {
      const mensagem = this.gerarMensagemTexto(dados, tipoNotificacao);
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;

      const listaDeTopicos = tipoNotificacao.startsWith('evento_') 
        ? [] 
        : this.obterIdsDosTopicos(dados.laboratorio);

      const enviarParaTopico = async (threadId) => {
        const payload = {
            chat_id: chatId,
            text: mensagem,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
        };
        // Só adiciona o ID se for um número válido
        if (threadId) payload.message_thread_id = threadId;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        
        if (!resData.ok) {
            // LOG DETALHADO DO ERRO PARA VOCÊ VER NO CONSOLE
            console.error(`❌ Erro Telegram (Tópico ${threadId || 'Geral'}):`, resData.description);
        } else {
            console.log(`✅ Sucesso (Tópico ${threadId || 'Geral'})!`);
        }
        return resData.ok;
      };

      if (listaDeTopicos.length === 0) {
          await enviarParaTopico(null);
      } else {
          for (const idTopico of listaDeTopicos) {
            if (idTopico) await enviarParaTopico(idTopico);
          }
      }
      return true;
    } catch (error) {
      console.error('❌ Erro de Rede:', error);
      return false;
    }
  }

  gerarMensagemTexto(dados, tipo) {
    if (tipo.startsWith('evento_')) return this.gerarMensagemEvento(dados, tipo);

    // ESCAPAMOS TUDO QUE VEM DO USUÁRIO
    const assunto = this.escaparHtml(dados.assunto || 'Sem assunto');
    const laboratorio = this.escaparHtml(dados.laboratorio || 'Lab n/a');
    const dataFormatada = this.escaparHtml(dados.data || 'Data n/a');
    const obs = this.escaparHtml(dados.observacoes || '');
    
    let horario = 'Horário n/a';
    if (Array.isArray(dados.horario)) horario = dados.horario.join(', ');
    else if (dados.horario) horario = dados.horario;

    let cursos = 'Cursos n/a';
    if (Array.isArray(dados.cursos)) cursos = dados.cursos.join(', ');
    else if (dados.cursos) cursos = dados.cursos;
    cursos = this.escaparHtml(cursos);

    let textoLink = '';
    if (tipo !== 'excluir') {
        const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        let dateQuery = '';
        if (dados.dataISO) dateQuery = dados.dataISO;
        else if (dados.data && dados.data.includes('/')) {
            const parts = dados.data.split('/');
            if(parts.length === 3) dateQuery = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        const linkFinal = `${baseUrl}/calendario${dateQuery ? `?date=${dateQuery}` : ''}`;
        textoLink = `\n🔗 <a href="${linkFinal}"><b>Ver no Cronograma</b></a>`;
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
${obs ? `\n📝 <b>Obs:</b> ${obs}` : ''}
${textoLink}
    `.trim();
  }

  gerarMensagemEvento(dados, tipo) {
    const tituloEvento = this.escaparHtml(dados.titulo || 'Sem título');
    const tipoEvento = this.escaparHtml(dados.tipoEvento || 'Evento');
    const laboratorio = this.escaparHtml(dados.laboratorio === 'Todos' ? 'Todos os Laboratórios' : (dados.laboratorio || 'N/A'));
    const dataInicio = this.escaparHtml(dados.dataInicio || 'N/A');
    const dataFim = this.escaparHtml(dados.dataFim || 'N/A');
    const desc = this.escaparHtml(dados.descricao || '');
    
    let acao = '';
    let emoji = '📅';

    if (tipo === 'evento_adicionar') { acao = 'NOVO EVENTO'; emoji = '🆕'; }
    else if (tipo === 'evento_editar') { acao = 'EVENTO ATUALIZADO'; emoji = '🔄'; }
    else if (tipo === 'evento_excluir') { acao = 'EVENTO REMOVIDO'; emoji = '❌'; }

    let textoLink = '';
    if (tipo !== 'evento_excluir') {
        const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        textoLink = `\n🔗 <a href="${baseUrl}/calendario"><b>Ver no Cronograma</b></a>`;
    }

    return `
${emoji} <b>${acao}</b>

📌 <b>Título:</b> ${tituloEvento}
🏷️ <b>Tipo:</b> ${tipoEvento}
🏢 <b>Local:</b> ${laboratorio}
📅 <b>Início:</b> ${dataInicio}
📅 <b>Fim:</b> ${dataFim}
${desc ? `\n📝 <b>Descrição:</b> ${desc}` : ''}
${textoLink}
    `.trim();
  }
}

export const notificadorTelegram = new NotificadorTelegram();
export default NotificadorTelegram;