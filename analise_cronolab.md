# 📊 Análise Técnica — CronoLab Frontend

> Análise completa do projeto, pontos de atenção, sugestões de melhorias e plano de migração para TypeScript.

---

## 1. Visão Geral do Projeto

| Item | Detalhe |
|---|---|
| **Nome** | CronoLab — Cronograma de Laboratórios |
| **Stack principal** | React 19 + Vite 7 + MUI v7 + Firebase (Firestore + Auth + Hosting) |
| **IA integrada** | Groq (via API `/api/groq.js`) + módulo `ia-estruturada/` próprio |
| **Notificações** | Telegram + Firebase Push (FCM) |
| **Deploy** | Firebase Hosting + CI/CD via GitHub Actions |
| **Linguagem** | JavaScript (JSX) — sem tipagem estática |

---

## 2. Pontos Positivos ✅

- **Arquitetura modular** bem segmentada: `components/`, `hooks/`, `services/`, `utils/`, `constants/`, `ia-estruturada/`
- **CI/CD configurado** via GitHub Actions com deploy automático em PRs
- **Módulo de IA próprio** com classificador de intenção, extrator de parâmetros e executor de ações — estrutura sólida
- **Hooks customizados** (`useFetchAulas`, `useUsageCounter`) promovendo reúso de lógica
- **Logger centralizado** (`loggerService.js`) — boa prática para rastreabilidade
- **Monitor de uso** (`UsageMonitor.jsx`) com controle de limite diário de leitura Firestore

---

## 3. Problemas e Pontos de Atenção ⚠️

### 3.1 Estrutura de Arquivos

| Problema | Arquivo(s) |
|---|---|
| **Arquivos `.jsx` com papel de `.js`** | `api/save-push-token.jsx`, `api/send-notification.jsx`, `functions/index.jsx`, `public/firebase-messaging-sw.jsx` |
| **Service Worker com extensão errada** | `firebase-messaging-sw.jsx` deveria ser `.js` — o browser pode não reconhecer como SW |
| **Mistura de responsabilidades** | `src/` contém páginas, componentes e utilitários sem separação clara de `pages/` |
| **Excesso de docs na raiz** | 10+ arquivos `.md` soltos na raiz (`ALTERACOES_IMPLEMENTADAS.md`, `MUDANCAS_IMPLEMENTADAS.md`, etc.) — dificulta navegação |

### 3.2 Qualidade de Código

| Problema | Impacto |
|---|---|
| **Sem TypeScript** | Sem contratos de tipo entre módulos — bugs silenciosos em dados do Firestore |
| **Sem ESLint/Prettier configurados explicitamente** | Não há `.eslintrc` ou `.prettierrc` no arquivo de estrutura |
| **`vite.config.jsx`** | Deveria ser `.js` ou `.ts` — `jsx` é inadequado para config |
| **Arquivos de teste misturados** | `App.test.jsx` e `NotificadorTelegram.test.js` sem pasta `__tests__/` dedicada |
| **`testes.js` informal** | Arquivo de testes manual em `ia-estruturada/testes.js` sem framework |

### 3.3 Segurança

| Problema | Risco |
|---|---|
| **`firebaseConfig.js` exposto** | Credenciais do Firebase devem estar em variáveis de ambiente (`.env`) |
| **Chave Groq em `api/groq.js`** | Verificar se a API key não está hardcoded — deveria estar em `process.env` |
| **`firestore.rules`** | Não foi possível analisar o conteúdo, mas regras abertas são risco crítico |

### 3.4 Performance

| Problema | Sugestão |
|---|---|
| **Componentes grandes sem lazy loading** | `GerenciarAulasAvancado`, `AnaliseEstatisticas`, `ImportarCronograma` provavelmente pesados |
| **Sem `React.memo` explícito** | Cards e listas rederizadas em loop devem memoizar |
| **`useFetchAulas` centralizado** | Verificar se não está realizando múltiplas assinaturas Firestore simultaneamente |

---

## 4. Sugestões de Melhoria 🚀

### 4.1 Reorganização de Pastas (estrutura recomendada)

```
src/
├── pages/              ← telas principais (App.jsx atual vira roteador aqui)
│   ├── Cronograma/
│   ├── Gerenciar/
│   └── IA/
├── components/         ← componentes reutilizáveis (já existe, manter)
├── hooks/              ← hooks customizados (já existe, expandir)
├── services/           ← Firebase, Groq, Telegram (já existe)
├── stores/             ← estado global (Zustand ou Context)
├── types/              ← interfaces TypeScript (novo)
├── constants/          ← já existe
└── utils/              ← já existe

docs/                   ← mover todos os .md da raiz para cá
api/                    ← manter, corrigir extensões
```

