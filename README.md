![Banner](./imgbanner.png)

<p align="center">
  <img src="./src/assets/images/cesmac-logo.png" alt="CESMAC" height="48"/>
</p>

<p align="center">
  <a href="#sobre">Sobre</a> •
  <a href="#novidades-v2">Novidades v2</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#tecnologias">Tecnologias</a> •
  <a href="#instalação">Instalação</a>
</p>

<p align="center">
  <img alt="Firebase Hosting" src="https://img.shields.io/badge/Firebase-Hosting%20Spark-FFCA28?style=flat&logo=firebase&logoColor=black"/>
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black"/>
  <img alt="MUI" src="https://img.shields.io/badge/MUI-v7-1E7EC8?style=flat&logo=mui&logoColor=white"/>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white"/>
</p>

---

## Sobre

O **Cronograma Lab** nasceu de uma necessidade real do dia a dia de trabalho no **CESMAC**, com o objetivo de otimizar a rotina dos técnicos de laboratório e demais colaboradores. A ideia surgiu ao observar a necessidade de uma ferramenta dedicada para agilizar o agendamento de laboratórios, substituindo processos manuais e propensos a erros por uma solução centralizada, inteligente e eficiente.

O que começou como um simples sistema de agendamento evoluiu para uma plataforma robusta de **gestão acadêmica**. Hoje, o sistema não apenas organiza os horários, mas também fornece **insights valiosos** e mantém a equipe informada com **notificações via Telegram**.

O projeto roda inteiramente no **plano gratuito do Firebase (Spark)** — sem custo de infraestrutura.

---

## Novidades v2

> Resumo das melhorias implementadas nesta versão.

### 🎨 Identidade Visual CESMAC

O sistema agora usa as cores institucionais do CESMAC extraídas diretamente do logo oficial:

| Token | Cor | Uso |
| :--- | :--- | :--- |
| **Azul principal** | `#1E7EC8` | Botões, links, KPIs, navbar |
| **Azul claro** | `#4AADE8` | Destaques, chips, dark mode |
| **Dourado** | `#F5C518` / `#D4940A` | Revisões, alertas, avisos |

A fonte foi atualizada de **Inter** para **Sora** — mais legível no mobile e com personalidade mais acadêmica.

O dark mode usa fundo **azul-marinho profundo** (`#0B0F18`) que conversa com a identidade da instituição.

---

### 🧭 Onboarding Guiado do Técnico

Técnicos que acessam o sistema pela primeira vez em um dispositivo passam por um fluxo guiado de 3 passos antes de ver o painel:

```
Passo 1 — Boas-vindas
  Explica o que o sistema faz e como o painel vai ajudar no dia a dia.

Passo 2 — Escolha dos laboratórios
  31 labs agrupados por tipo. Seleção individual ou por grupo inteiro.
  Pensado para toque no celular (chips grandes, scroll natural).

Passo 3 — Confirmação
  Revisão dos labs escolhidos com chips removíveis.
  Pode voltar e alterar antes de confirmar.
```

> **Aparece apenas uma vez por dispositivo/navegador.** Após concluir, nunca mais aparece — salvo em `localStorage` por `uid`. Cada dispositivo tem sua própria configuração independente, sem conflito entre técnicos que compartilham contas.

Para alterar os laboratórios depois, basta clicar no ícone de funil no painel "Cronograma Oficial — Hoje".

---

### 🔥 Correções Firebase (plano Spark)

Esta versão resolve problemas críticos que poderiam forçar upgrade para o plano pago:

| Problema | Impacto | Correção |
| :--- | :--- | :--- |
| **Cloud Functions ativas** | Exige plano Blaze obrigatoriamente | Código comentado, `firebase.json` sem bloco `functions` |
| **`onSnapshot` aninhado em `PainelAvisos`** | Criava N listeners sem cleanup, esgotando leituras/dia | Substituído por `getDocs` pontual por uid |
| **`Promise.all` por aviso em `PaginaInicial`** | 1 leitura por aviso a cada atualização do feed | Substituído por `getDocs` único + cache em `localStorage` |
| **`firebase-admin` no frontend** | Não funciona no browser, aumentava bundle, risco de segurança | Removido do `package.json` |
| **`FieldValue` inexistente no SDK v9+** | Crash em runtime ao incrementar contador | Corrigido para `increment()` do SDK modular |

