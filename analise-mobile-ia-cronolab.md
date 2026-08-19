# CronoLab — Análise Técnica: Mobile, Usabilidade, LangGraph e IA Distribuída

> Análise feita em cima do código-fonte real do repositório `luizedu0494-cronograma-lab-frontend` (React 19 + MUI v7 + Vite 7 + Firebase). Complementa (sem repetir) o documento já existente `docs/analise_melhorias_cronolab.md`, focando nos quatro pontos pedidos: **design mobile**, **usabilidade**, **migração LangChain → LangGraph** e **IA distribuída pelo site**.

---

## 1. Diagnóstico — Mobile está "desajustado" porque a responsividade é pontual, não estrutural

Fui direto no código para confirmar a sensação relatada, e ela tem causa raiz clara: **o app trata mobile como um "encolhimento" do layout desktop, e não como um modo de navegação próprio.**

### 1.1 Evidências encontradas

| Item verificado | Resultado |
|---|---|
| Uso de `useMediaQuery` em todo o projeto | Apenas **3 arquivos** (`App.jsx`, `ListagemCompletaAulas.jsx`, `GradeDisponibilidade.jsx`) em mais de 80 componentes/páginas |
| Componente de navegação mobile (`Drawer`, bottom nav) | **Não existe nenhum.** O menu mobile é o **mesmo `<Menu>` (dropdown)** do desktop, só que aberto pelo ícone hambúrguer |
| `Dialog` com `fullScreen` no mobile | **0 ocorrências** — todos os modais (formulários de aula, confirmações, importação) abrem no tamanho fixo do desktop, espremidos em telas pequenas |
| `TableContainer` (tabelas MUI) | 18 ocorrências, mas a maioria depende de **scroll horizontal** em vez de um layout alternativo em cards para telas pequenas |
| Breakpoints customizados no `theme.js` | Nenhum. O tema define paleta, tipografia e `components.styleOverrides`, mas **não define `breakpoints`**, nem tamanhos de fonte/spacing responsivos via `theme.typography.h1.sm` etc. |
| CSS global (`index.css`) | Só reduz `font-size` do `body` em `max-width: 768px`. Nenhuma outra adaptação |
| Tamanho de toque (44×44px) | O próprio doc interno do projeto já sinalizou isso como pendência nos chips do onboarding — mas o padrão se repete em outros lugares (ícones de ação em tabelas, chips de filtro) |

### 1.2 Consequência prática

- O **menu de navegação em mobile é um `Menu` do MUI que abre por cima do conteúdo com todos os itens de coordenador/técnico empilhados verticalmente** — inclusive um submenu dentro do menu (`CoordenadorGerenciarMenu`, aberto a partir de outro `MenuItem`). Em tela pequena isso vira um menu longo, com "menu dentro de menu", difícil de fechar com o polegar e sem hierarquia visual.
- Formulários e diálogos abrem com o mesmo `maxWidth` do desktop, então em telas de 360–390px o conteúdo é **espremido**, com padding desperdiçado nas laterais do `Container maxWidth="xl"` que envolve todas as rotas (`MainLayout` em `App.jsx`).
- Tabelas de listagem (aprovações, histórico, análise de aulas) empurram o usuário para **scroll horizontal**, que é o padrão de responsividade mais frágil que existe em mobile — a alternativa real é reformatar a linha em card.

Ou seja: o problema não é "falta de CSS", é que **a arquitetura de navegação e os componentes de overlay (menu, modal, tabela) não têm uma segunda forma para telas pequenas.**

---

## 2. Sugestões de Design Mobile

### 2.1 Navegação — trocar Menu-dropdown por padrão mobile nativo

