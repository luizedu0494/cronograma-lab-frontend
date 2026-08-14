# 🔬 Análise Técnica & Melhorias — CronoLab (Plano Firebase Spark)

> Análise baseada no código-fonte real do projeto: `package.json`, `firestore.rules`, `vite.config.js`, `App.jsx`, `AssistenteIATecnico.jsx`, `api/`, `docs/` e demais arquivos.
> Todas as sugestões respeitam o limite do **Firebase Spark (gratuito)** — sem Cloud Functions, sem upgrade de plano.

---

## 1. Diagnóstico Geral

| Dimensão | Situação Atual | Nível |
|---|---|:---:|
| Arquitetura | Modular, bem segmentada, lazy loading nas rotas | ✅ |
| Segurança | `VITE_GROQ_API_KEY` exposta no bundle; SW com credenciais hardcoded | ⚠️ |
| IA | Motor híbrido (local + Groq) — decisão sólida | ✅ |
| Qualidade de código | JS + JSX misturado; TypeScript com `strict: false`; sem testes relevantes | ⚠️ |
| Performance | `manualChunks` genérico; pacotes pesados sem code splitting por feature | ⚠️ |
| Bundle size | `@xenova/transformers`, `brain.js`, `exceljs`, `mammoth`, `tesseract.js` carregam juntos | ❌ |
| PWA | `manifest.json` correto; SW configurado; FCM funcional | ✅ |
| Custo infra | 100% Spark — sem Cloud Functions ativas | ✅ |

---

## 2. Problemas Identificados no Código

### 2.1 Segurança

**Problema crítico: API Keys expostas no bundle**

`VITE_*` variáveis são embutidas pelo Vite no JavaScript público. Qualquer usuário pode abrir o DevTools e ler a `GROQ_API_KEY`.

```js
// AssistenteIATecnico.jsx — inseguro em produção
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
```

**Solução Spark-compatível:** O projeto já tem `/api/groq.js` na Vercel. Basta garantir que **todo o tráfego Groq passe pelo proxy** e remover a `VITE_GROQ_API_KEY` do `.env` do frontend. A chave deve existir apenas como variável de ambiente server-side na Vercel.

```js
// Correto — apenas no frontend:
const response = await fetch('/api/groq', { method: 'POST', body: JSON.stringify({ payload }) });
// GROQ_API_KEY fica apenas nas env vars da Vercel, nunca no .env do cliente
```

**Problema 2: Service Worker com credenciais hardcoded**

`public/firebase-messaging-sw.js` tem `apiKey`, `appId` e `messagingSenderId` no código:

```js
// Atual — credenciais expostas no arquivo público
firebase.initializeApp({
  apiKey: urlParams.get("apiKey") || "AIzaSyATwNg81vq-nBJTWB_0cnhMDBuhfxYmWJA",
  ...
});
```

**Solução:** Usar o endpoint automático do Firebase Hosting:

```js
// Substituir por:
importScripts('/__/firebase/init.js'); // injetado pelo Firebase Hosting em produção
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
const messaging = firebase.messaging();
```

### 2.2 Performance e Bundle

**Problema: Pacotes pesados sem lazy loading**

O `vite.config.js` tem um `manualChunks` genérico que joga tudo em `vendor`. Pacotes como `@xenova/transformers` (~50MB não minificado), `tesseract.js`, `brain.js` e `mammoth` são carregados na inicialização, mesmo para usuários que nunca usam OCR ou predição.

```js
// vite.config.js atual — todos os node_modules em um chunk só
manualChunks(id) {
  if (id.includes('node_modules')) return 'vendor';
}
```

**Solução — code splitting por feature:**

