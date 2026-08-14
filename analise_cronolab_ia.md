# 🧠 Análise Técnica & Roadmap de IA — CronoLab

> Sistema de gestão de laboratórios do CESMAC · React 19 + Firebase + Groq/Llama

---

## 1. Diagnóstico Atual

### O que já existe de IA

| Componente | Localização | O que faz |
|---|---|---|
| `AssistenteIA.jsx` | `src/pages/IA/` | Interface de chat com o usuário |
| `AssistenteIATecnico.jsx` | `src/` | Versão especializada para técnicos |
| `ClassificadorIntencao.ts` | `src/ia-estruturada/` | Detecta a intenção da pergunta |
| `ExtratorParametros.ts` | `src/ia-estruturada/` | Extrai entidades (data, lab, curso…) |
| `ExecutorAcoes.ts` | `src/ia-estruturada/` | Executa a ação identificada |
| `ProcessadorConsultas.ts` | `src/ia-estruturada/` | Orquestra o fluxo de consulta |
| `FormatadorResultados.jsx` | `src/ia-estruturada/` | Formata a resposta final |
| `api/groq.js` | `api/` | Proxy para Groq (Llama) como fallback |

### Pontos Fortes
- Arquitetura híbrida (motor local + LLM externo) — inteligente para o plano Spark
- Separação de responsabilidades bem definida na pasta `ia-estruturada/`
- PWA com push notifications — base sólida para alertas inteligentes

### Gaps Críticos
- O assistente é **reativo** — só responde quando perguntado
- Sem memória de contexto entre sessões
- Sem voz (entrada ou saída)
- Sem capacidade de **agir** no sistema (apenas consulta)
- Sem aprendizado com os padrões de uso da instituição
- Sem análise preditiva de conflitos ou ocupação futura

---

## 2. Frameworks e Arquiteturas Recomendados

### 2.1 Para o Assistente de IA

#### 🔵 LangChain.js (Recomendação Principal)

O que resolve: encadeia etapas (classificação → busca → resposta) com memória e ferramentas de forma declarativa.

```
npm install langchain @langchain/groq @langchain/community
```

**Por que encaixa no CronoLab:**
- Substitui e expande o `ProcessadorConsultas.ts` com uma pipeline mais robusta
- Suporta Groq nativamente — zero mudança de provider
- `ConversationBufferMemory` adiciona memória de sessão sem backend extra
- `Tools` permitem que o assistente **execute ações** (criar aula, aprovar proposta) em vez de só consultar

Exemplo de ferramenta que o assistente poderia usar:
```ts
// O assistente pode chamar isso diretamente
const criarAulaTool = new DynamicTool({
  name: "criar_aula",
  description: "Cria uma nova aula no cronograma dado laboratório, data, hora e disciplina",
  func: async (input) => await salvarAulaNoFirestore(JSON.parse(input))
});
```

---

#### 🟣 Vercel AI SDK

O que resolve: streaming de respostas, estados de loading e cancelamento — torna o chat tão fluido quanto o ChatGPT.

```
npm install ai @ai-sdk/groq
```

**Por que encaixa:**
- Substitui o fetch manual no `api/groq.js`
- `useChat()` hook gerencia histórico, estado e streaming automaticamente
- Funciona direto com Groq sem servidor próprio (Vercel Edge Functions)

```tsx
// AssistenteIA.jsx — versão com streaming
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
  body: { contexto: dadosFirestore }
});
```

---

#### 🟡 Retrieval-Augmented Generation (RAG) Local

O que resolve: o assistente responde sobre **dados reais do Firestore** sem precisar enviar tudo para o LLM.

**Fluxo:**
```
Pergunta do usuário
      ↓
Embedding da pergunta (transformers.js — roda no browser!)
      ↓
Busca vetorial nos dados do Firestore já indexados
      ↓
Passa só o contexto relevante para o Groq
      ↓
Resposta precisa com dados reais
```

```
npm install @xenova/transformers  # roda 100% no browser, zero custo
```

Isso elimina o problema atual onde o assistente pode alucinar sobre horários que não existem.

---

### 2.2 Para Análise e Predição

#### 🟢 TensorFlow.js / Brain.js (Predição de Ocupação)

Roda 100% no browser — zero servidor extra.

**Casos de uso no CronoLab:**
- Prever quais laboratórios estarão lotados na próxima semana
- Detectar padrões de cancelamento por professor/curso
- Recomendar horários alternativos automaticamente quando há conflito

```
npm install brain.js  # mais simples para séries temporais pequenas
```

---

### 2.3 Para a Interface

#### 🎨 Vercel AI SDK UI Components + MUI