- **Bottom Navigation (MUI `BottomNavigation`)** fixa para os 4–5 itens mais usados por perfil (ex.: Técnico → Painel, Calendário, Propor, Designações, Perfil; Coordenador → Painel, Calendário, Aprovações, Gerenciar, Perfil).
- Mover o restante dos itens (Gerenciar Usuários, Análises, Integridade etc.) para um **`Drawer` (menu lateral deslizante)**, acionado pelo ícone hambúrguer — em vez do `Menu` dropdown atual, que não é o padrão esperado em apps mobile.
- Eliminar o "menu dentro de menu" (`CoordenadorGerenciarMenu`): no mobile, o submenu "Gerenciar" deveria abrir como uma **seção expansível dentro do próprio Drawer**, não como um segundo popup flutuante.
- Isso resolve tanto a queixa de "desajustado" quanto reduz cliques — hoje o coordenador passa por 2 menus só para chegar em "Integridade".

### 2.2 Modais e formulários — fullScreen abaixo do breakpoint `sm`

```jsx
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

<Dialog fullScreen={isMobile} open={open} onClose={onClose}>
  ...
</Dialog>
```

Aplicar isso nos principais: `ProporAulaForm`, `ProporEventoForm`, `DesignarTecnicosModal`, `UploadCronogramaExterno`, diálogo de confirmação da IA. Ganho imediato de usabilidade sem redesenhar nada visualmente — apenas o comportamento de tela cheia.

### 2.3 Tabelas → cards empilhados em telas pequenas

O padrão já existe parcialmente (`ListagemCompletaAulas.jsx` já usa `isMobile`). Falta **generalizar** esse padrão para as outras 15+ `TableContainer` do projeto (Gerenciar Aprovações, Gerenciar Usuários, Análise de Aulas/Eventos etc.):

```jsx
{isMobile ? (
  <Stack spacing={1}>
    {itens.map(item => <ItemCardMobile key={item.id} item={item} />)}
  </Stack>
) : (
  <TableContainer>...</TableContainer>
)}
```

Vale criar **um componente genérico `<ResponsiveDataView columns={} rows={} renderMobileCard={} />`** reutilizável, em vez de reimplementar essa lógica em cada tela — isso também resolve a duplicação de código que o doc interno já apontou.

### 2.4 Theme — breakpoints e tipografia fluida

Hoje `theme.js` não tem nada de responsivo. Sugestões pontuais, sem mudar a paleta CESMAC:

```js
// dentro de getAppTheme()
breakpoints: {
  values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
},
```

E usar `theme.typography` com `responsiveFontSizes(theme)` do MUI (`import { responsiveFontSizes } from '@mui/material/styles'`) para que `h1`–`h4` encolham automaticamente em telas pequenas, em vez de depender só do `font-size` global do `body` no CSS.

### 2.5 Container com padding adaptável

Trocar `<Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>` fixo no `MainLayout` por padding responsivo:

```jsx
<Container maxWidth="xl" sx={{ mt: { xs: 1.5, sm: 4 }, mb: { xs: 1.5, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
```

Pequeno, mas em tela de 360px cada pixel de margem lateral desperdiçada conta.

### 2.6 Toque e gestos

- Garantir `minHeight/minWidth: 44px` em todo `IconButton` de ação dentro de linhas de tabela/cards (hoje o tema só define `minHeight: 40` para `Button`, não para `IconButton`).
- Considerar **swipe actions** (aprovar/rejeitar com swipe) nos cards de aprovação em mobile — reduz muito o número de toques para o coordenador que aprova várias propostas em sequência.
- No calendário/grade de disponibilidade, testar `touch-action` e scroll por eixo único para evitar o "efeito elástico" comum quando um componente tem scroll tanto vertical quanto horizontal dentro de uma página que já rola.

---

## 3. Usabilidade — ferramentas que melhoram a experiência

Estas são independentes do mobile, mas o impacto é maior justamente em telas pequenas (menos espaço = menos tolerância a fricção):