```js
// vite.config.js melhorado
manualChunks(id) {
  if (id.includes('@xenova/transformers'))  return 'ai-embeddings';
  if (id.includes('tesseract.js'))          return 'ocr';
  if (id.includes('brain.js'))              return 'ml';
  if (id.includes('mammoth'))               return 'docx-parser';
  if (id.includes('exceljs') || id.includes('xlsx') || id.includes('papaparse')) return 'spreadsheet';
  if (id.includes('jspdf'))                 return 'pdf';
  if (id.includes('framer-motion'))         return 'animation';
  if (id.includes('@mui'))                  return 'ui';
  if (id.includes('langchain') || id.includes('@langchain')) return 'langchain';
  if (id.includes('firebase'))              return 'firebase';
  if (id.includes('node_modules'))          return 'vendor';
}
```

**Problema 2: Dependências duplicadas**

O projeto tem `date-fns` e `dayjs` instalados simultaneamente. Ambas fazem a mesma coisa. O projeto usa `dayjs` em todo o código — `date-fns` pode ser removido.

```bash
npm uninstall date-fns
```

**Problema 3: `fontsource-inter` instalado mas não usado**

O projeto usa a fonte `Sora` via Google Fonts no `index.html`. `fontsource-inter` pode ser removido.

```bash
npm uninstall fontsource-inter
```

### 2.3 Qualidade de Código

**Problema: `tsconfig.json` com `strict: false`**

O TypeScript está configurado de forma permissiva demais:

```json
{
  "strict": false,
  "allowJs": true,
  "checkJs": false
}
```

Isso anula grande parte do valor do TypeScript. Com `strict: false`, `null` e `undefined` não são checados, tipos `any` proliferam silenciosamente.

**Solução gradual:**

```json
// Fase 1 — agora
{ "strict": false, "allowJs": true, "checkJs": false, "noImplicitAny": true }

// Fase 2 — após migrar os services
{ "strict": false, "allowJs": true, "checkJs": false, "strictNullChecks": true }

// Fase 3 — ao finalizar a migração
{ "strict": true, "allowJs": false }
```

**Problema: ESLint sem regras para imports**

O `eslint.config.js` atual não tem `eslint-plugin-import` nem `eslint-plugin-react-refresh`. Imports de módulos inexistentes ou circulares passam despercebidos.

```bash
npm install -D eslint-plugin-import eslint-plugin-react-refresh
```

```js
// eslint.config.js — adicionar
import importPlugin from 'eslint-plugin-import';
import reactRefresh from 'eslint-plugin-react-refresh';

// nas regras:
'import/no-duplicates': 'warn',
'react-refresh/only-export-components': 'warn',
```

**Problema: Listener com cleanup inconsistente em GerenciarAprovacoes**

`fetchAulasDoMes` como `useCallback` retorna um `unsubscribe`, mas o cleanup depende de como o chamador gere o retorno. Pattern mais seguro:

```js
// Substituir useCallback + chamada manual por useEffect com cleanup embutido
useEffect(() => {
  const q = query(collection(db, 'aulas'), ...constraints);
  const unsub = onSnapshot(q, snap => setAulasDoMes(...));
  return () => unsub(); // cleanup garantido
}, [selectedMonth, selectedYear]);
```

---

## 3. Frameworks e Bibliotecas Recomendados (100% Spark)

### 3.1 Gerenciamento de Estado — Zustand

**Por que:** O projeto usa props drilling e Context espalhado. Com mais de 30 componentes, isso gera re-renders desnecessários e código difícil de rastrear.

**Custo Spark:** $0 — roda 100% no cliente.

```bash
npm install zustand
```

```ts
// src/stores/aulaStore.ts
import { create } from 'zustand';

interface AulaStore {
  aulasHoje: Aula[];
  pendingCount: number;
  setAulasHoje: (aulas: Aula[]) => void;
}

export const useAulaStore = create<AulaStore>((set) => ({
  aulasHoje: [],
  pendingCount: 0,
  setAulasHoje: (aulas) => set({ aulasHoje: aulas }),
}));
```

