# CronoLab — Cronograma de Laboratórios

> Sistema de gestão de cronogramas e agendamentos para os laboratórios do **Centro Universitário CESMAC**, Maceió — AL.

![Banner](./imgbanner.png)

<p align="center">
  <img src="./src/assets/images/cesmac-logo.png" alt="CESMAC" height="48"/>
</p>

<p align="center">
  <a href="#sobre">Sobre</a> •
  <a href="#novidades-v2">Novidades v2 & Arquitetura</a> •
  <a href="#demonstrações">Demonstrações</a> •
  <a href="#perfis-de-acesso">Perfis</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#tecnologias">Tecnologias</a> •
  <a href="#instalação">Instalação</a>
</p>

<p align="center">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-Firebase%20Hosting-FFCA28?style=flat&logo=firebase&logoColor=black"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white"/>
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black"/>
  <img alt="MUI" src="https://img.shields.io/badge/MUI-v7-1E7EC8?style=flat&logo=mui&logoColor=white"/>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white"/>
  <img alt="ESLint" src="https://img.shields.io/badge/ESLint-configured-4B32C3?style=flat&logo=eslint&logoColor=white"/>
  <img alt="Prettier" src="https://img.shields.io/badge/Prettier-configured-F7B93E?style=flat&logo=prettier&logoColor=black"/>
</p>

<p align="center">
  <a href="https://cronolab-novo.web.app"><strong>🌐 Ver sistema online →</strong></a>
</p>

---

## Sobre

O **CronoLab** é um sistema web desenvolvido para resolver um problema real do dia a dia dos laboratórios do CESMAC: a gestão manual e descentralizada de agendamentos.

O sistema centraliza o cronograma de todos os laboratórios em uma única plataforma, com perfis distintos para coordenadores, técnicos e alunos. Substitui planilhas e processos manuais por um painel inteligente com verificação automática de conflitos, análise de ocupação e notificações em tempo real.

**Destaques:**
- 🏫 Desenvolvido para uso real no CESMAC — não é um projeto de demonstração
- ⚡ Roda 100% no plano gratuito do Firebase (Spark) — zero custo de infraestrutura
- 📱 Responsivo para desktop e celular
- 🌙 Dark mode com identidade visual da instituição
- 🤖 Assistente IA para consultas em linguagem natural sobre o cronograma
- 🛡️ Infraestrutura segura em variáveis de ambiente e código tipado em TypeScript

---

## Novidades v2 & v2.1 (Atualizações Recentes)

> Resumo das melhorias de arquitetura, limpeza de arquivos, segurança, UX/UI e recursos mobile/push implementados nesta versão.

### 🖼️ 1. Upload Inteligente de Imagens via Cloudinary
- **Componente Reutilizável (`UploadImagem.jsx`)**: Permite upload direto para CDN sem custo e sem depender do Firebase Storage (compatível 100% com plano Spark).
- **Foto de Perfil**: Usuários podem alterar seu avatar na página de configurações do perfil.
- **Calendário Acadêmico Editável**: O coordenador pode fazer upload de um novo banner do calendário ou editar a frase/título exibido na página inicial em tempo real.

### 🔔 2. Notificações Push Web (FCM - Firebase Cloud Messaging)
- **Ativação no Perfil**: Botão dinâmico no perfil com indicação visual de status (verde quando autorizado).
- **Alerta Informativo**: Instruções claras ao usuário sobre como permitir notificações no navegador (ícone 🔒 da URL).
- **Service Worker Compatível (`firebase-messaging-sw.js`)**: Integração síncrona com SDK v10 compat, capaz de receber notificações mesmo com o navegador/aba fechada.
- **Fallback Firestore Client-Side**: Armazenamento automático dos tokens na coleção `userTokens` / `fcmTokens` para envio de mensagens broadcast ou multicast via `firebase-admin`.

### 📱 3. PWA (Progressive Web App) & Suporte Mobile
- **Instalável no Celular**: Manifest atualizado (`manifest.json`) com ícones `maskable` e suporte a instalação como aplicativo nativo Android/iOS.
- **Banner de Instalação (`PromptInstalacaoPWA.jsx`)**: Prompt amigável convidando o usuário a adicionar o CronoLab à tela inicial do celular.

### 📅 4. Calendário Acadêmico Customizável (Coordenador)
- **Título & Frase Customizável**: Altere a frase de destaque do calendário diretamente na interface.
- **Permissão de Alunos (Switch)**: Chave liga/desliga funcional para liberar ou ocultar a visualização do calendário acadêmico para perfil de aluno.
- **Visualizador em Tela Cheia**: Suporte a Modal Fullscreen para leitura detalhada em dispositivos móveis e desktops.

---

## 🎨 Identidade Visual CESMAC

O sistema usa as cores institucionais do CESMAC extraídas diretamente do logo oficial:

| Token | Cor | Uso |
| :--- | :--- | :--- |
| **Azul principal** | `#1E7EC8` | Botões, links, KPIs, navbar |
| **Azul claro** | `#4AADE8` | Destaques, chips, dark mode |
| **Dourado** | `#F5C518` / `#D4940A` | Revisões, alertas, avisos |

A fonte utilizada é **Sora** — legível no mobile e com personalidade acadêmica.
O dark mode usa fundo **azul-marinho profundo** (`#0B0F18`).

---

## 🛠️ Tecnologias

- **Frontend**: React 19, TypeScript 5, Vite 7, Material UI (MUI v7), DayJS, Lucide React, Chart.js.
- **Backend / Serverless**: Firebase Firestore, Firebase Auth, Firebase Hosting, Vercel Serverless Functions (`/api/groq.js`).
- **IA**: Groq API (`llama-3.3-70b-versatile`) + Módulo local de IA Estruturada.
- **Qualidade & Tooling**: ESLint, Prettier, TypeScript Compiler (`tsc`).

---

## 📦 Instalação e Execução Local

```bash
# 1. Clonar o repositório
git clone https://github.com/luizedu0494/cronograma-lab-frontend.git
cd cronograma-lab-frontend

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Preencha suas chaves do Firebase e Groq no arquivo .env

# 4. Rodar servidor de desenvolvimento
npm run dev

# 5. Outros Comandos Utilitários
npm run build      # Compila o bundle para produção na pasta dist/
npm run lint       # Executa verificação do ESLint
npm run format     # Formata todo o código com Prettier
npx tsc --noEmit   # Valida a tipagem estática sem emitir arquivos
```

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
