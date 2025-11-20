// src/AjudaFAQ.js
import React from 'react';
import {
  Container,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// --- DEFINA SUAS PERGUNTAS E RESPOSTAS AQUI ---

// --- NOVAS FUNCIONALIDADES E CORREÇÕES ---
const faqData = [
  {
    id: 'faq1',
    pergunta: 'Como posso propor uma nova aula?',
    resposta: 'Para propor uma nova aula, navegue até a seção "Propor Aula" no menu. Preencha todos os detalhes solicitados, como assunto, tipo de atividade, laboratório, data e o bloco de horário desejado. Após submeter, sua proposta ficará com o status "pendente" até ser aprovada por um coordenador.',
  },
  {
    id: 'faq2',
    pergunta: 'Como funcionam os filtros no calendário?',
    resposta: 'Na página do calendário, você encontrará opções para filtrar os eventos por Laboratório, por Assunto (digitando parte do nome) e por Dia da Semana. Você pode combinar esses filtros para refinar sua busca. Use o botão "Limpar Filtros" para remover todas as seleções e ver o calendário completo.',
  },
  {
    id: 'faq3',
    pergunta: 'O que significam os blocos de horário fixos?',
    resposta: 'Ao propor ou agendar uma aula, você selecionará um bloco de horário pré-definido (ex: 07:00 - 09:10). Isso ajuda a padronizar a duração e os intervalos das atividades nos laboratórios.',
  },
  {
    id: 'faq4',
    pergunta: 'Como técnico, como vejo minhas aulas designadas?',
    resposta: 'Se você for um técnico, no menu principal haverá uma opção "Minhas Designações". Esta página listará todas as aulas para as quais você foi designado e que foram aprovadas.',
  },
  
  {
    id: 'faq-login',
    pergunta: 'Como faço para acessar o sistema?',
    resposta: 'Para acessar o sistema de Cronograma do Laboratório, você precisa fazer login utilizando sua conta Google. Clique no botão "Login com Google" na página inicial.',
  },
  {
    id: 'faq-primeiro-acesso',
    pergunta: 'É meu primeiro acesso. O que devo fazer?',
    resposta: 'Após fazer login pela primeira vez, seu perfil pode precisar de aprovação ou da definição de um papel (Coordenador ou Técnico) por um administrador do sistema. Por favor, aguarde ou entre em contato com a coordenação se o seu acesso demorar a ser liberado.',
  },
  {
    id: 'faq-trocar-tema',
    pergunta: 'Posso mudar a aparência do sistema (tema claro/escuro)?',
    resposta: 'Sim! No canto superior direito da tela, você encontrará um ícone de sol (para mudar para tema escuro) ou de lua (para mudar para tema claro). Clique nele para alternar a aparência do sistema.',
  },
  {
    id: 'faq-sair',
    pergunta: 'Como faço para sair do sistema (logout)?',
    resposta: 'No canto superior direito, clique no ícone do seu perfil (ou no menu mobile) e selecione a opção "Sair".',
  },

  // --- AGENDAMENTO / PROPOSTA DE AULAS (ProporAulaForm.js) ---
  {
    id: 'faq-propor-aula',
    pergunta: 'Como posso propor/agendar uma nova aula?',
    resposta: 'No menu, procure pela opção "Propor Aula" (para técnicos/professores) ou "Agendar Aula" (para coordenadores). Preencha todos os detalhes solicitados no formulário, como tipo de atividade, assunto, laboratório, data e o bloco de horário desejado. Coordenadores podem agendar aulas diretamente com status "aprovada", enquanto outras propostas ficam "pendentes" para aprovação.',
  },
  {
    id: 'faq-blocos-horario',
    pergunta: 'O que são os "Blocos de Horário" no formulário de agendamento?',
    resposta: 'Ao agendar uma aula, você selecionará um bloco de horário pré-definido (ex: 07:00 - 09:10). Isso ajuda a padronizar a duração e os intervalos das atividades nos laboratórios, facilitando a organização do cronograma.',
  },
  {
    id: 'faq-aula-duplicada',
    pergunta: 'O sistema me avisou que já existe uma aula similar. O que fazer?',
    resposta: 'Se você tentar agendar uma aula em um laboratório, data e horário que já estão ocupados por outra aula (pendente ou aprovada), o sistema exibirá um aviso. Você poderá cancelar o novo agendamento ou confirmar que deseja agendar mesmo assim (criando uma duplicata, se permitido pelas regras do laboratório).',
  },
  {
    id: 'faq-salvar-adicionar-outra',
    pergunta: 'Para que serve o botão "Salvar e Adicionar Outra"?',
    resposta: 'No formulário de agendamento, este botão salva a aula atual e mantém alguns campos preenchidos (como data e laboratório), limpando apenas campos como assunto e observações. Isso agiliza a inserção de várias aulas sequenciais ou similares.',
  },
  {
    id: 'faq-copiar-aula',
    pergunta: 'Posso copiar uma aula existente para criar uma nova?',
    resposta: 'Sim! No calendário, ao visualizar os detalhes de um dia (no modal), você encontrará um ícone de "Copiar" ao lado de cada aula. Clicando nele, o formulário de agendamento será aberto com os dados da aula copiada, faltando apenas você definir a nova data e bloco de horário.',
  },
  // { // Exemplo futuro, se implementado o comando de voz
  //   id: 'faq-comando-voz-agendar',
  //   pergunta: 'Posso agendar aulas por comando de voz?',
  //   resposta: 'Sim, estamos implementando uma funcionalidade experimental de comando de voz no formulário de agendamento. Clique no ícone de microfone e diga os detalhes da aula que deseja agendar (ex: "Agendar aula de anatomia no laboratório anatomia 1 para terça às sete horas"). O sistema tentará preencher os campos para você.',
  // },

  // --- VISUALIZAÇÃO DO CRONOGRAMA (CalendarioCronograma.js) ---
  {
    id: 'faq-ver-cronograma',
    pergunta: 'Como vejo o cronograma de aulas?',
    resposta: 'A página inicial ("Home") exibe o cronograma da semana atual. Você pode navegar entre as semanas usando as setas ou selecionar um mês/ano específico usando o seletor de data.',
  },
  {
    id: 'faq-filtros-calendario',
    pergunta: 'Como usar os filtros no calendário?',
    resposta: 'No topo da página do calendário, você encontrará filtros para: Laboratório, buscar por Assunto da aula, e (futuramente) por Dia da Semana. Selecione as opções desejadas para refinar a visualização. Use o botão "Limpar Filtros" para remover todas as seleções.',
  },
  {
    id: 'faq-detalhes-dia-calendario',
    pergunta: 'Como vejo todas as aulas de um dia específico no calendário?',
    resposta: 'Na visualização semanal, cada card de dia mostra um resumo dos eventos. Clique no card do dia desejado (ou no botão "Detalhes" nele) para abrir uma janela com a lista completa de todas as aulas e seus detalhes para aquele dia específico.',
  },
  {
    id: 'faq-aula-destacada-tecnico',
    pergunta: 'Por que algumas aulas aparecem destacadas no calendário?',
    resposta: 'Se você estiver logado como técnico, as aulas para as quais você foi designado aparecerão com um destaque visual (geralmente uma borda ou fundo diferente) para facilitar a identificação dos seus compromissos.',
  },

  // --- NOVAS FUNCIONALIDADES E CORREÇÕES ---
  {
    id: 'faq-historico-aulas',
    pergunta: 'O que é o Histórico de Aulas e o que ele exibe?',
    resposta: 'O Histórico de Aulas (acessível pelo menu) exibe uma lista unificada e ordenada por data dos últimos eventos de adição e exclusão de aulas no sistema. Ele funciona como um log de auditoria simplificado, mostrando quem adicionou ou excluiu uma aula e quando.',
  },
  {
    id: 'faq-filtros-historico',
    pergunta: 'Como funcionam os filtros no Histórico de Aulas?',
    resposta: 'O histórico carrega por padrão os últimos 30 eventos. Você pode usar os filtros de Disciplina, Curso, Ano, Status, Data Início e Data Fim para refinar a lista. O botão "Limpar Filtros" remove todas as seleções e exibe novamente os 30 eventos mais recentes.',
  },
  {
    id: 'faq-download-ics',
    pergunta: 'Como baixo o cronograma para o meu calendário pessoal (.ics)?',
    resposta: 'Na página "Download Cronograma", selecione o mês e ano desejados e clique em "Baixar Calendário (.ics)". O arquivo gerado pode ser importado para calendários como Google Calendar, Outlook ou Apple Calendar, permitindo que você acompanhe as aulas do laboratório em seu dispositivo pessoal.',
  },
  {
    id: 'faq-download-excel',
    pergunta: 'Como baixo o cronograma em formato de planilha Excel?',
    resposta: 'Na página "Download Cronograma", selecione o mês e ano e clique em "Baixar Relatório Excel". Uma planilha (.xlsx) com a lista detalhada de aulas aprovadas para aquele mês será gerada.',
  },

  // --- PARA COORDENADORES ---
  {
    id: 'faq-coordenador-aprovar',
    pergunta: 'Como coordenador, como aprovo ou rejeito propostas de aula?',
    resposta: 'Acesse a seção "Gerenciar Aprovações" no menu. Lá você verá a lista de aulas pendentes e aprovadas. Você pode alterar o status de cada aula e designar técnicos para as aulas aprovadas.',
  },
  {
    id: 'faq-coordenador-designar-tecnico',
    pergunta: 'Como designo técnicos para uma aula aprovada?',
    resposta: 'Em "Gerenciar Aprovações", encontre a aula aprovada e use a opção para designar técnicos. Um modal permitirá selecionar um ou mais técnicos disponíveis. Você também pode fazer isso no calendário, abrindo os detalhes de um dia, encontrando a aula e usando a opção de designar técnicos.',
  },
  {
    id: 'faq-coordenador-gerenciar-usuarios',
    pergunta: 'Onde gerencio os papéis e aprovações de usuários?',
    resposta: 'Acesse "Gerenciar Usuários" no menu. Nesta seção, você pode ver a lista de usuários, aprovar novos cadastros e definir/alterar o papel (coordenador ou técnico) de cada um.',
  },
  {
    id: 'faq-coordenador-gerenciar-avisos',
    pergunta: 'Como posto ou gerencio avisos no mural?',
    resposta: 'Acesse "Gerenciar Avisos" no menu. Lá você poderá adicionar novos avisos, ver os existentes, editá-los (futuramente) e excluí-los. Você também poderá ver quem marcou os avisos como lidos.',
  },
  // Esta FAQ foi substituída pelas FAQs mais detalhadas sobre Download Excel e ICS
  // {
  //   id: 'faq-coordenador-download-planilha',
  //   pergunta: 'Como faço para baixar o cronograma em formato de planilha?',
  //   resposta: 'Na página "Download Cronograma" (acessível pelo menu ou por um botão no calendário), selecione o mês e ano desejados e clique em "Baixar Planilha". Uma planilha Excel (.xlsx) com a lista de aulas aprovadas daquele mês será gerada.',
  // },

  // --- PARA TÉCNICOS ---
  {
    id: 'faq-tecnico-minhas-designacoes',
    pergunta: 'Como técnico, onde vejo apenas as minhas aulas?',
    resposta: 'No menu, acesse a opção "Minhas Designações". Esta página listará todas as aulas para as quais você foi designado e que foram aprovadas. Você pode filtrar por próximas, passadas ou todas as designações.',
  },

  // --- AVISOS ---
  {
    id: 'faq-mural-avisos',
    pergunta: 'O que é o Mural de Avisos?',
    resposta: 'O Mural de Avisos (acessível pelo menu "Avisos") exibe comunicados importantes da coordenação ou administração dos laboratórios, como manutenções, mudanças de regras, etc. É recomendado verificá-lo regularmente.',
  },
  
  {
    id: 'faq-marcar-aviso-lido',
    pergunta: 'Como marco um aviso como lido?',
    resposta: 'No Mural de Avisos, cada aviso terá um botão "Marcar como Lido". Ao clicar, o sistema registrará que você visualizou aquele comunicado, e o aviso poderá mudar de aparência para indicar que foi lido por você.',
  },
  // Adicione mais Q&As conforme necessário
];

// --- FIM DA DEFINIÇÃO DE PERGUNTAS E RESPOSTAS ---

function AjudaFAQ() {
  const [expanded, setExpanded] = React.useState(false);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
          Ajuda / Perguntas Frequentes (FAQ)
        </Typography>

        {faqData.length === 0 ? (
          <Typography variant="body1" align="center" color="text.secondary">
            Nenhuma pergunta frequente cadastrada no momento.
          </Typography>
        ) : (
          <Box>
            {faqData.map((item) => (
              <Accordion 
                key={item.id} 
                expanded={expanded === item.id} 
                onChange={handleChange(item.id)}
                sx={{mb: 1}} // Espaçamento entre os accordions
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`${item.id}-content`}
                  id={`${item.id}-header`}
                  sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                >
                  <Typography variant="h6" component="h3" sx={{fontSize: '1.1rem', fontWeight: 500}}>
                    {item.pergunta}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ backgroundColor: 'background.default', borderTop: '1px solid rgba(0, 0, 0, .125)' }}>
                  <Typography sx={{ whiteSpace: 'pre-line' }}>
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