**Impacto imediato:** Elimina o prop drilling de `userInfo` e `currentUser` que passa por 15+ componentes hoje.

---

### 3.2 Validação de Formulários — React Hook Form + Zod

**Por que:** `ProporAulaForm`, `ProporEventoForm` e os formulários de gestão têm validação manual espalhada. React Hook Form + Zod centralizam isso com tipagem automática.

**Custo Spark:** $0 — client-side.

```bash
npm install react-hook-form zod @hookform/resolvers
```

```ts
// Exemplo para ProporAulaForm
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  assunto: z.string().min(3, 'Mínimo 3 caracteres'),
  laboratorio: z.string().min(1, 'Selecione um laboratório'),
  horario: z.enum(['07:00-09:10', '09:30-12:00', '13:00-15:10', '15:30-18:00', '18:30-20:10', '20:30-22:00']),
  data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato: DD/MM/AAAA'),
  cursos: z.array(z.string()).min(1, 'Selecione ao menos um curso'),
});

type PropostaForm = z.infer<typeof schema>;
```

**Benefício direto:** O `ExtratorParametros.ts` da IA pode usar os mesmos schemas Zod para validar dados extraídos antes de criar propostas.

---

### 3.3 Queries Firestore — TanStack Query (React Query)

**Por que:** Hoje o projeto tem múltiplos `useEffect` com `getDocs`/`onSnapshot` sem cache. TanStack Query adiciona cache, deduplicação de requests, stale-while-revalidate e loading states consistentes.

**Custo Spark:** $0 — reduz leituras por evitar re-fetches desnecessários (benefício direto para o limite Spark).

```bash
npm install @tanstack/react-query
```

```ts
// src/hooks/useAulas.ts
import { useQuery } from '@tanstack/react-query';

export const useAulasHoje = () =>
  useQuery({
    queryKey: ['aulas', 'hoje'],
    queryFn: () => fetchAulasFirebase({ data: dayjs().format('DD/MM/YYYY') }),
    staleTime: 5 * 60 * 1000, // 5 minutos — reduz leituras Firestore
  });
```

**Impacto no Spark:** Com `staleTime` configurado, o mesmo dado não é refetchado em cada re-render. Isso pode reduzir as leituras diárias em até 40% dependendo do padrão de uso.

---

### 3.4 Notificações In-App — React Hot Toast (já instalado) → mover para Sonner

**Por que:** `react-hot-toast` está instalado, mas o projeto usa `MUI Snackbar` em alguns componentes e `react-hot-toast` em outros. Inconsistência visual.

**Recomendação:** Manter `react-hot-toast` como padrão único e remover os `Snackbar` do MUI espalhados, ou migrar para `sonner` (mais moderno, suporte a `promise` nativo).

```bash
npm install sonner
npm uninstall react-hot-toast
```

```tsx
// App.jsx — adicionar uma vez
import { Toaster } from 'sonner';
<Toaster position="bottom-right" theme={darkMode ? 'dark' : 'light'} />

// Em qualquer componente — simples
import { toast } from 'sonner';
toast.success('Proposta enviada!');
toast.promise(salvarProposta(), {
  loading: 'Salvando...',
  success: 'Proposta criada!',
  error: 'Erro ao salvar',
});
```

---

### 3.5 Testes — Vitest + Testing Library

**Por que:** O projeto tem ~40 componentes, 2 arquivos de teste e nenhum teste de integração. Fluxos críticos (login, aprovação, criação de proposta) são testados apenas em produção.

**Custo Spark:** $0 — testes rodam localmente/CI.

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

```ts
// vite.config.js — adicionar
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/setupTests.ts',
}
```

**Testes prioritários:**

