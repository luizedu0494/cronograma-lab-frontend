# 🔬 CronoLab — Análise de Estrutura e Sugestões de Melhorias

> Documento técnico com diagnóstico da arquitetura atual e recomendações de UX, UI e código para as personas **Técnico** e **Coordenador**.

---

## 1. Visão Geral da Arquitetura Atual

### Stack
| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19 + Vite 7 |
| UI | Material-UI v7 |
| Backend/DB | Firebase Firestore (Spark) |
| Auth | Firebase Auth (Google) |
| IA | Groq API (Llama 3.3) + motor local estruturado |
| Notificações | Telegram Bot API |
| Tipografia | Sora (Google Fonts) |
| Gráficos | Chart.js + React-Chartjs-2 |

### Paleta de Cores Institucional (CESMAC)
| Token | Valor | Uso atual |
|-------|-------|-----------|
| Azul principal | `#1E7EC8` | Botões, links, navbar, KPIs |
| Azul claro | `#4AADE8` | Chips, destaques no dark mode |
| Dourado | `#F5C518` / `#D4940A` | Revisões, alertas, avisos |
| Fundo dark | `#0B0F18` | Background no dark mode |

### Perfis de acesso mapeados
- **Coordenador** — visão estratégica, aprovações, análises, gestão
- **Técnico** — visão operacional, agenda privada, filtro de labs favoritos
- **Aluno** — somente leitura do cronograma

---

## 2. Diagnóstico da Estrutura

### ✅ Pontos Fortes

- Separação de responsabilidades razoável: `hooks/`, `utils/`, `services/`, `ia-estruturada/`, `components/`
- Onboarding guiado do técnico (3 passos, salvo por dispositivo) — excelente decisão de UX
- Tema dark institucional com identidade visual consistente
- Lazy loading nas rotas → boa performance de carregamento inicial
- Motor de IA híbrido (regras locais + Groq) — reduz dependência de API externa
- Custo zero no plano Spark — viável para uso real

### ⚠️ Pontos a Melhorar

#### Organização do Código
- A maioria dos arquivos de tela vivem soltos em `src/` (mais de 30 `.jsx` sem subpasta). Dificulta escalabilidade.
- Extensão `.jsx` usada em arquivos de serviço puro como `firebaseConfig.jsx`, `holiday-api.jsx` e `save-push-token.jsx` — deveriam ser `.js`.
- Duplicidade funcional entre `AssistenteIA.jsx` e `AssistenteIATecnico.jsx` — possível consolidação com controle por perfil.
- `MELHORIAS_CRONOLAB.md`, `ALTERACOES_IMPLEMENTADAS.md`, `MUDANCAS_IMPLEMENTADAS.md`, `PATCH_AssistenteIA.md` são documentos de changelog que poderiam ser consolidados em um `CHANGELOG.md` padronizado.

#### Filtros do Técnico no Client-Side
- Filtros de laboratório favoritos são aplicados no cliente após busca inicial (confirmado na documentação). Para volumes maiores de dados, isso pode gerar lentidão.

#### Ausência de Tipos
- O projeto é 100% JavaScript sem TypeScript. Props de componentes não têm validação explícita (PropTypes ou TS). Aumenta risco de bugs silenciosos.

---

## 3. Melhorias por Perfil

---

### 👨‍💼 3.1 Coordenador

#### UX / Fluxo de Trabalho

**🔴 Alta prioridade**

- **Fila de aprovações com pré-visualização lateral**
  Atualmente o coordenador entra em `GerenciarAprovacoes` e presumivelmente abre cada proposta separadamente. Sugestão: implementar layout de lista + detalhe lado a lado (padrão "master-detail"), com ações de aprovar/rejeitar direto no painel sem abrir modal, reduzindo cliques.

- **Badge com contador em tempo real no item de menu "Aprovações"**
  Já existe o contador de pendentes — garantir que ele seja atualizado via listener em tempo real (não apenas no carregamento), para que o coordenador veja novas propostas chegando sem precisar recarregar a página.

- **Confirmação com comentário ao rejeitar proposta**
  Ao rejeitar uma proposta, exibir campo obrigatório de motivo. Esse comentário ficaria visível para o técnico em "Minhas Propostas", fechando o ciclo de comunicação.

**🟡 Média prioridade**

- **Dashboard com resumo semanal/mensal na tela inicial**
  Os KPIs atuais mostram "aulas hoje" e "aulas 2026". Adicionar uma mini-visualização tipo sparkline (Chart.js já está no projeto) mostrando tendência das últimas 4 semanas — útil para perceber picos de uso de laboratórios.

