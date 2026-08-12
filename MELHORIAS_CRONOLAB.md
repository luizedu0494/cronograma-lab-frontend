# 🔧 Guia de Melhorias — CronoLab

> Documento gerado a partir da revisão técnica completa do projeto.
> Organize a execução conforme a prioridade indicada em cada item.

---

## Legenda de Prioridade e Gravidade

| Símbolo | Significado |
|---------|-------------|
| 🔴 P0 | Crítico — resolver antes de qualquer deploy |
| 🟠 P1 | Alta — resolver na próxima sprint |
| 🟡 P2 | Média — planejar para o próximo mês |
| 🟢 P3 | Baixa — backlog, quando houver tempo |
| ⚡ Quick Win | Menos de 30 minutos, alto impacto |

---

## 🔴 P0 — Críticos (Segurança)

### 1. Proteger a chave da API Groq

**Problema:** A variável `VITE_GROQ_API_KEY` é embutida pelo Vite no bundle de produção e fica legível no JavaScript público. Qualquer usuário pode extraí-la abrindo o DevTools.

**Arquivo afetado:** `src/ia-estruturada/ProcessadorConsultas.js`

**Como resolver:**

1. Criar uma Firebase Cloud Function que atue como proxy:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const fetch = require('node-fetch');

exports.groqProxy = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Rejeita chamadas sem autenticação
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Autenticação obrigatória.'
      );
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Chave fica APENAS no servidor, nunca no frontend
        'Authorization': `Bearer ${functions.config().groq.api_key}`,
      },
      body: JSON.stringify(data.payload),
    });

    return response.json();
  });
```

2. Configurar a chave no Firebase (uma única vez):
```bash
firebase functions:config:set groq.api_key="sua_chave_aqui"
```

3. No frontend, substituir o `fetch` direto pelo callable:
```javascript
// Antes (inseguro):
const response = await fetch('https://api.groq.com/...', {
  headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
});

// Depois (seguro):
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();
const groqProxy = httpsCallable(functions, 'groqProxy');
const result = await groqProxy({ payload: { model, messages, ... } });
```

4. Remover `VITE_GROQ_API_KEY` do `.env` e do `README`.

> ⚠️ **Atenção:** O uso de Cloud Functions exige o plano **Blaze** (pay-as-you-go). Com o volume esperado do CESMAC, o custo será próximo de zero, mas o cartão precisa estar cadastrado.
>
> **Alternativa sem upgrade de plano:** Usar o [Groq via Vercel Functions](https://vercel.com/docs/functions) — o `vercel.json` já existe no projeto, o que facilita.

---

### 2. Auditar e endurecer as Firestore Security Rules

**Problema:** O controle de acesso por `role` (coordenador/técnico) existe apenas no frontend. Se as Firestore Rules não validarem o `role` do usuário no banco, qualquer pessoa autenticada pode escrever/ler dados arbitrários diretamente pela API do Firebase.

**Arquivo afetado:** `firestore.rules`

**Como resolver — modelo de regras recomendado:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ────────────────────────────────────────────────────────────
    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function isAutenticado() {
      return request.auth != null;
    }
    function isAprovado() {
      return isAutenticado() && userDoc().status == 'aprovado';
    }
    function isCoordenador() {
      return isAprovado() && userDoc().role == 'coordenador';
    }
    function isTecnico() {
      return isAprovado() && userDoc().role == 'tecnico';
    }

    // ── Coleção: users ──────────────────────────────────────────────────────
    match /users/{uid} {
      // Cada usuário lê o próprio perfil; coordenador lê todos
      allow read: if request.auth.uid == uid || isCoordenador();
      // Apenas coordenador altera perfis (exceto o próprio usuário no primeiro login)
      allow create: if request.auth.uid == uid;
      allow update: if isCoordenador() || request.auth.uid == uid;
      allow delete: if isCoordenador();
    }

    // ── Coleção: aulas ──────────────────────────────────────────────────────
    match /aulas/{aulaId} {
      allow read: if isAprovado();
      // Coordenador pode criar com qualquer status; técnico só pode criar como 'pendente'
      allow create: if isCoordenador()
                    || (isTecnico() && request.resource.data.status == 'pendente');
      // Apenas coordenador aprova/rejeita/edita status
      allow update: if isCoordenador()
                    || (isTecnico()
                        && request.auth.uid == resource.data.propostoPorUid
                        && resource.data.status == 'pendente'
                        && request.resource.data.status == 'pendente');
      allow delete: if isCoordenador();
    }

    // ── Coleção: eventosManutencao ──────────────────────────────────────────
    match /eventosManutencao/{id} {
      allow read: if isAprovado();
      allow write: if isCoordenador();
    }

    // ── Coleção: avisos ─────────────────────────────────────────────────────
    match /avisos/{avisoId} {
      allow read: if isAprovado();
      allow write: if isCoordenador();

      match /leituras/{userId} {
        allow read: if isCoordenador() || request.auth.uid == userId;
        allow write: if request.auth.uid == userId;
      }
    }

    // ── Coleção: revisoesTecnicos ───────────────────────────────────────────
    match /revisoesTecnicos/{id} {
      allow read: if isAprovado();
      allow write: if isTecnico()
                   && request.auth.uid == request.resource.data.tecnicoUid;
      allow delete: if isTecnico()
                    && request.auth.uid == resource.data.tecnicoUid;
    }

    // ── Coleção: logs ───────────────────────────────────────────────────────
    match /logs/{id} {
      allow read: if isCoordenador();
      allow create: if isAprovado(); // sistema grava logs de ações
      allow update, delete: if false; // logs são imutáveis
    }

    // ── Coleção: config ─────────────────────────────────────────────────────
    match /config/{docId} {
      allow read: if isAprovado();
      allow write: if isCoordenador();
    }

    // ── Coleção: grupos ─────────────────────────────────────────────────────
    match /grupos/{id} {
      allow read: if isAprovado();
      allow write: if isCoordenador();
    }
  }
}
```

