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

## Novidades v2 & Reestruturação Técnica

> Resumo das melhorias de arquitetura, limpeza de arquivos, segurança e UX/UI implementadas nesta versão com base na análise técnica.

### 🛡️ 1. Segurança e Variáveis de Ambiente
- **Ambiente Isolado**: Remoção de chaves hardcoded e introdução dos arquivos `.env` e `.env.example`.
- **Firebase & Groq**: Configuração dinâmica via `import.meta.env` com prefixos `VITE_`.

### 📂 2. Reorganização Arquitetural & Limpeza de Arquivos Mortos
- **Roteamento de Telas (`src/pages/`)**:
  - `src/pages/Cronograma/`: `PaginaInicial`, `CalendarioCronograma`, `HistoricoAulas`, `CalendarioRevisoesTecnico`.
  - `src/pages/Gerenciar/`: `GerenciarAprovacoes`, `GerenciarUsuarios`, `GerenciarAvisos`, `GerenciarPeriodos`, `AnaliseAulas`, `AnaliseEventos`, `VerificarIntegridadeDados`.
  - `src/pages/IA/`: `AssistenteIA`.
  - `src/pages/Perfil/`: `ConfiguracoesPerfil`.
- **Limpeza de Arquivos Desnecessários**:
  - Removidos arquivos mortos do template inicial (`App.css`, `logo.svg`).
  - Movidos os 11 arquivos de documentação Markdown soltos na raiz para a pasta [docs/](./docs/).
  - Isolamento de suíte e testes manuais na pasta dedicada `src/__tests__/` (`App.test.jsx`, `NotificadorTelegram.test.js`, `testes_ia_manual.js`, `setupTests.js`).
  - Correção de extensões: `vite.config.js`, `public/firebase-messaging-sw.js`, `index.js`, `theme.js`, `api/*.js`.

### ⚙️ 3. Adoção Incremental do TypeScript & Qualidade
- **Tipagem Estática**: Introdução do `tsconfig.json` (com suporte gradual a arquivos JS/TS) e [src/types/index.ts](./src/types/index.ts).
- **Módulos Migrados**:
  - **Constantes**: `cursos.ts` e `laboratorios.ts`.
  - **Motor de IA**: `ClassificadorIntencao.ts`, `ExtratorParametros.ts`, `ProcessadorConsultas.ts` e `ExecutorAcoes.ts`.
  - **Serviços & Hooks**: `loggerService.ts`, `NotificadorTelegram.ts` e `useFetchAulas.tsx`.
  - **UI Base**: `DialogConfirmacao.tsx`, `EmptyState.tsx` e `UsageMonitor.tsx`.
- **Padronização**: Configuração do ESLint ([eslint.config.js](./eslint.config.js)) e Prettier ([.prettierrc](./.prettierrc)), com scripts `npm run lint` e `npm run format`.

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