---

### 🗂️ Estrutura de `localStorage` por usuário

Todas as preferências do técnico ficam salvas localmente por `uid`, sem custo de leitura no Firestore:

| Chave | Conteúdo |
| :--- | :--- |
| `labsFavoritos_<uid>` | Array de nomes dos labs filtrados |
| `onboardingConcluido_<uid>` | `"true"` após concluir o onboarding |
| `labHintVisto_<uid>` | `"true"` após dispensar o hint pós-onboarding |
| `avisosLidos_<uid>` | Array de IDs de avisos já lidos |

---

## Demonstrações

### 🔐 Login

<div align="center">
  <img src="./src/assets/images/image1.png" alt="Tela de login" width="60%"/>
  <br><em>Tela de login com autenticação Google</em>
</div>

---

### 🔬 Técnico

**Onboarding — configuração guiada na primeira visita**

![Onboarding do técnico](./docs/tecnico-onboarding.gif)

**Filtro de laboratórios — cronograma personalizado**

![Filtro de laboratórios](./docs/tecnico-filtro-labs.gif)

**Propor aula**

![Propor aula](./docs/tecnico-propor-aula.gif)

**Agenda privada do técnico**

![Agenda privada](./docs/tecnico-agenda-privada.gif)

---

### 👨‍💼 Coordenador

**Painel principal — visão geral do dia e do semestre**

![Painel do coordenador](./docs/coord-painel.gif)

**Calendário — visualização semanal do cronograma**

![Calendário](./docs/coord-calendario.gif)

**Aprovar propostas**

![Aprovar proposta](./docs/coord-aprovacoes.gif)

**Análise de aulas — gráficos e métricas**

![Análise de aulas](./docs/coord-analise-aulas.gif)

**Análise de eventos**

![Análise de eventos](./docs/coord-analise-eventos.gif)

**Gerenciar avisos**

![Gerenciar avisos](./docs/coord-gerenciar-avisos.gif)

**Propor evento de manutenção**

![Propor evento](./docs/coord-propor-evento.gif)

---

### 📋 Compartilhado

**Assistente IA — consultas em linguagem natural**

![Assistente IA](./docs/assistente-ia.gif)

**Baixar cronograma — Excel e calendário .ics**

![Baixar cronograma](./docs/download-cronograma.gif)

**Histórico de aulas**

![Histórico de aulas](./docs/historico-aulas.gif)

**Ajuda / FAQ**

![Ajuda FAQ](./docs/ajuda-faq.gif)

---



O sistema tem três perfis com experiências completamente diferentes.

### 👨‍💼 Coordenador

Visão estratégica e gestão completa do sistema.

**Painel inicial:**

| KPI | O que mostra |
| :--- | :--- |
| Aulas hoje | Total de aulas aprovadas no dia |
| Revisões hoje | Total de revisões no cronograma do dia |
| Aulas 2026 | Total de aulas cadastradas no ano |
| Revisões 2026 | Total de revisões no ano |
| Pendentes | Propostas aguardando aprovação (com badge de alerta) |
| Eventos 2026 | Total de eventos de manutenção no ano |

**Funcionalidades exclusivas:**

- ✅ Aprovar, editar e rejeitar propostas de aula e evento
- ✅ Gerenciar usuários (aprovar novos cadastros, alterar cargos)
- ✅ Gerenciar grupos e períodos
- ✅ Criar e gerenciar avisos para todos os usuários
- ✅ Análise de aulas — gráficos de ocupação por laboratório, curso, turno e mês
- ✅ Análise de eventos — métricas de manutenção
- ✅ Verificar integridade dos dados
- ✅ Abas "Aulas Recentes" e "Eventos Recentes" no painel