```ts
// 1. Classificador de intenção da IA
test('classifica "propor aula amanhã" como ação propor', () => {
  expect(classificarIntencao('propor aula amanhã')).toBe('propor');
});

// 2. Extrator de parâmetros
test('extrai data relativa "amanhã" corretamente', () => {
  const params = extrairParametros('aula amanhã às 13h');
  expect(params.data).toBe(dayjs().add(1, 'day').format('DD/MM/YYYY'));
});

// 3. Detecção de conflito
test('detecta conflito no mesmo laboratório e horário', async () => {
  const conflito = await verificarConflito({ lab: 'Anatomia 1', horario: '07:00-09:10', data: '20/01/2026' });
  expect(conflito).toBe(true);
});
```

---

### 3.6 Recharts (já no `package.json` via `react-chartjs-2`) → Consolidar

**Problema:** O projeto usa `Chart.js + react-chartjs-2`. `recharts` é listado como dependência disponível nos Artifacts mas não aparece instalado. Verificar se há duplicidade.

**Recomendação:** Manter apenas `recharts` — API mais moderna, tree-shakeable, sem registro manual de componentes.

```bash
npm install recharts
npm uninstall chart.js react-chartjs-2
```

```tsx
// Antes (Chart.js) — registro manual obrigatório
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Depois (recharts) — zero boilerplate
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
<BarChart data={aulasPorMes}>
  <Bar dataKey="total" fill="#1E7EC8" />
  <XAxis dataKey="mes" />
  <Tooltip />
</BarChart>
```

---

### 3.7 Workbox — PWA Offline Inteligente

**Por que:** O PWA já está configurado, mas o service worker atual só trata FCM. Workbox adiciona cache estratégico de assets, fontes e dados do Firestore.

**Custo Spark:** $0 — processamento client-side.

```bash
npm install -D vite-plugin-pwa
```

```js
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  strategies: 'generateSW',
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com/,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } }
      },
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com/,
        handler: 'NetworkFirst',
        options: { cacheName: 'firestore-cache', networkTimeoutSeconds: 3 }
      }
    ]
  }
})
```

**Benefício:** Com `NetworkFirst` no Firestore, o app mostra dados do cache quando offline e atualiza silenciosamente quando reconectar — sem escrever código extra.

---

## 4. Melhorias por Categoria

### 4.1 🔴 Críticas (fazer primeiro)

| # | Melhoria | Arquivo | Esforço |
|---|---|---|:---:|
| 1 | Remover `VITE_GROQ_API_KEY` do frontend — toda chamada Groq passa por `/api/groq` | `AssistenteIATecnico.jsx`, `.env` | Baixo |
| 2 | Migrar SW para `/__/firebase/init.js` | `firebase-messaging-sw.js` | Baixo |
| 3 | Code splitting por feature no Vite | `vite.config.js` | Baixo |
| 4 | Corrigir listener Firestore em `GerenciarAprovacoes` | `GerenciarAprovacoes.jsx` | Baixo |
| 5 | Remover `date-fns` e `fontsource-inter` não usados | `package.json` | Muito baixo |

### 4.2 🟡 Importantes (próximas sprints)

| # | Melhoria | Arquivo | Esforço |
|---|---|:---:|:---:|
| 6 | Instalar Zustand e centralizar `userInfo`/`pendingCount` | `src/stores/` | Médio |
| 7 | Instalar TanStack Query + migrar hooks de Firestore | `src/hooks/` | Médio |
| 8 | React Hook Form + Zod em `ProporAulaForm` e `ProporEventoForm` | Formulários | Médio |
| 9 | Ativar `noImplicitAny: true` no tsconfig | `tsconfig.json` | Baixo |
| 10 | Consolidar `NotificadorTelegram` em `src/services/` | `services/` | Baixo |
| 11 | Consolidar notificações em `sonner` (eliminar Snackbar MUI espalhado) | Global | Médio |
| 12 | Adicionar `eslint-plugin-import` | `eslint.config.js` | Baixo |

### 4.3 🟢 Melhorias de Produto (backlog)