| Ferramenta / padrão | Onde aplicar | Ganho |
|---|---|---|
| **Skeleton loaders** (`@mui/material/Skeleton`) no lugar do `CircularProgress` genérico | Listas, tabelas, cards de KPI | Reduz percepção de espera, evita "salto" de layout |
| **`EmptyState` com call-to-action** (o componente já existe em `components/EmptyState.tsx`) | Garantir uso em Aprovações, Histórico, Designações, Análises — hoje nem todas usam | Lista vazia deixa de ser um beco sem saída |
| **Busca com debounce + destaque do termo** | Listagens grandes (Histórico, Gerenciar Usuários) | Evita disparar filtro a cada tecla, melhora percepção de app rápido |
| **Undo/Snackbar com ação "Desfazer"** | Exclusões (aula, evento, usuário) | Reduz ansiedade em ações destrutivas, muito relevante em toque acidental no mobile |
| **Persistência de filtros na URL (query params)** | Análise de Aulas/Eventos, Consulta de Disponibilidade | Permite voltar/compartilhar link com o filtro aplicado |
| **Command Palette (Ctrl+K / long-press no mobile)** | Ação global rápida ("ir para Aprovações", "propor aula") | Atalho para power users (coordenador) sem navegar por menus |
| **Virtualização de listas longas** (`react-window` ou `@tanstack/react-virtual`) | Histórico de Aulas, Gerenciar Usuários quando a base crescer | Evita travamento de scroll em listas grandes, especialmente em celular |
| **Modo offline básico (cache do último cronograma)** via Service Worker (já existe `firebase-messaging-sw.js`, dá pra estender) | Painel do dia do técnico | Técnico em laboratório com sinal ruim ainda vê a última grade carregada |

---

## 4. LangChain → LangGraph: por que faz sentido e o que muda

### 4.1 O que o código atual realmente faz hoje

Achado importante ao ler `src/ia-estruturada/` e `src/services/`:

- **`langchainService.js`** instancia um `ChatGroq` e faz `bindTools(TODAS_FERRAMENTAS_LANGCHAIN)`, mas o método `processarMensagemStream` **só faz `model.stream(messages)` e concatena texto** — nunca trata `tool_calls`, nunca executa as ferramentas, nunca faz um segundo turno com o resultado da ferramenta. Ou seja, **as tools do LangChain (`langchainTools.ts`) estão declaradas mas nunca são efetivamente chamadas por esse serviço.**
- O fluxo que **de fato funciona hoje** (`ProcessadorConsultas.ts`) **não usa LangChain nenhum** — é um `fetch` manual para `/api/groq` com `response_format: json_object` e um prompt gigante que pede pra IA devolver um JSON de "plano de ação", que depois é interpretado por `ExecutorAcoes.ts` na mão.
- **`ragService.js`** implementa um "RAG client-side" com `MemoryVectorStore`, mas os embeddings são **mockados**: `embedDocuments` e `embedQuery` retornam sempre `new Array(1536).fill(0.01)` — ou seja, todo documento tem o mesmo vetor, então `similaritySearch` não faz busca semântica nenhuma, é essencialmente aleatório. E, além disso, **esse serviço não é chamado em nenhum lugar do app** (só existe a definição, sem uso).

Resumindo: hoje existem **três abordagens de IA coexistindo** (regex local, prompt→JSON direto na Groq, e um LangChain semi-configurado e não utilizado), o que explica por que fica difícil evoluir o assistente — não há um único "cérebro" orquestrando.

### 4.2 Por que LangGraph resolve isso melhor que "consertar" o LangChain atual

LangChain (a lib de chains/tools) é boa para chamadas lineares simples — que é justamente o que já está sendo feito manualmente e funcionando (`ProcessadorConsultas`). O ganho de trocar para **LangGraph** não é "trocar uma lib por outra", é que o **assistente do CronoLab já precisa, na prática, de um grafo de estados**:

```
usuário digita → classificar intenção → (tem tudo pra ação local? sim: executa | não: pergunta pra IA)
                                                                    ↓
                                                      IA decide: consultar dado | pedir confirmação | pedir mais info
                                                                    ↓
                                              se ação de escrita → nó de confirmação humana (human-in-the-loop)
                                                                    ↓
                                                          executar ferramenta (Firestore) → formatar resultado
```

Isso **já é exatamente o que `ProcessadorConsultas` + `ExecutorAcoes` + o diálogo de confirmação em `AssistenteIA.jsx` fazem na mão**, com `if/else` e estado em `useState`. LangGraph formaliza esse fluxo como um **grafo com estado explícito, checkpoints e loops de ferramentas nativos**, trazendo:

- **Tool-calling loop nativo**: o próprio grafo decide se chama uma ferramenta e reinjeta o resultado, sem o "monta JSON manual e interpreta na mão" que existe hoje em `ProcessadorConsultas`.
- **Human-in-the-loop de verdade**: hoje a confirmação antes de escrever no Firestore é implementada com `openConfirmDialog`/`acaoPendente` no componente React. No LangGraph isso vira um **nó de interrupção (`interrupt`)** do próprio grafo — a lógica de "pausar até o usuário confirmar" sai do componente de UI e vai para a camada de orquestração, ficando reaproveitável em outros lugares (ex. se algum dia a IA for usada em um bot de Telegram, a mesma lógica de confirmação serve).
- **Memória/estado persistente por conversa** (checkpointer), em vez do `historico` isolado em `localStorage` que hoje só guarda o texto da última pergunta, sem contexto da conversa anterior.
- **Roteamento condicional real**: hoje o "atalho local" (regex bate tudo → não chama IA) e o "caminho via Groq" são dois `if` dentro de `processar()`. No grafo isso vira dois nós com uma aresta condicional, deixando explícito e fácil de adicionar um terceiro caminho no futuro (ex. RAG de verdade, ou outro modelo).
- Isso também **resolve organicamente o RAG quebrado**: em vez de manter `ragService.js` com embeddings falsos e desconectado do fluxo, o LangGraph permite adicionar um **nó de recuperação real** (com embeddings de verdade — ou simplesmente busca por filtro no Firestore, que já é o caso de uso real do app) no ponto certo do grafo, e só chamá-lo quando o roteamento decidir que é necessário.

### 4.3 Caminho de migração sugerido (incremental, sem quebrar o que funciona)

1. **Não jogar fora `ClassificadorIntencao.ts` e `ExtratorParametros.ts`** — eles continuam úteis como o "atalho rápido local" (evitar chamada de API quando a pergunta já é 100% clara). Isso vira o primeiro nó do grafo.
2. Criar um grafo com `@langchain/langgraph` (`StateGraph`) com nós: `classificar_local → [atalho_direto | perguntar_ia] → (se ação de escrita) confirmar_usuario → executar_ferramenta → formatar_resposta`.
3. As ferramentas já existentes em `langchainTools.ts` (`proporAulaTool`, `buscarDisponibilidadeTool`, `consultarPropostasPendentesTool`) **já estão no formato certo** (`DynamicStructuredTool` com Zod) — dá pra reaproveitar quase 100% delas dentro do grafo, só conectando de verdade ao `ExecutorAcoes.ts` real (hoje o `func` de cada tool só retorna um JSON de instrução, não executa nada no Firestore).
4. Trocar a chamada direta a `/api/groq` (hoje um `fetch` cru dentro de `ProcessadorConsultas.ts`) pelo `ChatGroq` do `@langchain/groq` que **já está instalado no projeto** — reduzindo a duplicação de lógica de parsing de resposta/erro que hoje existe em dois lugares (`langchainService.js` e `ProcessadorConsultas.ts`).
5. Remover ou reaproveitar `ragService.js` — se a ideia de busca semântica for mantida, trocar os embeddings mockados por embeddings reais (ex. `@langchain/groq` não tem embeddings; usar um endpoint de embeddings gratuito/local, ou simplificar para busca por palavra-chave no Firestore, que resolve 90% do caso de uso real de um cronograma).
6. Consolidar, como o próprio doc interno já sugeriu, `AssistenteIA.jsx` e `AssistenteIATecnico.jsx` em um único componente — fica ainda mais natural depois da migração, porque o grafo passa a ser a única fonte de verdade da lógica, e a diferença entre os dois perfis vira apenas uma flag (`podeEditar`) passada ao grafo, não dois componentes de UI distintos.