- **Filtro rápido por laboratório na listagem de aprovações**
  Coordenadores com muitos labs podem ter dezenas de propostas. Um chip-filter por laboratório no topo da listagem agiliza o triagem.

- **Exportação com filtros aplicados**
  O `DownloadCronograma.jsx` já existe. Garantir que os filtros de data/laboratório/curso ativos sejam refletidos no arquivo exportado, não apenas na visualização.

- **Resumo de integridade de dados no painel inicial**
  `VerificarIntegridadeDados.jsx` existe como tela separada. Uma versão compacta (chip ou alerta) no dashboard avisando "X inconsistências encontradas" seria mais proativa.

**🟢 Baixa prioridade**

- **Histórico de ações do coordenador**
  Registrar no Firestore quando uma proposta foi aprovada/rejeitada e por qual coordenador, com timestamp. Útil para auditoria e para exibir no histórico de aulas.

- **Notificação sonora opcional para novas aprovações pendentes**
  Pequena feature de qualidade de vida: um som discreto (opt-in nas configurações) quando uma nova proposta chega enquanto o coordenador está na tela.

#### UI / Tema (sem fugir das cores)

- **Destaque visual na fila de aprovações por tipo de proposta**
  Usar a lógica de molduras já existente no formulário (roxo para revisão, laranja para prova) também na listagem de aprovações — permitindo que o coordenador identifique o tipo de evento visualmente antes de abrir.

- **Cards de KPI com micro-tendência**
  Os cards do painel podem ter uma seta discreta (↑ ↓ →) indicando comparação com a semana anterior, usando o azul claro (`#4AADE8`) para alta e o dourado (`#F5C518`) para atenção — dentro da paleta existente.

- **Modo alto contraste para o calendário**
  Usuários com dificuldade visual têm dificuldade em distinguir eventos por cor. Adicionar opção de exibir ícones de forma (círculo, quadrado, triângulo) além da cor para diferenciar tipos de aula.

---

### 🔬 3.2 Técnico

#### UX / Fluxo de Trabalho

**🔴 Alta prioridade**

- **Painel do dia com ordenação por horário e agrupamento por laboratório**
  O "Cronograma Oficial — Hoje" exibe aulas filtradas pelos labs favoritos. Garantir que estejam sempre ordenadas cronologicamente e, opcionalmente, agrupadas por laboratório — crítico para o técnico que precisa saber qual lab preparar em qual horário.

- **Status de presença / confirmação de preparo do laboratório**
  O técnico vê a aula no painel, mas não tem como sinalizar "já preparei o lab X". Adicionar um botão de check simples ("Lab preparado ✓") que marca a aula localmente (localStorage por uid, sem custo Firestore) e muda a cor do card para cinza/verde — dando feedback visual de progresso no dia.

- **Alerta de aula em breve (próximos 30 min)**
  Um chip ou banner amarelo/dourado no topo do painel do técnico quando há uma aula nos próximos 30 minutos nos labs favoritos. Já existe o dourado `#F5C518` na paleta — uso perfeito para urgência leve.

**🟡 Média prioridade**

- **Visualização semanal compacta no painel do técnico**
  Hoje o técnico só vê "hoje". Adicionar uma visualização tipo grade de 5 dias (seg–sex) compacta, com bolinhas coloridas indicando quantidade de aulas por dia — permite planejamento antecipado sem sair do painel.

- **Notificação quando proposta for aprovada/rejeitada**
  Em "Minhas Propostas", o técnico acompanha o status manualmente. Implementar uma notificação in-app (badge no menu + toast) quando o status de uma proposta mudar — pode usar `onSnapshot` com cleanup correto para não extrapolar o Spark.

- **Editar laboratórios favoritos direto pelo perfil**
  Atualmente o ícone de funil fica no painel "Cronograma Oficial — Hoje". Adicionar o mesmo acesso em "Configurações de Perfil" (`ConfiguracoesPerfil.jsx`) para consistência.

- **Campo de observação na agenda privada**
  O técnico pode registrar revisões na agenda privada. Adicionar campo de observação livre (ex.: "levar chave do armário", "verificar microscópio 3") que fique visível no card do dia.

**🟢 Baixa prioridade**

- **Widget de laboratórios designados no painel**
  `MinhasDesignacoes.jsx` existe como tela separada. Um card compacto no painel mostrando "Seus laboratórios: Lab A, Lab B" com link para a tela completa seria mais acessível.