Componentes prontos de chat que se integram com o MUI já usado:
- `<Message />` com suporte a markdown, tabelas e código
- Sugestões de perguntas (chips clicáveis)
- Indicador de digitação animado

---

## 3. Funcionalidades Novas — Mapeadas por Impacto

### 🔴 Alto Impacto / Rápido de implementar

#### 3.1 Assistente Proativo (Smart Nudges)
O sistema avisa **sem ser perguntado**, como o Google Now fazia.

Exemplos:
- *"Laboratório 3 está 90% ocupado amanhã. Deseja redistribuir?"*
- *"Professor João tem 3 aulas seguidas sem intervalo na quinta. Alertar?"*
- *"Detectei um conflito de horário na importação de terça."*

**Implementação:** Firebase Cloud Functions com triggers de escrita → analisa e envia push/Telegram.

```ts
// functions/index.jsx — já existe! Adicionar:
exports.analisarConflitosOnWrite = functions.firestore
  .document('aulas/{aulaId}')
  .onWrite(async (change, context) => {
    await detectarConflitos(change.after.data());
    await notificarSeNecessario();
  });
```

---

#### 3.2 Assistente com Ações (Agente Executável)
Em vez de só consultar, o assistente **faz**:

| Comando natural | Ação executada |
|---|---|
| "Cancela minha aula de amanhã" | `deleteDoc(aulaRef)` |
| "Reagenda para sexta às 14h" | `updateDoc(aulaRef, {data, horario})` |
| "Quem pode cobrir o Lab 2?" | Consulta disponibilidade de técnicos |
| "Bloqueia o Lab 1 para manutenção na semana do dia 20" | Cria `EventoManutencao` |

**Stack:** LangChain.js Tools + confirmação modal antes de executar ações destrutivas.

---

#### 3.3 Resumo Diário Automatizado
Toda manhã, um resumo é gerado e enviado via Telegram/Push:

```
📅 Resumo de hoje — CESMAC Labs

• 12 aulas agendadas
• Lab 3 sem técnico designado ⚠️
• 2 propostas aguardando aprovação
• Feriado amanhã — 3 aulas podem ser afetadas
```

**Implementação:** Cloud Function com `pubsub.schedule('0 7 * * *')`.

---

#### 3.4 Busca Semântica no Cronograma
Usuário digita qualquer coisa e o sistema entende:

- *"aulas de informática pela manhã"* → filtra por curso + turno
- *"quando o lab 4 fica livre essa semana"* → mostra grade de disponibilidade
- *"quem dá aula de banco de dados"* → retorna professores

**Implementação:** Embeddings com `@xenova/transformers` + índice em memória (sem custo).

---

### 🟡 Médio Impacto / Requer mais desenvolvimento

#### 3.5 Entrada por Voz
Microfone direto no assistente, como o Google Assistant.

```tsx
// Web Speech API — nativa no browser, zero dependência
const recognition = new webkitSpeechRecognition();
recognition.lang = 'pt-BR';
recognition.onresult = (e) => setInput(e.results[0][0].transcript);
```

**Casos de uso:** técnicos com as mãos ocupadas podem perguntar sem digitar.

---

#### 3.6 Geração Automática de Relatórios
O coordenador pede: *"Gera o relatório de ocupação do semestre em PDF"* — e recebe.

**Stack:**
- LLM gera o texto analítico
- `jsPDF` renderiza o PDF direto no browser (zero servidor)
- Link de download direto no chat

---

#### 3.7 Importação por Foto/Print
Usuário tira foto de um cronograma impresso → sistema converte para aulas.

**Stack:**
- `Tesseract.js` (OCR no browser) para extrair texto da imagem
- LLM interpreta e estrutura os dados extraídos
- Fluxo de confirmação antes de importar

Isso expande o `ImportarCronograma.jsx` já existente.

---

#### 3.8 Dashboard Preditivo de Ocupação
Gráfico que mostra a **previsão** das próximas semanas baseada em histórico.

**Stack:** `brain.js` treinado com dados históricos do Firestore + `recharts` para visualização.

Métricas preditivas:
- Taxa de ocupação esperada por laboratório
- Risco de conflito nas próximas 2 semanas
- Cursos com crescimento de demanda

---

#### 3.9 Chatbot FAQ Inteligente
O `AjudaFAQ.jsx` atual é estático. Transformar em FAQ conversacional:

- Usuário descreve o problema → LLM busca na base de conhecimento
- Se não encontrar → abre ticket automático para o técnico responsável
- Aprende com novas perguntas ao longo do tempo

---

### 🟢 Expansões de Médio/Longo Prazo