| # | Melhoria | Impacto | Custo Spark |
|---|---|:---:|:---:|
| 13 | Workbox PWA offline inteligente | Alto | $0 |
| 14 | Recharts substituindo Chart.js | Médio | $0 |
| 15 | Vitest — testes do motor de IA | Alto | $0 |
| 16 | Chips de sugestão na IA do coordenador (já existe no técnico) | Médio | $0 |
| 17 | Rate limit client-side para chamadas Groq (contador em `sessionStorage`) | Médio | $0 |
| 18 | Campo `origem: 'ia'` nas propostas criadas pelo assistente | Baixo | $0 |
| 19 | `React.memo` nos cards de aula renderizados em loop | Médio | $0 |
| 20 | Skeleton loaders em todos os cards (substituir `CircularProgress`) | Médio | $0 |

---

## 5. Análise do Motor de IA

### O que está bem

O motor em `ia-estruturada/` tem uma separação de responsabilidades exemplar:

```
ClassificadorIntencao → ExtratorParametros → ExecutorAcoes → FormatadorResultados
```

A decisão de usar Groq apenas como fallback (com motor local de regras para casos simples) é tecnicamente madura e mantém o custo zero.

`AssistenteIATecnico.jsx` já implementa a ação `propor` com tela de confirmação antes de gravar no Firestore — exatamente o padrão correto de governança (técnico propõe, coordenador aprova).

### O que melhorar

**Memória de contexto:** As últimas 6 mensagens já são enviadas no histórico. Mas o `ProcessadorConsultas.ts` do coordenador pode não ter o mesmo mecanismo. Unificar:

```ts
// Padrão a seguir em ambos os assistentes
const ultimosTurnos = historicoMsgs.slice(-6).map(m => ({
  role: m.tipo === 'usuario' ? 'user' : 'assistant',
  content: m.texto
}));
```

**Rate limit client-side:** Sem controle, um usuário pode saturar o free tier da Groq (14.400 tokens/min). Proteção simples:

```ts
// src/utils/groqRateLimit.ts
const LIMITE_CHAMADAS_POR_MINUTO = 10;

export const verificarRateLimit = (): boolean => {
  const chave = 'groq_calls_' + Math.floor(Date.now() / 60000);
  const count = parseInt(sessionStorage.getItem(chave) || '0');
  if (count >= LIMITE_CHAMADAS_POR_MINUTO) return false;
  sessionStorage.setItem(chave, String(count + 1));
  return true;
};
```

**Modelo por complexidade:** Usar `llama-3.1-8b-instant` para classificação/extração e `llama-3.3-70b-versatile` apenas para análises abertas:

```ts
const modelo = intencao === 'analise_aberta' 
  ? 'llama-3.3-70b-versatile' 
  : 'llama-3.1-8b-instant';
```

---

## 6. Análise das Firestore Rules

As regras atuais estão bem estruturadas com funções auxiliares (`isCoordinator()`, `isTecnico()`) e cobrem as coleções principais.

**Ponto de atenção:** A função `userDoc()` faz um `get()` em cada validação de acesso:

```js
function userDoc() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
```

No Spark, cada `get()` nas rules **conta como uma leitura faturável**. Para coleções de alta escrita (como `logs`), isso pode multiplicar as leituras. Mitigação: usar `request.auth.token` para claims customizados (requer Firebase Auth custom claims — disponível no Spark).

**Alternativa sem custo extra:** Manter as regras atuais e monitorar com o `UsageMonitor.jsx` que já existe no projeto.

---

## 7. Dependências — Auditoria

### Remover (sem impacto)
| Pacote | Motivo |
|---|---|
| `date-fns` | Não usado — projeto usa `dayjs` |
| `fontsource-inter` | Não usado — projeto usa Sora via Google Fonts |
| `prop-types` | Redundante com TypeScript no projeto |