- **Modo rápido de proposta de aula**
  Para o técnico que precisa propor uma aula recorrente, adicionar "Repetir proposta anterior" — preenche o formulário com os dados da última proposta do usuário, bastando alterar a data.

#### UI / Tema (sem fugir das cores)

- **Diferenciação visual mais forte entre os dois painéis do dia**
  "Cronograma Oficial — Hoje" e "Agenda do Técnico — Hoje" ficam lado a lado. Sugestão: usar borda esquerda colorida diferente para cada painel — azul (`#1E7EC8`) para o oficial e dourado (`#F5C518`) para a agenda privada — mantendo a paleta e criando hierarquia visual imediata.

- **Cards de aula com indicador de horário restante**
  Para aulas que ainda vão acontecer hoje, exibir uma pill discreta mostrando "em 2h" ou "em andamento" — usando o azul claro `#4AADE8` para futuro e verde para em andamento.

- **Onboarding: chips de laboratório maiores no mobile**
  No passo 2 do onboarding (seleção de labs), verificar o tamanho de toque dos chips em telas menores (< 375px). O mínimo recomendado para toque é 44×44px. Ajustar padding se necessário.

---

## 4. Melhorias Compartilhadas (Ambos os Perfis)

### UX Geral

- **Skeleton loaders em vez de spinner genérico**
  Substituir os loading states de spinner por `Skeleton` do MUI nos cards e tabelas. Reduz a percepção de tempo de espera e mantém o layout estável durante o carregamento.

- **Mensagem de estado vazio com call-to-action**
  `EmptyState.jsx` já existe — verificar se está sendo usado em todos os lugares onde a lista pode retornar vazia (aprovações, histórico, designações). Um empty state com botão de ação (ex.: "Nenhuma proposta. Criar agora →") é muito mais útil que uma tela em branco.

- **Scroll to top automático na troca de rota**
  Comportamento padrão esperado em SPAs — confirmar se React Router está configurado com `ScrollRestoration` ou equivalente.

- **Feedback de ação com Snackbar padronizado**
  Garantir que todas as ações (salvar, aprovar, rejeitar, deletar) exibam um `Snackbar` com mensagem de sucesso ou erro, usando as cores da paleta (`#1E7EC8` para sucesso, vermelho para erro).

### Assistente IA

- **Sugestões de consulta pré-definidas (chips clicáveis)**
  Na interface do assistente, exibir 4–5 consultas sugeridas como chips logo abaixo do campo de texto: "Aulas de hoje", "Labs disponíveis agora", "Minhas propostas pendentes". Reduz a curva de aprendizado para novos usuários.

- **Histórico de consultas recentes (localStorage)**
  As últimas 5 consultas do usuário aparecem como sugestões quando o campo está focado — sem custo de Firestore, usando localStorage por uid.

### Tema e Visual

- **Transições de página com Framer Motion (já instalado)**
  Framer Motion já está no projeto. Adicionar uma transição suave de fade/slide entre rotas (100–200ms) melhora a sensação de fluidez da aplicação sem custo de performance perceptível.

- **Favicon e ícones PWA personalizados com logo CESMAC**
  O `manifest.json` e `firebase-messaging-sw.jsx` já existem. Garantir que `logo192.png` e `logo512.png` usem a identidade visual atualizada com a paleta azul institucional.

- **Tipografia: hierarquia mais clara nos cards**
  Com a fonte Sora, garantir que o título da disciplina nos cards de aula use `font-weight: 600`, o laboratório `400` e horário `500` — criando hierarquia visual sem mudar a fonte.

- **Bordas arredondadas consistentes**
  Verificar se `borderRadius` está padronizado no `theme.jsx` (sugestão: `8px` para cards, `4px` para inputs, `12px` para modais) — evitando mix de bordas quadradas e redondas no mesmo contexto.

---

## 5. Sugestões Técnicas / Código

### Reorganização de Pastas (prioridade futura)

```
src/
├── pages/
│   ├── coordenador/
│   │   ├── GerenciarAprovacoes.jsx
│   │   ├── AnaliseAulas.jsx
│   │   └── ...
│   ├── tecnico/
│   │   ├── MinhasDesignacoes.jsx
│   │   ├── MinhasPropostas.jsx
│   │   └── ...
│   └── compartilhado/
│       ├── HistoricoAulas.jsx
│       ├── AssistenteIA.jsx
│       └── ...
├── components/
├── hooks/
├── services/
├── utils/
├── constants/
└── ia-estruturada/
```

