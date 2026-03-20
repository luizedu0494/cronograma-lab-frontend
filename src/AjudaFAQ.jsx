// src/AjudaFAQ.jsx
import React from 'react';
import {
  Container, Typography, Paper, Accordion, AccordionSummary,
  AccordionDetails, Box, Chip, Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Categorias para organizar as perguntas
const CATEGORIAS = {
  geral:       { label: 'Geral',            color: 'default' },
  tecnico:     { label: 'Técnico',          color: 'info'    },
  coordenador: { label: 'Coordenador',      color: 'primary' },
  calendario:  { label: 'Calendário',       color: 'success' },
  avisos:      { label: 'Avisos',           color: 'warning' },
  download:    { label: 'Download',         color: 'secondary'},
};

const faqData = [

  // ── GERAL ───────────────────────────────────────────────────────────────

  {
    id: 'faq-login',
    categoria: 'geral',
    pergunta: 'Como faço para acessar o sistema?',
    resposta: 'Clique no botão "Login com Google" na tela inicial e autentique com sua conta institucional. Após o primeiro login, seu perfil aguardará aprovação da coordenação para liberar o acesso completo.',
  },
  {
    id: 'faq-primeiro-acesso',
    categoria: 'geral',
    pergunta: 'É meu primeiro acesso. O que devo fazer?',
    resposta: 'Após fazer login pela primeira vez, seu perfil ficará com status "Pendente" até que um coordenador aprove seu cadastro e defina seu cargo (Técnico ou Coordenador). Entre em contato com a coordenação se o acesso demorar a ser liberado.',
  },
  {
    id: 'faq-trocar-tema',
    categoria: 'geral',
    pergunta: 'Posso mudar a aparência do sistema (tema claro/escuro)?',
    resposta: 'Sim! No canto superior direito da tela, clique no ícone de sol (tema claro) ou de lua (tema escuro) para alternar. A preferência fica salva no seu navegador.',
  },
  {
    id: 'faq-sair',
    categoria: 'geral',
    pergunta: 'Como faço para sair do sistema?',
    resposta: 'No canto superior direito, clique no ícone do seu perfil (avatar) e selecione "Sair".',
  },

  // ── TÉCNICO ─────────────────────────────────────────────────────────────

  {
    id: 'faq-tecnico-onboarding',
    categoria: 'tecnico',
    pergunta: 'Na primeira vez que abri o sistema, apareceu uma tela de configuração. O que é isso?',
    resposta: 'É o onboarding de boas-vindas! Ele aparece apenas na primeira vez que você acessa o sistema neste dispositivo e te guia em 2 passos:\n\n1. Escolher os laboratórios que você monitora\n2. Confirmar a seleção\n\nApós concluir, o painel inicial mostrará automaticamente só as aulas dos seus laboratórios todo dia. Você pode alterar essa seleção a qualquer momento clicando no ícone de funil no painel "Cronograma Oficial — Hoje".',
  },
  {
    id: 'faq-tecnico-filtro-labs',
    categoria: 'tecnico',
    pergunta: 'Como filtro o cronograma para mostrar só os meus laboratórios?',
    resposta: 'No painel inicial, dentro do card "Cronograma Oficial — Hoje", clique no ícone de funil (filtro) no canto superior direito do card. Uma tela abrirá com todos os laboratórios agrupados por tipo. Você pode:\n\n• Clicar no cabeçalho do grupo para selecionar/desmarcar todos do tipo de uma vez\n• Clicar em cada laboratório individualmente\n\nA seleção fica salva neste dispositivo automaticamente.',
  },
  {
    id: 'faq-tecnico-dispositivos',
    categoria: 'tecnico',
    pergunta: 'Configurei meus laboratórios no computador do trabalho. Vai aparecer no meu celular também?',
    resposta: 'Não — a seleção de laboratórios é salva por dispositivo (no armazenamento local do navegador). Isso é intencional para que técnicos diferentes possam usar o mesmo computador com configurações independentes sem conflito. Ao acessar por um novo dispositivo, o onboarding aparece novamente para você configurar aquele dispositivo.',
  },
  {
    id: 'faq-tecnico-painel',
    categoria: 'tecnico',
    pergunta: 'O que aparece no meu painel inicial como técnico?',
    resposta: 'Seu painel mostra:\n\n• KPIs: aulas hoje (cronograma oficial), revisões hoje, sua agenda privada do dia e total de suas propostas\n• Cronograma Oficial — Hoje: aulas e revisões aprovadas filtradas pelos seus laboratórios\n• Agenda do Técnico — Hoje: suas revisões e preparações registradas na agenda privada\n• Avisos não lidos da coordenação\n• Assistente IA para consultas rápidas',
  },
  {
    id: 'faq-tecnico-agenda-privada',
    categoria: 'tecnico',
    pergunta: 'O que é a Agenda do Técnico e como uso?',
    resposta: 'A Agenda do Técnico é um calendário privado separado do cronograma oficial. Nele você registra suas próprias revisões, preparações de materiais e outras atividades pessoais que não fazem parte do agendamento formal.\n\nAcesse pelo menu "Revisões". Você pode criar eventos por bloco de horário, definir tipo (revisão de conteúdo, pré-prova, monitoria etc.) e acompanhar o status (planejada, confirmada, realizada, cancelada).',
  },
  {
    id: 'faq-tecnico-propor-aula',
    categoria: 'tecnico',
    pergunta: 'Como proponho uma nova aula?',
    resposta: 'Acesse "Propor Aula" no menu. Preencha:\n\n• Tipo de atividade (aula, revisão, prática etc.)\n• Assunto/disciplina\n• Laboratório(s)\n• Data\n• Bloco de horário\n• Curso(s) envolvido(s)\n\nApós enviar, a proposta ficará com status "Pendente" até aprovação do coordenador. Acompanhe em "Minhas Propostas".',
  },
  {
    id: 'faq-tecnico-minhas-propostas',
    categoria: 'tecnico',
    pergunta: 'Como acompanho o status das minhas propostas?',
    resposta: 'Acesse "Minhas Propostas" no menu. Você verá todas as suas propostas com os status:\n\n• Pendente: aguardando análise do coordenador\n• Aprovada: aceita e inserida no cronograma\n• Rejeitada: não aprovada (pode haver motivo informado)',
  },
  {
    id: 'faq-tecnico-designacoes',
    categoria: 'tecnico',
    pergunta: 'Como vejo as aulas em que fui designado?',
    resposta: 'Acesse "Minhas Designações" no menu. Lá estão listadas todas as aulas aprovadas nas quais o coordenador te designou como técnico responsável. Você pode filtrar por próximas ou passadas.',
  },
  {
    id: 'faq-tecnico-propor-aula',
    categoria: 'tecnico',
    categoria: 'coordenador',
    pergunta: 'O que aparece no painel inicial do coordenador?',
    resposta: 'O painel do coordenador exibe:\n\n• 6 KPIs: aulas hoje, revisões hoje, total de aulas no semestre, total de revisões, propostas pendentes (com alerta) e total de eventos de manutenção\n• Abas: Aulas Recentes e Eventos Recentes\n• Calendário Acadêmico (pode ativar/desativar para alunos)\n• Assistente IA para análises',
  },
  {
    id: 'faq-coord-aprovar',
    categoria: 'coordenador',
    pergunta: 'Como aprovo ou rejeito propostas de aula?',
    resposta: 'Acesse "Aprovações" no menu (com o contador de pendentes em destaque). Você verá a lista de propostas pendentes. Para cada uma pode:\n\n• Aprovar: insere a aula no cronograma oficial\n• Rejeitar: recusa a proposta\n• Designar técnico: atribui um ou mais técnicos para a aula aprovada\n\nO coordenador também pode agendar aulas diretamente com status "Aprovada" sem passar pelo fluxo de proposta.',
  },
  {
    id: 'faq-coord-usuarios',
    categoria: 'coordenador',
    pergunta: 'Como aprovo novos usuários e altero cargos?',
    resposta: 'Acesse "Usuários" no menu. Lá você pode:\n\n• Aprovar novos cadastros (usuários com status "Pendente")\n• Alterar o cargo entre Coordenador e Técnico\n• Remover usuários do sistema\n\nAo remover um usuário, o acesso dele é revogado imediatamente. Caso tente fazer login novamente, precisará de nova aprovação.',
  },
  {
    id: 'faq-coord-avisos',
    categoria: 'coordenador',
    pergunta: 'Como crio e gerencio avisos para os usuários?',
    resposta: 'Acesse "Gerenciar Avisos" no menu. Você pode criar avisos de três tipos:\n\n• Normal: comunicado informativo\n• Importante: destaque visual maior\n• Urgente: alerta em vermelho\n\nVocê também pode ver quem já marcou cada aviso como lido.',
  },
  {
    id: 'faq-coord-eventos',
    categoria: 'coordenador',
    pergunta: 'Como registro um evento de manutenção ou bloqueio de laboratório?',
    resposta: 'Acesse "Eventos de Manutenção" no menu do coordenador. Preencha o tipo de evento, laboratório, data/período e descrição. O laboratório ficará bloqueado para agendamento naquele período e o evento aparecerá no calendário com destaque.',
  },
  {
    id: 'faq-coord-analise-aulas',
    categoria: 'coordenador',
    pergunta: 'Como acesso os gráficos e análises de ocupação?',
    resposta: 'Acesse "Análise de Aulas" no menu. Você verá gráficos de:\n\n• Ocupação por laboratório\n• Distribuição por curso\n• Aulas por turno (manhã, tarde, noite)\n• Evolução mensal\n• Taxa de aprovação de propostas\n\nUse os filtros de período e laboratório para refinar a análise.',
  },
  {
    id: 'faq-coord-periodos',
    categoria: 'coordenador',
    pergunta: 'Para que servem os Períodos/Eventos?',
    resposta: 'Permitem cadastrar eventos acadêmicos no calendário (semanas de provas, feriados, recessos etc.) que ajudam a contextualizar o cronograma. Acesse "Eventos" no menu do coordenador.',
  },
  {
    id: 'faq-coord-integridade',
    categoria: 'coordenador',
    pergunta: 'O que é a Verificação de Integridade de Dados?',
    resposta: 'Acesse "Integridade" no menu. O sistema verifica automaticamente:\n\n• Aulas com dados faltando (laboratório, curso, horário)\n• Conflitos de horário (dois eventos no mesmo lab ao mesmo tempo)\n• Registros com tipo de atividade inválido\n\nÉ recomendado rodar periodicamente para manter o cronograma limpo.',
  },
  {
    id: 'faq-coord-calendario-alunos',
    categoria: 'coordenador',
    pergunta: 'Como ativo o calendário acadêmico para os alunos?',
    resposta: 'No painel inicial, expanda a seção "Calendário Acadêmico". Na parte inferior do acordeão, há um toggle "Disponível para alunos". Ative-o para que os alunos possam visualizar o calendário ao acessar o sistema.',
  },

  // ── CALENDÁRIO ───────────────────────────────────────────────────────────

  {
    id: 'faq-ver-cronograma',
    categoria: 'calendario',
    pergunta: 'Como visualizo o cronograma de aulas?',
    resposta: 'Acesse "Calendário" no menu. O cronograma é exibido em formato semanal. Use as setas para navegar entre semanas ou selecione uma data específica. Cada dia mostra um resumo das aulas; clique no dia para ver todos os detalhes.',
  },
  {
    id: 'faq-filtros-calendario',
    categoria: 'calendario',
    pergunta: 'Como uso os filtros do calendário?',
    resposta: 'No topo da página do calendário há filtros por:\n\n• Laboratório: selecione um ou mais labs\n• Assunto: busca pelo nome da disciplina\n• Status: aprovadas, pendentes ou todas\n\nUse "Limpar Filtros" para voltar à visão completa.',
  },
  {
    id: 'faq-copiar-aula',
    categoria: 'calendario',
    pergunta: 'Como copio uma aula existente para criar outra similar?',
    resposta: 'Ao abrir os detalhes de um dia no calendário, cada aula tem um ícone de copiar. Clicando nele, o formulário de proposta abre já preenchido com os dados daquela aula — basta definir a nova data e horário.',
  },
  {
    id: 'faq-blocos-horario',
    categoria: 'calendario',
    pergunta: 'O que são os blocos de horário fixos?',
    resposta: 'O sistema usa blocos de horário padronizados para facilitar a organização:\n\n• 07:00 – 09:10\n• 09:30 – 12:00\n• 13:00 – 15:10\n• 15:30 – 18:00\n• 18:30 – 20:10\n• 20:30 – 22:00\n\nIsso evita agendamentos em horários incomuns e facilita a visualização de conflitos.',
  },
  {
    id: 'faq-historico',
    categoria: 'calendario',
    pergunta: 'O que é o Histórico de Aulas?',
    resposta: 'O Histórico (menu "Histórico") exibe um log de adições e exclusões de aulas, mostrando quem fez a ação e quando. Funciona como auditoria do sistema. Você pode filtrar por disciplina, curso, data e status.',
  },

  // ── AVISOS ───────────────────────────────────────────────────────────────

  {
    id: 'faq-mural-avisos',
    categoria: 'avisos',
    pergunta: 'O que é o Mural de Avisos?',
    resposta: 'O Mural de Avisos (menu "Avisos") exibe comunicados da coordenação: manutenções, mudanças de regras, informes importantes etc. Avisos urgentes aparecem destacados em vermelho. Verifique regularmente para não perder comunicados.',
  },
  {
    id: 'faq-marcar-aviso-lido',
    categoria: 'avisos',
    pergunta: 'Como marco um aviso como lido?',
    resposta: 'Em cada aviso no mural, clique em "Marcar como Lido". O aviso muda de aparência indicando que você já o visualizou. O contador de avisos não lidos no painel inicial também atualiza.',
  },
  {
    id: 'faq-badge-avisos',
    categoria: 'avisos',
    pergunta: 'Apareceu um chip "X avisos novos" no painel. O que significa?',
    resposta: 'Significa que há avisos da coordenação que você ainda não marcou como lido. Clique no chip para ir direto ao Mural de Avisos.',
  },

  // ── DOWNLOAD ────────────────────────────────────────────────────────────

  {
    id: 'faq-download-excel',
    categoria: 'download',
    pergunta: 'Como baixo o cronograma em planilha Excel?',
    resposta: 'Acesse "Baixar Cronograma" no menu. Selecione o mês, ano e laboratório desejados e clique em "Baixar Excel". Uma planilha .xlsx com todas as aulas aprovadas do período será gerada.',
  },
  {
    id: 'faq-download-ics',
    categoria: 'download',
    pergunta: 'Como importo o cronograma para o Google Calendar ou Outlook?',
    resposta: 'Em "Baixar Cronograma", clique em "Baixar Calendário (.ics)". O arquivo gerado pode ser importado em qualquer calendário compatível com o formato iCalendar: Google Calendar, Outlook, Apple Calendar etc.',
  },
  {
    id: 'faq-download-pdf',
    categoria: 'download',
    pergunta: 'Consigo baixar o cronograma em PDF?',
    resposta: 'Sim. Em "Baixar Cronograma" há a opção de exportar em PDF com o layout do cronograma mensal formatado para impressão.',
  },

];

// ── Componente ───────────────────────────────────────────────────────────────

function AjudaFAQ() {
  const [expanded, setExpanded] = React.useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = React.useState('todas');

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const faqFiltrado = categoriaAtiva === 'todas'
    ? faqData
    : faqData.filter(f => f.categoria === categoriaAtiva);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 1 }}>
          Ajuda / Perguntas Frequentes
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          {faqData.length} perguntas — filtre por categoria para encontrar mais rápido
        </Typography>

        {/* Filtro por categoria */}
        <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center" sx={{ mb: 3 }}>
          <Chip
            label="Todas"
            onClick={() => { setCategoriaAtiva('todas'); setExpanded(false); }}
            color={categoriaAtiva === 'todas' ? 'primary' : 'default'}
            variant={categoriaAtiva === 'todas' ? 'filled' : 'outlined'}
          />
          {Object.entries(CATEGORIAS).map(([key, cat]) => (
            <Chip
              key={key}
              label={cat.label}
              onClick={() => { setCategoriaAtiva(key); setExpanded(false); }}
              color={categoriaAtiva === key ? cat.color : 'default'}
              variant={categoriaAtiva === key ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>

        {faqFiltrado.length === 0 ? (
          <Typography variant="body1" align="center" color="text.secondary">
            Nenhuma pergunta nesta categoria.
          </Typography>
        ) : (
          <Box>
            {faqFiltrado.map((item) => (
              <Accordion
                key={item.id}
                expanded={expanded === item.id}
                onChange={handleChange(item.id)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`${item.id}-content`}
                  id={`${item.id}-header`}
                >
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Chip
                      label={CATEGORIAS[item.categoria]?.label}
                      color={CATEGORIAS[item.categoria]?.color}
                      size="small"
                      sx={{ flexShrink: 0 }}
                    />
                    <Typography variant="body1" fontWeight={500}>
                      {item.pergunta}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                    {item.resposta}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default AjudaFAQ;