**Menu exclusivo do coordenador:**

```
Aprovações (com contador de pendentes)
Análise de Aulas
Análise de Eventos
Integridade de Dados
Usuários
Eventos de Manutenção
Gerenciar Avisos
```

---

### 🔬 Técnico

Visão operacional focada no dia a dia dos laboratórios.

**Onboarding na primeira visita:**

Ao abrir o sistema pela primeira vez em um dispositivo, o técnico passa por um fluxo guiado de 3 passos para configurar quais laboratórios quer monitorar. Depois disso, nunca mais aparece — salvo por navegador.

**Painel inicial:**

| KPI | O que mostra |
| :--- | :--- |
| Aulas hoje | Aulas no cronograma oficial do dia |
| Revisões cronograma | Revisões oficiais do dia |
| Agenda técnico hoje | Revisões na agenda privada do técnico |
| Minhas propostas | Total de propostas que o técnico criou |

**Painel do dia — dois painéis lado a lado:**

| Painel | O que mostra |
| :--- | :--- |
| Cronograma Oficial — Hoje | Aulas e revisões aprovadas, filtradas pelos laboratórios favoritos do técnico. Ícone de funil para alterar o filtro a qualquer momento. |
| Agenda do Técnico — Hoje | Revisões e preparações registradas na agenda privada do técnico (separadas do cronograma oficial). |

**Funcionalidades exclusivas:**

- ✅ Agenda privada de revisões (calendário pessoal separado do cronograma oficial)
- ✅ Filtro de laboratórios favoritos — salvo por dispositivo no `localStorage`
- ✅ Onboarding guiado na primeira visita
- ✅ Minhas propostas — acompanhar status das propostas enviadas
- ✅ Minhas designações — ver labs atribuídos pela coordenação

**Menu exclusivo do técnico:**

```
Propor Aula
Designações
Minhas Propostas
Revisões (agenda privada)
```

---

### 👨‍🎓 Aluno / Usuário comum

Visão somente leitura do cronograma.

- ✅ Visualizar calendário de aulas aprovadas
- ✅ Histórico de aulas
- ✅ Mural de avisos
- ✅ Calendário acadêmico (quando ativado pelo coordenador)
- ✅ Baixar cronograma em PDF/Excel
- ❌ Sem acesso a formulários, gestão ou análises

---

### Comparativo rápido

| Funcionalidade | Coordenador | Técnico | Aluno |
| :--- | :---: | :---: | :---: |
| Ver calendário | ✅ | ✅ | ✅ |
| Mural de avisos | ✅ | ✅ | ✅ |
| Baixar cronograma | ✅ | ✅ | ✅ |
| Propor aula | ✅ | ✅ | ❌ |
| Aprovar propostas | ✅ | ❌ | ❌ |
| Onboarding de labs | ❌ | ✅ | ❌ |
| Agenda privada | ❌ | ✅ | ❌ |
| Filtro de labs favoritos | ❌ | ✅ | ❌ |
| Análise de dados | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Gerenciar avisos | ✅ | ❌ | ❌ |
| Verificar integridade | ✅ | ❌ | ❌ |

---