Isso não muda comportamento algum — apenas facilita encontrar arquivos e onboarding de novos desenvolvedores.

### Consolidar Assistente IA

```jsx
// Em vez de dois componentes separados:
// AssistenteIA.jsx (coordenador)
// AssistenteIATecnico.jsx (técnico)

// Usar um único:
// AssistenteIA.jsx com controle de perfil
const AssistenteIA = () => {
  const { perfil } = useAuth();
  const podeEditar = perfil === 'coordenador';
  // ...
};
```

### Extensões de arquivo corretas

Renomear de `.jsx` para `.js` os arquivos sem JSX:
- `firebaseConfig.jsx` → `firebaseConfig.js`
- `holiday-api.jsx` → `holiday-api.js`
- `save-push-token.jsx` → `save-push-token.js`
- `functions/index.jsx` → `functions/index.js`

### PropTypes ou migração gradual para TypeScript

Adicionar PropTypes nos componentes mais usados como passo intermediário antes de TS:

```jsx
import PropTypes from 'prop-types';

AulaCard.propTypes = {
  aula: PropTypes.shape({
    assunto: PropTypes.string.isRequired,
    laboratorio: PropTypes.string,
    horario: PropTypes.string,
    status: PropTypes.oneOf(['aprovada', 'pendente', 'rejeitada']),
  }).isRequired,
};
```

---

## 6. Roadmap de Melhorias Sugerido

| Prioridade | Melhoria | Perfil | Esforço |
|:---:|---|:---:|:---:|
| 🔴 1 | Painel do dia ordenado por horário + agrupamento por lab | Técnico | Baixo |
| 🔴 2 | Lista de aprovações com pré-visualização lateral (master-detail) | Coordenador | Médio |
| 🔴 3 | Alerta visual "aula em breve" (próximos 30 min) | Técnico | Baixo |
| 🔴 4 | Motivo obrigatório ao rejeitar proposta | Coordenador | Baixo |
| 🟡 5 | Skeleton loaders em todos os cards/tabelas | Ambos | Médio |
| 🟡 6 | Sugestões de consulta no Assistente IA | Ambos | Baixo |
| 🟡 7 | Mini-grade semanal no painel do técnico | Técnico | Médio |
| 🟡 8 | KPIs com micro-tendência (sparkline) | Coordenador | Médio |
| 🟡 9 | Transições de rota com Framer Motion | Ambos | Baixo |
| 🟡 10 | Diferenciação visual (borda colorida) entre os dois painéis do dia | Técnico | Baixo |
| 🟢 11 | Reorganização de pastas (`pages/coordenador/`, `pages/tecnico/`) | Ambos | Médio |
| 🟢 12 | Consolidar AssistenteIA em um único componente | Ambos | Médio |
| 🟢 13 | PropTypes nos componentes principais | Ambos | Médio |
| 🟢 14 | Check de "lab preparado" no painel do técnico (localStorage) | Técnico | Baixo |

---

## 7. Resumo Executivo

O **CronoLab** é um sistema bem concebido para o contexto real do CESMAC, com decisões técnicas sólidas (Firebase Spark, tema institucional, onboarding guiado, motor de IA híbrido). A base está madura o suficiente para evoluir com foco em **qualidade de uso diário**, especialmente para o técnico — que é o usuário mais frequente.

As melhorias de maior impacto imediato são aquelas que **reduzem cliques e antecipam informação**:

- Para o **técnico**: saber o que está chegando antes de acontecer (alerta de 30 min), confirmar o que já preparou (check de lab), e enxergar a semana de um relance (mini-grade semanal).
- Para o **coordenador**: triagem mais rápida de aprovações (master-detail), comunicação fechada com o técnico (motivo de rejeição) e visão de tendência no dashboard (sparklines).

O tema está bem aplicado — as sugestões de UI propõem apenas usos mais inteligentes das cores já existentes (bordas coloridas, pills de horário, molduras de tipo), sem criar novas cores ou quebrar a identidade CESMAC.

---

*Análise gerada com base nos arquivos: `README.md`, `ALTERACOES_IMPLEMENTADAS.md`, `arquitetura_ia_estruturada.md`, `ASSISTENTE_IA_DOCUMENTACAO.md` e estrutura de diretórios do projeto `luizedu0494-cronograma-lab-frontend`.*