### 4.2 Lazy Loading de Rotas

```jsx
// Antes
import GerenciarAulasAvancado from './GerenciarAulasAvancado';

// Depois
const GerenciarAulasAvancado = React.lazy(() =>
  import('./pages/Gerenciar/GerenciarAulasAvancado')
);
```

### 4.3 Variáveis de Ambiente

```js
// firebaseConfig.ts (após migração)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ...
};
```

### 4.4 Centralizar Tipos de Dados (preparação para TS)

Mesmo antes da migração completa, criar um arquivo `src/types/index.ts` com os modelos:

```ts
export interface Aula {
  id: string;
  disciplina: string;
  professor: string;
  laboratorio: string;
  dataInicio: Date;
  dataFim: Date;
  status: 'agendada' | 'confirmada' | 'cancelada';
  turma: string;
}

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'tecnico' | 'professor' | 'aluno';
}

export interface Periodo {
  id: string;
  nome: string;
  inicio: Date;
  fim: Date;
  ativo: boolean;
}
```

### 4.5 Tratamento de Erros Global

Adicionar um `ErrorBoundary` global e handler centralizado para erros do Firestore:

```tsx
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) return <PaginaDeErro erro={this.state.error} />;
    return this.props.children;
  }
}
```

---

## 5. Plano de Migração para TypeScript 🔄

A migração deve ser **incremental** — não há necessidade de reescrever tudo de uma vez. O projeto usa Vite, o que torna a adoção de TS muito simples.

### Fase 0 — Preparação (1–2 dias)

```bash
# Instalar TypeScript e tipos
npm install -D typescript @types/react @types/react-dom

# Gerar tsconfig
npx tsc --init
```

**`tsconfig.json` recomendado para o projeto:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

> `"allowJs": true` permite que arquivos `.js` e `.jsx` convivam com `.ts` e `.tsx` durante a transição — você migra um por um, sem quebrar o projeto.

---

### Fase 1 — Tipos e Constantes (3–5 dias)

Começar pelos arquivos mais simples e sem dependências de UI:

| Arquivo atual | Ação |
|---|---|
| `src/constants/cursos.jsx` | Renomear para `cursos.ts`, tipar o array |
| `src/constants/laboratorios.jsx` | Renomear para `laboratorios.ts`, tipar |
| `src/utils/dateHelper.js` | Renomear para `dateHelper.ts`, tipar funções |
| `src/utils/aulaQueries.js` | Renomear para `aulaQueries.ts`, tipar queries Firestore |
| `src/utils/analiseCronograma.js` | Renomear para `analiseCronograma.ts` |
| `src/services/loggerService.js` | Renomear para `loggerService.ts` |

**Exemplo de migração de `cursos.jsx` → `cursos.ts`:**

```ts
// Antes (cursos.jsx)
export const CURSOS = ['Sistemas de Informação', 'Enfermagem', ...]

// Depois (cursos.ts)
export type Curso = {
  id: string;
  nome: string;
  codigo: string;
};

export const CURSOS: Curso[] = [
  { id: 'si', nome: 'Sistemas de Informação', codigo: 'SI' },
  // ...
];
```

---

### Fase 2 — Módulo `ia-estruturada/` (3–5 dias)

Este módulo é puramente lógico (sem UI), tornando-o ideal para migração antecipada:

| Arquivo | Tipo após migração |
|---|---|
| `ClassificadorIntencao.js` | `.ts` com tipo `Intencao` |
| `ExtratorParametros.js` | `.ts` com tipo `Parametros` |
| `ExecutorAcoes.js` | `.ts` com tipo `AcaoResult` |
| `ProcessadorConsultas.js` | `.ts` com retorno tipado |
| `ConsultaEstruturada.jsx` | `.tsx` — última desta fase |

```ts
// types/ia.ts
export type Intencao =
  | 'consultar_aulas'
  | 'verificar_disponibilidade'
  | 'agendar_laboratorio'
  | 'cancelar_aula'
  | 'desconhecida';

export interface ConsultaIA {
  texto: string;
  intencao: Intencao;
  parametros: Record<string, unknown>;
  confianca: number;
}

export interface ResultadoIA {
  sucesso: boolean;
  mensagem: string;
  dados?: unknown;
}
```