| Funcionalidade | Descrição | Status |
| :--- | :--- | :--- |
| **Controle de Acesso** | Autenticação via Google (Firebase Auth) com perfis: Coordenador, Técnico e Aluno | ✅ |
| **Proposta de Aula** | Formulário completo com seleção de laboratório, curso, horário e verificação de conflito | ✅ |
| **Proposta de Evento** | Agendamento de eventos de manutenção e outros com bloqueio de laboratório | ✅ |
| **Verificação de Conflito** | Detecta conflitos de horário e laboratório automaticamente | ✅ |
| **Calendário** | Visualização semanal do cronograma com navegação e filtros | ✅ |
| **Painel do Técnico** | Cronograma do dia filtrado por laboratórios favoritos + agenda privada | ✅ |
| **Onboarding Guiado** | Fluxo de 3 passos na primeira visita para configurar laboratórios — mobile-first | ✅ **novo** |
| **Tema CESMAC** | Identidade visual com cores do logo institucional, dark mode com marinho profundo | ✅ **novo** |
| **Gestão de Aprovações** | Coordenador aprova, edita ou rejeita propostas pendentes | ✅ |
| **Mural de Avisos** | Comunicados da coordenação com status de leitura por usuário | ✅ |
| **Análise de Dados** | Gráficos de ocupação por laboratório, curso, turno e mês | ✅ |
| **Exportação** | Download do cronograma em PDF e Excel | ✅ |
| **Notificações Telegram** | Alertas automáticos para ações de agendamento | ✅ |
| **Assistente IA** | Consultas em linguagem natural sobre o cronograma (sem API externa) | ✅ |

---

## Roadmap

### ✅ Fase 1 — Base e Agendamento (Concluída)

Agendamento, controle de acesso, calendário e verificação de conflitos.

### ✅ Fase 2 — UX e Interface (Concluída)

Filtros dinâmicos, contador de pendências, agenda do técnico, dark mode.

### ✅ Fase 3 — Identidade Visual e Onboarding (Concluída — v2)

| Entrega | Descrição |
| :--- | :--- |
| **Tema CESMAC** | Paleta baseada no logo oficial, fonte Sora, dark mode marinho |
| **Onboarding do técnico** | Fluxo guiado de 3 passos, mobile-first, salvo por dispositivo |
| **Correções Firebase Spark** | Remoção de Cloud Functions, fix de listeners e contadores |
| **Segurança** | Remoção de `firebase-admin` do frontend |

### 🔮 Fase 4 — Próximos Passos

| Funcionalidade | Descrição |
| :--- | :--- |
| **GIFs no README** | Demonstrações animadas do onboarding e do tema |
| **PWA** | Instalação como app no celular (manifesto + service worker) |
| **Notificações push** | Avisos urgentes direto no celular via FCM (requer plano Blaze) |
| **Predição de ociosidade** | IA identifica laboratórios subutilizados |

---

## Tecnologias

| Categoria | Tecnologias |
| :--- | :--- |
| **Frontend** | React 19, Vite 7, Material-UI v7 |
| **Estilo** | Fonte Sora, tema customizado com cores CESMAC |
| **Backend / DB** | Firebase Firestore, Auth, Hosting (plano Spark — gratuito) |
| **Integrações** | Telegram Bot API |
| **Visualização** | Chart.js, React-Chartjs-2 |
| **Utilitários** | Day.js, @dnd-kit, File-saver, XLSX, Framer Motion |

---

## Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/luizedu0494/cronograma-lab-frontend.git
cd cronograma-lab-frontend

# 2. Instale as dependências
npm install

# 3. Execute localmente
npm run dev
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
# Telegram (opcional)
VITE_TELEGRAM_BOT_TOKEN=seu_token
VITE_TELEGRAM_CHAT_ID=id_do_chat
```

As configurações do Firebase já estão em `src/firebaseConfig.jsx`.

---

## Deploy

```bash
# Build de produção
npm run build

# Preview isolado (sem afetar o site principal)
firebase hosting:channel:deploy preview-teste --expires 7d

# Deploy para produção
firebase deploy --only hosting
```

---

## Contribuição

1. Faça um **Fork** do projeto
2. Crie uma **Branch** (`git checkout -b feature/MinhaFeature`)
3. Faça o **Commit** (`git commit -m 'feat: MinhaFeature'`)
4. Faça o **Push** (`git push origin feature/MinhaFeature`)
5. Abra um **Pull Request**

---

<div align="center">
  Desenvolvido por <strong>Luiz Eduardo</strong> para o CESMAC — Centro Universitário de Maceió
  <br/><br/>
  <a href="https://github.com/luizedu0494">GitHub</a>
</div>