**Após editar, publicar as regras:**
```bash
firebase deploy --only firestore:rules
```

**Como testar sem afetar produção:**
```bash
# Simulador no Firebase Console → Firestore → Rules → Playground
# Ou instalar o emulador local:
firebase emulators:start --only firestore
```

---

## 🟠 P1 — Alta Prioridade

### 3. Migrar credenciais do Firebase no Service Worker

**Problema:** `public/firebase-messaging-sw.jsx` tem `apiKey`, `appId` e outros dados do Firebase hardcoded e versionados no Git.

**Arquivo afetado:** `public/firebase-messaging-sw.jsx`

**Como resolver:**

O Firebase Hosting serve automaticamente um endpoint com as configurações do projeto. Substituir o bloco hardcoded por:

```javascript
// public/firebase-messaging-sw.js

// Importa a config automaticamente do Firebase Hosting (sem hardcode)
importScripts('/__/firebase/init.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// firebase já está inicializado pelo init.js — não precisa de initializeApp()
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

> `/__/firebase/init.js` só funciona em produção com Firebase Hosting. Para desenvolvimento local, manter um bloco condicional ou aceitar que o SW não funcione em `localhost` (o que é normal).

---

### 4. Corrigir JSX malformado no CalendarioCronograma

**Problema:** Há um fragmento de texto orphan após o bloco `<Collapse>` dos filtros avançados que pode causar erro de build ou renderização duplicada do botão "Limpar Filtros".

**Arquivo afetado:** `src/CalendarioCronograma.jsx`

**Como localizar:** Procurar pela string `} item xs={12} sx={{ display: 'flex'` — ela está fora de um `<Grid>` válido.

**Como resolver:** Remover a linha orphan e garantir que o fechamento dos `<Grid>` esteja correto:

```jsx
// REMOVER esta linha orphan (aparece logo após o fechamento do último Grid item dos filtros):
// } item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
//   <Button onClick={handleLimparFiltros}>Limpar Filtros</Button>
// </Grid>
// </Grid>

// A estrutura correta após o Collapse deve ser apenas:
          </Grid>
        </Collapse>
      </Box>
    </Paper>
```

**Prevenção:** Instalar ESLint com suporte a JSX para capturar isso automaticamente:
```bash
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks
```

---

### 5. Corrigir N+1 de leituras no badge de avisos

**Problema:** O `useEffect` de avisos na `PaginaInicial` abre um `onSnapshot` e dispara um `getDoc` para cada aviso para verificar se foi lido. Com 20 avisos = 21 leituras por update do listener.

**Arquivo afetado:** `src/PaginaInicial.jsx`

**Solução — usar `localStorage` (sem custo de leitura):**

```javascript
// Substitua o useEffect atual por esta versão:
useEffect(() => {
  if (!userInfo?.uid) return;

  const avisosRef = collection(db, 'avisos');
  const unsubscribe = onSnapshot(avisosRef, (avisosSnapshot) => {
    // IDs de todos os avisos existentes
    const todosIds = avisosSnapshot.docs.map(d => d.id);

    // IDs que o usuário já leu (salvo em localStorage, custo zero)
    const chave = `avisosLidos_${userInfo.uid}`;
    const lidos = JSON.parse(localStorage.getItem(chave) || '[]');

    // Não lidos = avisos que existem mas não estão na lista de lidos
    const naoLidos = todosIds.filter(id => !lidos.includes(id));
    setAvisosNaoLidos(naoLidos.length);
  });

  return () => unsubscribe();
}, [userInfo]);
```

> A função que marca aviso como lido (em `PainelAvisos`) já deve salvar no localStorage com `avisosLidos_${uid}`. Verificar consistência entre os dois componentes.

---

## 🟡 P2 — Média Prioridade

### 6. Consolidar NotificadorTelegram em um único módulo

**Problema:** Existem duas implementações distintas da classe `NotificadorTelegram`: uma em `src/NotificadorTelegram.js` e outra em `src/ia-estruturada/NotificadorTelegram.js`. Correções precisam ser replicadas manualmente nos dois arquivos.

**Como resolver:**

1. Criar `src/services/NotificadorTelegram.js` com a implementação completa (a de `ia-estruturada`, que tem suporte a tópicos do Telegram).
2. Deletar os dois arquivos originais.
3. Atualizar todos os imports:

```javascript
// Antes (em GerenciarAprovacoes, EventosManutencao, etc.):
import { notificadorTelegram } from './NotificadorTelegram';
import { notificadorTelegram } from '../ia-estruturada/NotificadorTelegram';

// Depois (em todos os arquivos):
import { notificadorTelegram } from '../services/NotificadorTelegram';
```

---

### 7. Corrigir padrão de listener em GerenciarAprovacoes

**Problema:** `fetchAulasDoMes` é um `useCallback` que retorna o `unsubscribe` de um `onSnapshot`. Se o componente re-renderizar rapidamente (troca de mês/ano), o listener anterior pode não ser limpo antes do novo ser criado.

**Arquivo afetado:** `src/GerenciarAprovacoes.jsx`

**Como resolver — mover o `onSnapshot` para dentro do `useEffect`:**

```javascript
// REMOVER o useCallback fetchAulasDoMes e substituir por:

useEffect(() => {
  setLoadingMes(true);
  const start = dayjs().year(selectedYear).month(selectedMonth).startOf('month');
  const end   = dayjs().year(selectedYear).month(selectedMonth).endOf('month');

  const q = query(
    collection(db, 'aulas'),
    where('dataInicio', '>=', Timestamp.fromDate(start.toDate())),
    where('dataInicio', '<=', Timestamp.fromDate(end.toDate())),
    where('status', 'in', ['aprovada', 'rejeitada']),
    orderBy('dataInicio', 'asc')
  );

  const unsub = onSnapshot(q, snap => {
    setAulasDoMes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoadingMes(false);
  }, err => {
    console.error(err);
    setLoadingMes(false);
  });

  // Cleanup garantido antes de cada re-subscribe
  return () => unsub();
}, [selectedMonth, selectedYear]);
```

---

### 8. Adicionar testes para os fluxos críticos

**Problema:** O projeto tem ~40 componentes e apenas 2 arquivos de teste. Regressões em fluxos críticos (proposta de aula, aprovação, autenticação) são detectadas apenas em produção.

**Como começar:**

```bash
# Instalar dependências de teste (Vite já tem Vitest integrado)
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Adicionar ao `vite.config.jsx`:
```javascript
export default defineConfig({
  // ...config existente...
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.jsx',
  },
});
```

**Testes prioritários a criar:**

```javascript
// src/AuthContext.test.jsx — roteamento por role
test('usuário pendente não vê o menu principal', () => { ... });
test('técnico não vê o menu de Aprovações', () => { ... });
test('coordenador vê todos os itens do menu', () => { ... });

// src/ProporAulaForm.test.jsx — validações
test('não submete sem laboratório selecionado', () => { ... });
test('não submete com data no passado', () => { ... });
test('exibe horários ocupados desabilitados', () => { ... });

// src/ia-estruturada/ExecutorAcoes.test.js — lógica de negócio
test('detecta conflito de horário corretamente', () => { ... });
test('não cria aula em laboratório já ocupado', () => { ... });
```

---

### 9. Atualizar manifest.json com identidade do CronoLab ⚡

**Problema:** O `manifest.json` ainda usa os valores padrão do template CRA — o app aparece como "React App" quando instalado no celular.

**Arquivo afetado:** `public/manifest.json`

**Correção completa:**

```json
{
  "short_name": "CronoLab",
  "name": "CronoLab — CESMAC",
  "description": "Sistema de gestão de cronogramas dos laboratórios do CESMAC",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1E7EC8",
  "background_color": "#0B0F18"
}
```

---

## 🟢 P3 — Backlog

### 10. Remover estado `file` não utilizado ⚡

**Arquivo afetado:** `src/UploadAulasForm.jsx`

```javascript
// REMOVER estas linhas (estado declarado mas nunca usado):
const [file, setFile] = useState(null);
```

---

### 11. Corrigir prop `sx` duplicada em ProporEventoForm ⚡

**Arquivo afetado:** `src/ProporEventoForm.jsx`

```jsx
// ANTES (prop sx duplicada — segunda sobrescreve a primeira):
<FormControl sx={{ minWidth: 120 }} sx={{ mb: 2 }}>

// DEPOIS (combinar em um único objeto):
<FormControl sx={{ minWidth: 120, mb: 2 }}>
```

---

### 12. Corrigir item duplicado no FAQ ⚡

**Arquivo afetado:** `src/AjudaFAQ.jsx`

```javascript
// ANTES (id duplicado, categoria duplicada):
{
  id: 'faq-tecnico-propor-aula', // ← id já usado em outro item
  categoria: 'tecnico',          // ← sobrescrita pela linha abaixo
  categoria: 'coordenador',
  pergunta: 'O que aparece no painel inicial do coordenador?',
  ...
}

// DEPOIS:
{
  id: 'faq-coord-painel',        // ← id único
  categoria: 'coordenador',      // ← apenas uma declaração
  pergunta: 'O que aparece no painel inicial do coordenador?',
  ...
}
```

---

### 13. Decompor componentes muito grandes

Os componentes abaixo têm mais de 400 linhas e múltiplas responsabilidades. Não precisam ser refatorados agora, mas são candidatos à decomposição conforme o projeto crescer:

| Componente | Responsabilidade atual | Sugestão de split |
|---|---|---|
| `PaginaInicial.jsx` | KPIs + cards + calendário + painel técnico | `KpiCards`, `PainelTecnicoHoje`, `PainelCoordenador` |
| `ProporAulaForm.jsx` | Form + validação + detecção de conflitos + submit | `useProporAulaForm` hook, `ConflictChecker` |
| `GerenciarAulasAvancado.jsx` | Filtros + tabela + modais de edição/exclusão | `TabelaAulas`, `FiltrosAula`, `ModalEditarAula` |
| `ImportarCronograma.jsx` | Upload + parsing DOCX/XLS/PDF + preview + import | `FileParser`, `CandidatoCard`, `ImportPreview` |

---

## ✅ Checklist de Execução

Copie e use como lista de tarefas:

```
SEGURANÇA
[ ] Criar proxy Firebase Function para API Groq
[ ] Remover VITE_GROQ_API_KEY do .env e do bundle
[ ] Auditar e publicar firestore.rules endurecidas
[ ] Migrar firebase-messaging-sw para /__/firebase/init.js

BUGS
[ ] Corrigir JSX malformado em CalendarioCronograma.jsx
[ ] Corrigir prop sx duplicada em ProporEventoForm.jsx
[ ] Corrigir id e categoria duplicados em AjudaFAQ.jsx
[ ] Remover estado `file` não utilizado em UploadAulasForm.jsx

PERFORMANCE
[ ] Corrigir N+1 de leituras de avisos em PaginaInicial.jsx
[ ] Corrigir padrão de listener em GerenciarAprovacoes.jsx

MANUTENÇÃO
[ ] Consolidar NotificadorTelegram em src/services/
[ ] Atualizar manifest.json com metadados do CronoLab
[ ] Instalar ESLint + eslint-plugin-react + eslint-plugin-react-hooks

QUALIDADE
[ ] Criar testes de autenticação/roteamento por role
[ ] Criar testes de validação do ProporAulaForm
[ ] Criar testes de detecção de conflitos
```

---

*Gerado em revisão técnica completa do CronoLab · CESMAC · 2026*
