<div align="center">

🧪 Cronograma Lab

Sistema Inteligente de Gestão Acadêmica

<p align="center">
<a href="#-sobre">Sobre</a> •
<a href="#-funcionalidades">Funcionalidades</a> •
<a href="#-screenshots">Screenshots</a> •
<a href="#-tecnologias">Tecnologias</a> •
<a href="#-instalação">Instalação</a>
</p>

</div>

🎯 Sobre

O Cronograma Lab é uma plataforma web desenvolvida para revolucionar o agendamento de laboratórios em instituições de ensino.

Mais do que um simples calendário, o sistema evoluiu para uma ferramenta de Business Intelligence (BI), integrando Inteligência Artificial (Llama 3.3) para análise de dados e Notificações via Telegram, garantindo que coordenadores e professores tenham insights estratégicos e comunicação em tempo real.

📸 Screenshots

<div align="center">
<img src="https://www.google.com/search?q=https://via.placeholder.com/800x400%3Ftext%3DDashboard%2Bcom%2BAnalise%2Bde%2BIA" alt="Dashboard do Cronograma Lab" width="700"/>





<em>Painel Principal com Gráficos e Assistente de IA</em>
</div>

✨ Funcionalidades

🤖 Inovação e Inteligência (Fase 5 - NEW!)

Funcionalidade

Descrição

Impacto

🧠 Assistente IA

NLP integrada ao Dashboard. Pergunte: "Qual a taxa de ocupação este mês?" e receba gráficos instantâneos.

Elimina a criação manual de relatórios.

🔍 Busca "Fuzzy"

Busca inteligente que entende contexto (ex: "anatômia" encontra "Lab. Anatomia").

Melhora a UX de pesquisa drasticamente.

📱 Bot Telegram 2.0

Notificações automáticas com links diretos para o calendário no momento da ação.

Comunicação instantânea com a coordenação.

🔮 Predição de Ociosidade

A IA identifica laboratórios subutilizados e sugere otimizações.

Melhor aproveitamento de recursos físicos.

📊 Dashboard e Gestão

Análise de Dados: Métricas de Proposta vs. Aprovação, uso por turno e curso.

Exportação .ICS: Integração nativa com Google Calendar, Outlook e Apple Calendar.

Gestão de Feriados: Bloqueio automático de dias não letivos nacionais e locais.

🚀 Experiência do Usuário (UX)

Filtros Dinâmicos: Refinamento por status, laboratório e curso em tempo real.

Mapa de Calor: Visualização rápida de horários de pico.

Drag-and-Drop: Reagendamento intuitivo arrastando cards no calendário.

Real-time: Sincronização instantânea via WebSocket (Firestore).

🛠️ Tecnologias

O projeto foi construído utilizando as melhores práticas de desenvolvimento moderno:

Categoria

Tecnologias

Frontend

React (CRA), Material-UI (MUI), Context API

Backend / DB

Firebase (Firestore, Auth, Hosting)

Inteligência Artificial

Groq API (Model: Llama 3.3 70b Versatile)

Integrações

Telegram Bot API, Google Calendar Export

Visualização de Dados

Chart.js, React-Chartjs-2

Utilitários

Day.js, @dnd-kit, File-saver, XLSX

📂 Estrutura do Projeto

cronograma-lab/
├── public/
├── src/
│   ├── components/      # Componentes reutilizáveis (Botões, Modais)
│   ├── contexts/        # Gerenciamento de estado global (Auth, Theme)
│   ├── hooks/           # Custom Hooks (useAuth, useFirestore)
│   ├── pages/           # Páginas da aplicação (Dashboard, Agenda)
│   ├── services/        # Integrações (API Groq, Telegram, Firebase)
│   ├── styles/          # Estilização global e temas MUI
│   └── utils/           # Funções auxiliares e formatadores
└── ...


⚙️ Instalação

Siga os passos abaixo para rodar o projeto localmente:

1. Clone o repositório

git clone [https://github.com/luizedu0494/cronograma-lab-frontend.git](https://github.com/luizedu0494/cronograma-lab-frontend.git)
cd cronograma-lab-frontend


2. Instale as dependências

npm install


3. Configure as Variáveis de Ambiente

Crie um arquivo .env na raiz e preencha com suas chaves:

# Firebase
REACT_APP_FIREBASE_API_KEY=seu_api_key
REACT_APP_FIREBASE_PROJECT_ID=seu_project_id
# ... (outras configs do firebase)

# Integrações Inteligentes
REACT_APP_TELEGRAM_BOT_TOKEN=seu_token_telegram
REACT_APP_TELEGRAM_CHAT_ID=id_chat_destino
REACT_APP_GROQ_API_KEY=sua_chave_groq


4. Execute o projeto

npm start


🚀 Deploy

Para publicar a aplicação em produção no Firebase Hosting:

# 1. Gerar build otimizado
npm run build

# 2. Enviar para o servidor
firebase deploy --only hosting


🤝 Contribuição

Contribuições são sempre bem-vindas!

Faça um Fork do projeto.

Crie uma Branch para sua feature (git checkout -b feature/MinhaFeature).

Faça o Commit (git commit -m 'Adicionando MinhaFeature').

Faça o Push (git push origin feature/MinhaFeature).

Abra um Pull Request.

<div align="center">

Desenvolvido  por Luiz Eduardo

GitHub

</div>