---

### Fase 3 — Serviços e Hooks (3–5 dias)

| Arquivo | Tipo |
|---|---|
| `src/services/NotificadorTelegram.js` | `.ts` |
| `src/hooks/useFetchAulas.jsx` | `.tsx` com retorno tipado |
| `src/utils/usageIncrementer.js` | `.ts` |
| `src/utils/useUsageCounter.jsx` | `.tsx` |
| `src/AuthContext.jsx` | `.tsx` — tipagem do contexto |

**Exemplo de `useFetchAulas.tsx`:**

```tsx
import { useState, useEffect } from 'react';
import { Aula } from '@/types';

interface UseFetchAulasReturn {
  aulas: Aula[];
  loading: boolean;
  erro: Error | null;
}

export const useFetchAulas = (laboratorioId: string): UseFetchAulasReturn => {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<Error | null>(null);
  // ...
  return { aulas, loading, erro };
};
```

---

### Fase 4 — Componentes (1–2 semanas)

Migrar componentes do menor para o maior. Sugestão de ordem:

1. `components/DialogConfirmacao.jsx` → `.tsx`
2. `components/EmptyState.jsx` → `.tsx`
3. `components/EventoCard.jsx` → `.tsx`
4. `components/UsageMonitor.jsx` → `.tsx`
5. `AulaCard.jsx` → `.tsx`
6. `PainelAvisos.jsx` → `.tsx`
7. Demais páginas em ordem crescente de complexidade

---

### Fase 5 — Finalização (2–3 dias)

```json
// tsconfig.json — ativar strict ao final
{
  "compilerOptions": {
    "strict": true,
    "allowJs": false,
    "checkJs": false
  }
}
```

- Remover `allowJs` e `checkJs`
- Renomear `vite.config.jsx` → `vite.config.ts`
- Configurar `path aliases` definitivos
- Rodar `tsc --noEmit` e corrigir todos os erros restantes

---

## 6. Checklist de Melhorias Prioritárias 📋

### 🔴 Crítico (fazer agora)

- [ ] Mover credenciais Firebase para `.env` / variáveis Vite (`VITE_*`)
- [ ] Corrigir extensão do `firebase-messaging-sw.jsx` → `.js`
- [ ] Corrigir extensão de `api/*.jsx` → `.js`
- [ ] Corrigir `vite.config.jsx` → `vite.config.js`
- [ ] Verificar e endurecer `firestore.rules`

### 🟡 Importante (próximas sprints)

- [ ] Adicionar `React.lazy` nas rotas principais
- [ ] Criar `src/pages/` e mover telas para lá
- [ ] Consolidar documentação em `docs/` (limpar raiz)
- [ ] Configurar ESLint + Prettier (`.eslintrc.js` + `.prettierrc`)
- [ ] Instalar TypeScript e iniciar Fase 1 da migração

### 🟢 Nice to have

- [ ] Adicionar Vitest para substituir testes manuais em `testes.js`
- [ ] Criar `ErrorBoundary` global
- [ ] Adicionar Zustand para estado global (substituir Context espalhado)
- [ ] Implementar PWA offline-first com Workbox

---

## 7. Estimativa de Esforço da Migração TypeScript

| Fase | Escopo | Estimativa |
|---|---|---|
| 0 — Preparação | Config TS + tsconfig | 1–2 dias |
| 1 — Tipos e Constantes | 6 arquivos simples | 3–5 dias |
| 2 — Módulo IA | 6 arquivos de lógica pura | 3–5 dias |
| 3 — Serviços e Hooks | 5 arquivos | 3–5 dias |
| 4 — Componentes | ~35 componentes/telas | 10–15 dias |
| 5 — Finalização | strict mode + cleanup | 2–3 dias |
| **Total** | | **~22–35 dias úteis** |

> 💡 **Dica:** A migração pode ser feita em paralelo com o desenvolvimento normal. Como `allowJs: true` está ativo nas fases iniciais, arquivos JS e TS coexistem sem problemas. Recomenda-se migrar no mínimo as **Fases 0, 1 e 2** antes de qualquer nova feature grande.

---

## 8. Referências Rápidas

- [Migração incremental oficial — React + TS](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)
- [Vite com TypeScript](https://vitejs.dev/guide/features#typescript)
- [Firebase SDK com TypeScript](https://firebase.google.com/docs/web/setup#typescript)
- [MUI com TypeScript](https://mui.com/material-ui/guides/typescript/)