---

## 5. IA além do "assistente": usá-la no próprio site sem travar o fluxo

O pedido de "IA não só como assistente, mas no próprio site" faz sentido porque hoje toda a inteligência mora isolada em `/assistente-ia` — aliás, um detalhe encontrado no código: **a rota `/assistente-ia` existe no `App.jsx`, mas não há nenhum `MenuItem` apontando para ela no `navMenuItems`** (o guia interno em `docs/GUIA_INSTALACAO_IA_ESTRUTURADA.md` mostra o item de menu como parte do passo-a-passo, mas ele não está presente no `App.jsx` atual) — ou seja, hoje o assistente pode estar **inacessível pela navegação normal**, o que reforça o ponto: a IA está isolada demais.

Princípio para embutir IA sem travar o sistema: **camada opcional, assíncrona, com fallback determinístico** — a IA nunca é obrigatória no caminho crítico; se falhar ou demorar, o app continua funcionando exatamente como hoje (regras locais).

Sugestões concretas, por tela:

| Onde | O que a IA faz | Por que não trava o fluxo |
|---|---|---|
| **`ConsultaDisponibilidade.jsx`** | Barra de busca em linguagem natural ("lab livre amanhã de manhã para 30 alunos") que roda em paralelo aos filtros estruturados já existentes | Os filtros manuais continuam lá; a IA só *pré-preenche* os campos, o usuário confirma |
| **`ProporAulaForm.jsx` / `ProporEventoForm.jsx`** | Autocompletar campos ao colar um texto livre (ex. e-mail do professor com a solicitação) — reaproveitando `ExtratorParametros.ts`, que já existe | É sugestão, não substituição: o formulário validado continua sendo a fonte da verdade |
| **`UploadCronogramaExterno.jsx` / `ImportarCronograma.jsx`** | Já existe reconhecimento de colunas por heurística (`parseCronogramaExterno.js`, `analisarItensImportados.js`) — usar a IA como **segunda camada** só quando a heurística tiver baixa confiança, para sugerir o mapeamento de colunas ambíguas | A heurística continua sendo o caminho padrão (rápido, sem custo de API); IA só entra como reforço pontual |
| **`AnaliseEstatisticas.jsx` / `AnaliseAulas.jsx` / `AnaliseEventos.jsx`** | Botão "Explicar este gráfico" que gera um resumo em texto do que os números mostram (ex. "labs de Anatomia estão com 85% de ocupação, acima da média") | Totalmente opt-in, sob demanda — não roda automaticamente, não bloqueia o carregamento da página |
| **`GerenciarAprovacoes.jsx`** | Resumo automático da proposta ("prova de Bioquímica, conflita com uma revisão já agendada no mesmo lab") ao lado de cada item da fila | Roda em segundo plano por item; se falhar, o coordenador só vê a proposta normal sem o resumo |
| **`PainelAvisos.jsx` / notificações Telegram** | Resumir/agrupar avisos do dia em uma frase antes da lista completa | Puramente aditivo — a lista completa continua existindo abaixo |
| **`predictionService.js`** | Hoje é só contagem/percentual (heurística simples). Pode virar um nó do grafo LangGraph que enriquece a previsão com contexto textual ("risco alto por causa de 3 provas concentradas na mesma semana") | O cálculo numérico continua sendo feito localmente; a IA só adiciona a explicação em texto |
| **Busca global (Command Palette, sugerida na seção 3)** | Interpretar comandos livres ("me leva pra aprovações de hoje") | Fallback: se a IA não responder rápido, cai automaticamente na busca por texto simples nos itens de menu |