### Atualizar (verificar breaking changes)
| Pacote | Versão atual | Observação |
|---|---|---|
| `brain.js` | `2.0.0-beta.24` | Beta há anos — verificar se `neataptic` seria mais estável |
| `@xenova/transformers` | `2.17.2` | Versão 3 lançada como `@huggingface/transformers` — migrar quando estiver pronto |
| `xlsx` | `0.18.5` | Versão antiga com vulnerabilidades conhecidas — considerar `exceljs` (já instalado) como substituto |

### Adicionar (recomendados)
| Pacote | Finalidade | Custo |
|---|---|---|
| `zustand` | Estado global | $0 |
| `@tanstack/react-query` | Cache Firestore | $0 |
| `zod` | Validação de schemas | $0 |
| `react-hook-form` | Formulários | $0 |
| `sonner` | Notificações consistentes | $0 |
| `vite-plugin-pwa` | Workbox PWA | $0 |
| `vitest` | Testes | $0 |

---

## 8. Limites do Plano Spark — Mapa de Riscos

| Limite | Cota Gratuita | Situação CronoLab | Mitigação |
|---|---|---|---|
| Leituras Firestore | 50.000/dia | Monitorado com `useUsageCounter` ✅ | `staleTime` no TanStack Query |
| Gravações Firestore | 20.000/dia | Baixo risco (menos operações de escrita) | Log de ações da IA com campo único |
| Armazenamento | 1 GB | Apenas documentos JSON — baixíssimo uso | — |
| Largura de banda | 10 GB/mês | Assets no Firebase Hosting — monitorar | Workbox cache reduz requests |
| Cloud Functions | **NÃO disponível** | Já contornado com Vercel Serverless ✅ | Manter padrão atual |
| Firebase Auth | Ilimitado no Spark | — | — |

---

## 9. Roadmap Priorizado

```
Sprint 1 — Segurança e Performance (1 semana)
├── [ ] Remover VITE_GROQ_API_KEY do frontend
├── [ ] Migrar SW para /__/firebase/init.js
├── [ ] Code splitting no vite.config.js
├── [ ] Remover date-fns, fontsource-inter, prop-types
└── [ ] Corrigir listener GerenciarAprovacoes

Sprint 2 — Estado e Formulários (2-3 semanas)
├── [ ] Instalar Zustand + migrar userInfo/pendingCount
├── [ ] React Hook Form + Zod em ProporAulaForm
├── [ ] TanStack Query nos hooks principais
└── [ ] Consolidar NotificadorTelegram

Sprint 3 — Qualidade e Testes (2 semanas)
├── [ ] Vitest + 10 testes do motor de IA
├── [ ] noImplicitAny: true no tsconfig
├── [ ] eslint-plugin-import
└── [ ] Rate limit client-side para Groq

Sprint 4 — PWA e UX (2 semanas)
├── [ ] Workbox offline-first via vite-plugin-pwa
├── [ ] Recharts substituindo Chart.js
├── [ ] Skeleton loaders em cards e tabelas
└── [ ] Sonner unificando notificações
```

---

## 10. Conclusão

O CronoLab tem uma base técnica sólida e decisões arquiteturais inteligentes para o contexto Spark. As melhorias de maior impacto não são grandes reescritas — são ajustes cirúrgicos:

**Segurança primeiro:** mover a chave Groq para o servidor (já existe o proxy na Vercel, é só garantir que o frontend não tenha fallback direto).

**Bundle depois:** o code splitting no Vite pode reduzir o carregamento inicial em 60%+ ao isolar `@xenova/transformers`, `tesseract.js` e `brain.js` em chunks carregados sob demanda.

**Estado depois:** Zustand + TanStack Query eliminam o prop drilling e reduzem leituras Firestore desnecessárias — dois ganhos pelo preço de uma mudança.

Tudo dentro do Spark. Sem upgrade de plano. Sem custo extra.

---

*Análise gerada com base nos arquivos reais do repositório `cronograma-lab-frontend` — agosto de 2026.*