#### 3.10 Multi-Modal: Análise de Documentos
Coordenador sobe um PDF de regulamento → assistente responde perguntas sobre ele.

**Stack:** Groq Vision (já suporta imagens) — zero custo adicional no free tier.

---

#### 3.11 IA de Designação Automática de Técnicos
Quando uma proposta é aprovada, o sistema sugere o técnico ideal:

Critérios considerados:
- Disponibilidade na grade (`GradeDisponibilidade.jsx` já existe)
- Especialidade no laboratório
- Carga de trabalho atual
- Histórico de designações

**Stack:** Algoritmo de scoring simples + LLM para explicar a sugestão.

---

#### 3.12 Análise de Sentimento nos Avisos
`PainelAvisos.jsx` — analisar o tom dos avisos urgentes e sugerir reformulações mais claras antes de publicar.

---

#### 3.13 Modo Offline Inteligente
PWA já instalável. Adicionar:
- Cache inteligente dos dados mais acessados
- Respostas do assistente em modo offline para perguntas frequentes (respostas cacheadas)
- Sincronização inteligente quando reconectar

**Stack:** Workbox (já suportado pelo Vite) + IndexedDB para cache local.

---

## 4. Arquitetura Proposta — IA de Próxima Geração

```
┌─────────────────────────────────────────────────────┐
│                  INTERFACE (React)                   │
│  Chat streaming │ Voz │ Sugestões proativas │ Ações  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              CAMADA DE ORQUESTRAÇÃO                  │
│         LangChain.js + Vercel AI SDK                 │
│  Memória │ Tools │ RAG │ Classificação de intenção   │
└──────┬───────────────┬──────────────────┬────────────┘
       │               │                  │
┌──────▼──────┐ ┌──────▼──────┐ ┌────────▼────────┐
│  LLM GROQ   │ │  Motor      │ │  Embeddings     │
│  (Llama)    │ │  Local      │ │  @xenova/       │
│  Streaming  │ │  (atual)    │ │  transformers   │
└─────────────┘ └─────────────┘ └─────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   FIRESTORE                          │
│   Aulas │ Usuários │ Eventos │ Logs de IA            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              CLOUD FUNCTIONS                         │
│  Análise de conflitos │ Resumo diário │ Notificações │
└─────────────────────────────────────────────────────┘
```

---

## 5. Roadmap de Implementação Sugerido

### Sprint 1 (1–2 semanas) — Quick Wins
- [ ] Migrar `api/groq.js` para **Vercel AI SDK** com streaming
- [ ] Adicionar **sugestões de perguntas** (chips) na interface do assistente
- [ ] Implementar **memória de sessão** com `ConversationBufferMemory`

### Sprint 2 (2–4 semanas) — Assistente Ativo
- [ ] Implementar **ações executáveis** via LangChain Tools (cancelar, reagendar)
- [ ] Adicionar **entrada por voz** (Web Speech API)
- [ ] Criar **Cloud Function de análise de conflitos** em tempo real

### Sprint 3 (4–8 semanas) — Inteligência Preditiva
- [ ] Implementar **RAG** com embeddings locais
- [ ] Criar **resumo diário automatizado** via Telegram
- [ ] Dashboard de **predição de ocupação** com brain.js

### Sprint 4 (2–3 meses) — Expansão
- [ ] **OCR de imagens** para importação por foto
- [ ] **IA de designação automática** de técnicos
- [ ] **Relatórios em PDF** gerados por linguagem natural
- [ ] **FAQ conversacional** com abertura automática de tickets

---

## 6. Considerações de Custo (Plano Spark)

| Funcionalidade | Custo Extra | Observação |
|---|---|---|
| Vercel AI SDK + streaming | $0 | Edge Functions gratuitas no Vercel |
| Embeddings (@xenova) | $0 | Roda no browser do usuário |
| Web Speech API (voz) | $0 | API nativa do browser |
| brain.js (predição) | $0 | Roda no browser |
| Groq API | $0 (free tier) | 14.400 tokens/minuto grátis |
| Cloud Functions análise | $0 | 2M invocações/mês grátis |
| OCR (Tesseract.js) | $0 | Roda no browser |

> **Conclusão:** Todas as melhorias listadas neste documento são implementáveis dentro do plano Spark, sem custo de infraestrutura.

---

## 7. Referências

- [LangChain.js Docs](https://js.langchain.com)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Groq + Llama (free)](https://console.groq.com)
- [@xenova/transformers](https://github.com/xenova/transformers.js)
- [Brain.js](https://brain.js.org)
- [Tesseract.js OCR](https://tesseract.projectnaptha.com)
- [Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