Regra prática de engenharia para todos os casos acima: **timeout curto (2–3s) + skeleton local + cache por sessão**, e todo componente de IA deve ser **an island** (um componente isolado que pode falhar sem quebrar o componente pai) — nunca `await` dentro do render principal da página.

---

## 6. Roadmap sugerido

| Prioridade | Item | Área | Esforço |
|:---:|---|:---:|:---:|
| 🔴 1 | `Dialog fullScreen` em mobile para os principais formulários/modais | Mobile | Baixo |
| 🔴 2 | Trocar `Menu` dropdown mobile por `Drawer` + `BottomNavigation` | Mobile | Médio |
| 🔴 3 | Corrigir/expor a rota `/assistente-ia` no menu (hoje inacessível pela nav) | IA / Bug | Baixo |
| 🔴 4 | Componente genérico `ResponsiveDataView` (tabela ↔ cards) | Mobile/Usabilidade | Médio |
| 🟡 5 | Migrar orquestração da IA para LangGraph (`StateGraph` com os nós descritos na seção 4.3) | IA | Alto |
| 🟡 6 | Conectar de fato as `langchainTools.ts` ao `ExecutorAcoes.ts` (hoje as tools não executam nada real) | IA | Médio |
| 🟡 7 | Corrigir ou remover `ragService.js` (embeddings mockados, código morto) | IA | Baixo |
| 🟡 8 | Skeleton loaders + `EmptyState` padronizados em todas as listas | Usabilidade | Médio |
| 🟡 9 | Breakpoints + tipografia responsiva no `theme.js` | Mobile | Baixo |
| 🟢 10 | "Explicar gráfico" com IA nas telas de Análise | IA distribuída | Médio |
| 🟢 11 | Busca em linguagem natural na Consulta de Disponibilidade | IA distribuída | Médio |
| 🟢 12 | Command Palette global | Usabilidade | Médio |
| 🟢 13 | Swipe actions em cards de aprovação (mobile) | Mobile | Médio |

---

## 7. Resumo executivo

O CronoLab tem uma base sólida (Firebase Spark, tema institucional, IA híbrida), mas duas dívidas técnicas concretas explicam as duas queixas do pedido:

1. **Mobile parece "desajustado"** porque a responsividade foi feita **componente a componente** (só 3 arquivos usam `useMediaQuery`), sem um padrão estrutural de navegação (Drawer/bottom nav) nem de overlays (modais fullScreen, tabelas viram cards). A correção de maior impacto/menor esforço é o item 🔴1 e 🔴2 do roadmap.
2. **A IA está fragmentada em três implementações que não conversam entre si** (regex local, chamada direta à Groq, e um LangChain configurado mas nunca executado), com um serviço de RAG que nem é chamado e tem embeddings falsos. Migrar para **LangGraph** não é troca de biblioteca por biblioteca — é formalizar como grafo de estados um fluxo (classificar → confirmar → executar) que **hoje já existe, só que espalhado em `if/else` entre componente React e serviços**. Isso também é o que abre caminho pra "IA no site, não só no assistente": uma vez que existe um único orquestrador com nós reutilizáveis, fica natural plugar pequenos pontos de IA (resumir gráfico, explicar proposta, busca em linguagem natural) em vários lugares do app sem duplicar lógica e sem travar o fluxo principal, desde que cada um desses pontos siga a regra de ser opcional, assíncrono e com fallback determinístico.

---

*Análise baseada na leitura direta do código-fonte enviado (`ataque.md`), incluindo `theme.js`, `App.jsx`, `index.css`, `src/ia-estruturada/*`, `src/services/langchainService.js`, `src/services/ragService.js`, `src/services/predictionService.js` e as demais páginas/telas do projeto.*
