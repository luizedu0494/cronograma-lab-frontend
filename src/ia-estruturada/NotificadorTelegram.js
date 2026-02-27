import { LISTA_LABORATORIOS } from '../constants/laboratorios';

class NotificadorTelegram {
  constructor() {
    this.botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    this.apiUrl = 'https://api.telegram.org';

    // CONFIGURAÇÃO DOS IDs DOS TÓPICOS — laboratórios existentes
    this.idsDosTopicos = {
      ANATOMIA: 2,
      HABILIDADES: 3,
      TECNICA_DIETETICA: 4,
      QUIMICA: 5,
      PATOLOGIA: 6
    };

    // TÓPICO DE PROPOSTAS PENDENTES
    this.topicosFluxo = {
      PENDENTES: 1253,
    };
  }

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

  async _enviarParaTopico(chatId, mensagem, threadId) {
    const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: mensagem,
      disable_web_page_preview: true,
      parse_mode: 'HTML'
    };
    if (threadId) payload.message_thread_id = Number(threadId);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resData = await response.json();
    if (!resData.ok) {
      console.error(`❌ Erro Telegram (Tópico ${threadId || 'Geral'}):`, resData.description);
    } else {
      console.log(`✅ Sucesso (Tópico ${threadId || 'Geral'})!`);
    }
    return resData.ok;
  }

  async enviarNotificacao(chatId, dados, tipoNotificacao) {
    if (!this.botToken) { console.error('❌ Token do Bot não encontrado no .env'); return false; }
    if (!chatId) { console.error('❌ Chat ID não fornecido.'); return false; }

    try {
      const mensagem = this.gerarMensagemTexto(dados, tipoNotificacao);

      // Técnico propõe → tópico Pendentes
      if (tipoNotificacao === 'pendente') {
        await this._enviarParaTopico(chatId, mensagem, this.topicosFluxo.PENDENTES);
        return true;
      }

      // Negada → tópico Pendentes
      if (tipoNotificacao === 'rejeitada') {
        await this._enviarParaTopico(chatId, mensagem, this.topicosFluxo.PENDENTES);
        return true;
      }

      // Eventos — sem tópico de laboratório
      if (tipoNotificacao.startsWith('evento_')) {
        await this._enviarParaTopico(chatId, mensagem, null);
        return true;
      }

      // Aprovada / adicionada / editada / excluída → tópico do laboratório
      const listaDeTopicos = this.obterIdsDosTopicos(dados.laboratorio);
      if (listaDeTopicos.length === 0) {
        await this._enviarParaTopico(chatId, mensagem, null);
      } else {
        for (const idTopico of listaDeTopicos) {
          if (idTopico) await this._enviarParaTopico(chatId, mensagem, idTopico);
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
    if (tipo === 'pendente')  return this.gerarMensagemPendente(dados);
    if (tipo === 'rejeitada') return this.gerarMensagemRejeitada(dados);

    const assunto       = this.escaparHtml(dados.assunto || 'Sem assunto');
    const laboratorio   = this.escaparHtml(dados.laboratorio || 'Lab n/a');
    const dataFormatada = this.escaparHtml(dados.data || 'Data n/a');
    const obs           = this.escaparHtml(dados.observacoes || '');
    const propostoPor   = this.escaparHtml(dados.propostoPorNome || '');

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
        if (parts.length === 3) dateQuery = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      const linkFinal = `${baseUrl}/calendario${dateQuery ? `?date=${dateQuery}` : ''}`;
      textoLink = `\n🔗 <a href="${linkFinal}"><b>Ver no Cronograma</b></a>`;
    }

    const tagRevisao = dados.isRevisao
      ? `\n📖 <b>Tipo:</b> ${this.escaparHtml(dados.tipoRevisaoLabel || 'Revisão')}`
      : '';

    let titulo = '';
    let emoji  = '';

    switch (tipo) {
      case 'adicionar': titulo = dados.isRevisao ? 'NOVA REVISÃO ADICIONADA'       : 'NOVA AULA ADICIONADA';       emoji = '✅'; break;
      case 'aprovada':  titulo = dados.isRevisao ? 'REVISÃO APROVADA E ADICIONADA' : 'AULA APROVADA E ADICIONADA'; emoji = '✅'; break;
      case 'editar':    titulo = dados.isRevisao ? 'REVISÃO EDITADA'               : 'AULA EDITADA';               emoji = '✏️'; break;
      case 'excluir':   titulo = dados.isRevisao ? 'REVISÃO EXCLUÍDA'              : 'AULA EXCLUÍDA';              emoji = '🗑️'; break;
      default:          titulo = 'NOTIFICAÇÃO'; emoji = '📢';
    }

    return `
${emoji} <b>${titulo}</b>

📖 <b>Assunto:</b> ${assunto}${tagRevisao}
📅 <b>Data:</b> ${dataFormatada}
🕐 <b>Horário:</b> ${horario}
🏢 <b>Laboratório:</b> ${laboratorio}
👥 <b>Cursos:</b> ${cursos}
${propostoPor ? `👤 <b>Proposto por:</b> ${propostoPor}` : ''}
${obs ? `\n📝 <b>Obs:</b> ${obs}` : ''}
${textoLink}
    `.trim();
  }

  gerarMensagemPendente(dados) {
    const assunto       = this.escaparHtml(dados.assunto || 'Sem assunto');
    const laboratorio   = this.escaparHtml(dados.laboratorio || 'N/A');
    const dataFormatada = this.escaparHtml(dados.data || 'N/A');
    const propostoPor   = this.escaparHtml(dados.propostoPorNome || 'Técnico');
    const tagRevisao    = dados.isRevisao ? ' <b>[REVISÃO]</b>' : '';

    let horario = 'N/A';
    if (Array.isArray(dados.horario)) horario = dados.horario.join(', ');
    else if (dados.horario) horario = dados.horario;

    const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const link = `${baseUrl}/gerenciar-aprovacoes`;

    return `
⏳ <b>NOVA PROPOSTA PENDENTE${tagRevisao}</b>

📖 <b>Assunto:</b> ${assunto}
📅 <b>Data:</b> ${dataFormatada}
🕐 <b>Horário:</b> ${horario}
🏢 <b>Laboratório:</b> ${laboratorio}
👤 <b>Proposto por:</b> ${propostoPor}

🔗 <a href="${link}"><b>Aprovar ou Rejeitar</b></a>
    `.trim();
  }

  gerarMensagemRejeitada(dados) {
    const assunto       = this.escaparHtml(dados.assunto || 'Sem assunto');
    const laboratorio   = this.escaparHtml(dados.laboratorio || 'N/A');
    const dataFormatada = this.escaparHtml(dados.data || 'N/A');
    const propostoPor   = this.escaparHtml(dados.propostoPorNome || 'Técnico');
    const tagRevisao    = dados.isRevisao ? ' [REVISÃO]' : '';

    return `
❌ <b>PROPOSTA NEGADA${tagRevisao}</b>

📖 <b>Assunto:</b> ${assunto}
📅 <b>Data:</b> ${dataFormatada}
🏢 <b>Laboratório:</b> ${laboratorio}
👤 <b>Proposto por:</b> ${propostoPor}
    `.trim();
  }

  gerarMensagemEvento(dados, tipo) {
    const tituloEvento = this.escaparHtml(dados.titulo || 'Sem título');
    const tipoEvento   = this.escaparHtml(dados.tipoEvento || 'Evento');
    const laboratorio  = this.escaparHtml(dados.laboratorio === 'Todos' ? 'Todos os Laboratórios' : (dados.laboratorio || 'N/A'));
    const dataInicio   = this.escaparHtml(dados.dataInicio || 'N/A');
    const dataFim      = this.escaparHtml(dados.dataFim || 'N/A');
    const desc         = this.escaparHtml(dados.descricao || '');

    let acao = ''; let emoji = '📅';
    if (tipo === 'evento_adicionar') { acao = 'NOVO EVENTO';        emoji = '🆕'; }
    else if (tipo === 'evento_editar')  { acao = 'EVENTO ATUALIZADO'; emoji = '🔄'; }
    else if (tipo === 'evento_excluir') { acao = 'EVENTO REMOVIDO';   emoji = '❌'; }

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
