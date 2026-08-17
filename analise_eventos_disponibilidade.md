# CronoLab — Análise e Proposta de Melhorias
## Módulo de Eventos + Nova Feature: Consulta de Disponibilidade por Período

> **Contexto:** Análise comparativa entre `EventosManutencao.jsx` (módulo legado) e `GerenciarAulasAvancado.jsx` (módulo moderno), com proposta de refatoração e nova funcionalidade de consulta de disponibilidade para coordenadores.

---

## 1. Diagnóstico: Por que o agendamento de eventos é lento?

### 1.1 Comparativo entre os dois módulos

| Característica | `EventosManutencao.jsx` (atual) | `GerenciarAulasAvancado.jsx` (referência) |
|---|---|---|
| **Estratégia de leitura Firestore** | `onSnapshot` — listener em tempo real para **toda** a coleção `eventosManutencao` sem filtros | `getDocs` com `query` + `where` composto, paginação por `startAfter` (25 por página) |
| **Paginação** | ❌ Não tem — carrega todos os eventos de uma vez | ✅ Paginação cursor-based com histórico de navegação |
| **Filtragem** | ❌ Sem filtros de busca na listagem | ✅ Filtros por data, laboratório, horário, status, assunto |
| **Edição em lote** | ❌ Edita apenas um evento por vez | ✅ Seleção múltipla com edição e exclusão em lote via `writeBatch` |
| **Verificação de conflitos** | ⚠️ Verifica apenas pela `dataInicio` exata — não cobre intervalo de horário nem múltiplos laboratórios | ✅ Usa `where` em range de `dataInicio`/`dataFim` por laboratório específico |
| **Log de auditoria** | ❌ Sem registro de quem fez o quê | ✅ `loggerService` com `serverTimestamp`, uid, nome e snapshot dos dados |
| **Repetição de eventos** | ❌ Cria um documento por slot de horário em loop sequencial | ✅ `writeBatch` agrupa até 500 escritas atômicas |
| **Campo `dataFim`** | ⚠️ Calculado na hora do submit — mas ao editar, tenta inferir pelo horário de início/fim (frágil) | ✅ `dataFim` sempre persistido como `Timestamp` independente |
| **Validação de formulário** | Validação simples inline | Separada em lógica de handlers reutilizáveis |
| **Performance de re-renders** | Sem `useCallback`/`useMemo` | Handlers memoizados com `useCallback`; ações de resultados com `useMemo` |

### 1.2 O gargalo principal

O `EventosManutencao.jsx` usa `onSnapshot` **sem nenhuma cláusula `where`**. Isso significa que toda vez que qualquer evento é criado, editado ou excluído em qualquer lugar do sistema, o listener reprocessa **toda a coleção** e empurra o estado atualizado para todos os clientes conectados. Com o crescimento do volume de eventos ao longo do ano letivo, isso se torna progressivamente mais lento e consome mais leituras do plano Spark.

Além disso, o loop `for (const slot of formData.horarios)` no `handleSubmit` faz escritas sequenciais no Firestore — se o usuário selecionar 3 horários, são 3 operações separadas, cada uma esperando a anterior terminar.

---

## 2. Proposta: `GerenciarEventosAvancado.jsx`

Novo componente que substitui `EventosManutencao.jsx`, trazendo paridade total com o módulo de aulas.

### 2.1 Mudanças na arquitetura de dados

**Schema do documento `eventosManutencao` — proposto:**

```js
{
  // Campos atuais (mantidos)
  titulo: "Manutenção preventiva",
  descricao: "Troca de reagentes",
  tipo: "Manutenção",           // EVENT_TYPES
  laboratorio: "Lab Anatomia 1",
  dataInicio: Timestamp,         // início do bloco
  dataFim: Timestamp,            // fim do bloco (obrigatório, sempre persistido)
  horarioSlotString: "07:00-09:10",

  // Campos novos (espelhando 'aulas')
  status: "aprovado",            // "aprovado" | "pendente" | "cancelado"
  laboratorios: ["Lab Anatomia 1", "Lab Microscopia"],  // suporte a múltiplos labs
  recorrencia: null,             // null | { tipo: "semanal", diasSemana: [2,4], ate: Timestamp }
  criadoPorUid: "uid123",
  criadoPorNome: "Coord. Fulano",
  criadoEm: serverTimestamp(),
  atualizadoEm: serverTimestamp(),
}
```

### 2.2 Funcionalidades a implementar (espelhando `GerenciarAulasAvancado`)

#### Listagem com filtros avançados
```
┌─────────────────────────────────────────────────────────┐
│  Filtros Avançados                                       │
│  [Data Início] [Data Fim] [Tipo] [Laboratório(s)]        │
│  [Status]      [Busca por título]     [Buscar] [Limpar]  │
└─────────────────────────────────────────────────────────┘
```
- Substituir `onSnapshot` global por `getDocs` com `query` composta
- Paginação cursor-based (25 eventos por página, igual às aulas)
- Busca local por título após o fetch (mesmo padrão do filtro de `assunto`)

#### Seleção múltipla e ações em lote
- Checkbox por linha + "Selecionar Todos"
- **Editar selecionados** (em lote via `writeBatch`): tipo, status, laboratório
- **Excluir selecionados** (em lote via `writeBatch`)
- Log de auditoria em `logs` para todas as ações (igual ao `loggerService`)

#### Criação com suporte a múltiplos laboratórios e recorrência
```
┌─────────────────── Novo Evento ────────────────────────┐
│ Título *                                                │
│ Descrição                                               │
│ Tipo: [Manutenção ▼]    Status: [Aprovado ▼]           │
│ Área: [Ciências da Saúde ▼]                            │
│ Laboratório(s): [Anatomia 1] [Microscopia] [+ Adicionar]│
│ Data *: [DD/MM/YYYY]    Horário(s) *: [07:00-09:10 ▼]  │
│                                                         │
│ ┌─ Recorrência (opcional) ──────────────────────────┐  │
│ │ □ Repetir semanalmente                            │  │
│ │   Dias: [Seg] [Ter] [Qua] [Qui] [Sex]            │  │
│ │   Repetir até: [DD/MM/YYYY]                       │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ ⚠️ Verificação de conflitos com aulas e eventos         │
│ [Cancelar]                        [Adicionar Evento]    │
└─────────────────────────────────────────────────────────┘
```

#### Verificação de conflitos aprimorada
Substituir a verificação atual (`where("dataInicio", "==", ...)`) por uma query de range real:
```js
// Detecta qualquer aula/evento que sobreponha o intervalo
where('laboratorioSelecionado', 'in', formData.laboratorios)
where('dataInicio', '<', finalEnd)
where('dataFim', '>', finalStart)
```

#### Uso de `writeBatch` para criação com múltiplos horários
```js
// Em vez do loop sequencial atual:
const batch = writeBatch(db);
for (const slot of formData.horarios) {
  const ref = doc(collection(db, 'eventosManutencao'));
  batch.set(ref, eventoData(slot));
}
await batch.commit(); // 1 operação de rede em vez de N
```

---

## 3. Nova Feature: Consulta de Disponibilidade por Período

### 3.1 O problema

Um coordenador quer saber: *"Quais terças e quintas do segundo semestre os laboratórios de Anatomia 1, Microscopia da Galeria e Ney Braga 2, 3 e 4 estão livres no horário da tarde?"* — hoje essa resposta exige ir ao calendário data por data.

### 3.2 Proposta: `ConsultaDisponibilidade.jsx`

Novo componente dedicado, acessível no menu do coordenador. Interface em dois passos:

---

#### Passo 1 — Configurar a consulta

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 Consulta de Disponibilidade por Período                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Período                                                     │
│  [01/02/2026] até [30/06/2026]                               │
│                                                              │
│  Dias da semana                                              │
│  [Seg] [Ter✓] [Qua] [Qui✓] [Sex] [Sáb]                     │
│                                                              │
│  Horários                                                    │
│  [07:00-09:10] [09:30-12:00] [13:00-15:10✓] [15:30-18:00✓] │
│  [18:30-20:10] [20:30-22:00]                                 │
│                                                              │
│  Laboratórios                                                │
│  [Anatomia 1✓] [Microscopia da Galeria✓] [Ney Braga 2✓]     │
│  [Ney Braga 3✓] [Ney Braga 4✓]                              │
│                                                              │
│  Mostrar apenas datas onde TODOS os labs estão livres: [✓]   │
│                                                              │
│  [Limpar]                    [🔍 Consultar Disponibilidade]  │
└──────────────────────────────────────────────────────────────┘
```

---

#### Passo 2 — Resultado

```
┌──────────────────────────────────────────────────────────────┐
│  Resultado — Terças e quintas (13:00-18:00)                  │
│  Anatomia 1 · Microscopia da Galeria · Ney Braga 2, 3, 4    │
├──────────────────────────────────────────────────────────────┤
│  ✅ 15 datas disponíveis · ⚠️ 8 datas com conflito           │
│                                                              │
│  [📋 Copiar lista]  [📥 Exportar CSV]  [📅 Exportar .ics]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  MARÇO 2026                                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ✅ Ter, 03/03  │ 13:00-15:10 │ 15:30-18:00 │ LIVRE │     │
│  │ ✅ Qui, 05/03  │ 13:00-15:10 │ 15:30-18:00 │ LIVRE │     │
│  │ ⚠️ Ter, 10/03  │ 13:00-15:10 │ ~~15:30~~   │ PARCIAL│    │
│  │   └─ Anatomia 1 ocupada: "Embriologia - Prof. X"  │     │
│  │ ✅ Qui, 12/03  │ 13:00-15:10 │ 15:30-18:00 │ LIVRE │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ABRIL 2026                                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ✅ Ter, 07/04  │ 13:00-15:10 │ 15:30-18:00 │ LIVRE │     │
│  │ ❌ Qui, 09/04  │  FERIADO — Semana Santa            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.3 Lógica de implementação

#### Hook `useDisponibilidade`
```js
// src/hooks/useDisponibilidade.ts
async function consultarDisponibilidade({
  dataInicio, dataFim,
  diasSemana,      // [2, 4] = terça e quinta
  horarios,        // ["13:00-15:10", "15:30-18:00"]
  laboratorios,    // ["Lab Anatomia 1", "Microscopia da Galeria", ...]
  apenasLivres,    // boolean
}) {
  // 1. Gerar lista de datas no intervalo que batem com os diasSemana
  const datasAlvo = gerarDatasNoPeriodo(dataInicio, dataFim, diasSemana);

  // 2. Uma única query Firestore — buscar TODAS as aulas e eventos
  //    nos labs selecionados, no período inteiro
  const [aulas, eventos] = await Promise.all([
    getDocs(query(
      collection(db, 'aulas'),
      where('laboratorioSelecionado', 'in', laboratorios),
      where('dataInicio', '>=', Timestamp.fromDate(dataInicio)),
      where('dataInicio', '<=', Timestamp.fromDate(dataFim)),
      where('status', '==', 'aprovada'),
    )),
    getDocs(query(
      collection(db, 'eventosManutencao'),
      where('laboratorio', 'in', [...laboratorios, 'Todos']),
      where('dataInicio', '>=', Timestamp.fromDate(dataInicio)),
      where('dataInicio', '<=', Timestamp.fromDate(dataFim)),
    )),
  ]);

  // 3. Indexar os ocupados por data e lab (processamento local, sem leituras extras)
  const ocupados = indexarOcupados([...aulas.docs, ...eventos.docs]);

  // 4. Para cada data alvo + horário + lab, classificar
  return datasAlvo.map(data => ({
    data,
    status: calcularStatusData(data, horarios, laboratorios, ocupados),
    conflitos: getConflitosDetalhados(data, horarios, laboratorios, ocupados),
  }));
}
```

**Custo Firestore estimado:** 2 leituras de query (aulas + eventos) + N documentos retornados — versus a abordagem ingênua de N consultas individuais por data (que poderia ser centenas de leituras).

#### Função `gerarDatasNoPeriodo`
```js
function gerarDatasNoPeriodo(inicio, fim, diasSemana) {
  // diasSemana: array com números 0(dom)..6(sáb) no padrão dayjs
  const datas = [];
  let cursor = dayjs(inicio);
  while (cursor.isBefore(dayjs(fim).add(1, 'day'))) {
    if (diasSemana.includes(cursor.day())) {
      datas.push(cursor.toDate());
    }
    cursor = cursor.add(1, 'day');
  }
  return datas;
}
```

#### Exportação de resultado
- **Copiar lista**: formata as datas disponíveis como texto plain e copia para a área de transferência
- **Exportar CSV**: gera arquivo `disponibilidade_labs_YYYYMMDD.csv` com colunas: Data, DiaSemana, Horario, Laboratorio, Status, ConflitoCom
- **Exportar .ics**: gera arquivo iCalendar para importar diretamente no Google Calendar, Outlook ou Apple Calendar — cada data livre vira um evento de "janela disponível"

---

## 4. Roadmap de implementação

### Sprint 1 — Refatoração do EventosManutencao (1 semana)

| Tarefa | Arquivo | Prioridade |
|---|---|---|
| Substituir `onSnapshot` por `getDocs` + query com filtros | `GerenciarEventosAvancado.jsx` (novo) | 🔴 Alta |
| Implementar paginação cursor-based (25/página) | idem | 🔴 Alta |
| Usar `writeBatch` na criação de múltiplos horários | idem | 🔴 Alta |
| Verificação de conflitos por range de horário (não `==`) | idem | 🔴 Alta |
| Seleção múltipla + edição/exclusão em lote | idem | 🟡 Média |
| Suporte a múltiplos laboratórios no mesmo evento | idem | 🟡 Média |
| Log de auditoria via `loggerService` | idem | 🟡 Média |

### Sprint 2 — Consulta de Disponibilidade (1 semana)

| Tarefa | Arquivo | Prioridade |
|---|---|---|
| Hook `useDisponibilidade` com query otimizada | `hooks/useDisponibilidade.ts` | 🔴 Alta |
| Componente de filtros (período, dias, horários, labs) | `ConsultaDisponibilidade.jsx` | 🔴 Alta |
| Componente de resultado agrupado por mês | `components/ResultadoDisponibilidade.jsx` | 🔴 Alta |
| Exportação CSV | idem | 🟡 Média |
| Exportação .ics | idem | 🟡 Média |
| Rota no `App.jsx` e entrada no menu do coordenador | `App.jsx` | 🔴 Alta |

### Sprint 3 — Polimento e integrações (3–4 dias)

| Tarefa | Prioridade |
|---|---|
| Suporte a recorrência semanal na criação de eventos | 🟢 Baixa |
| Integrar resultado da consulta com o botão "Agendar Evento" diretamente da lista | 🟡 Média |
| Notificação Telegram ao criar eventos em lote | 🟡 Média |
| Regras Firestore: nova coleção se necessário, ajuste de índices | 🔴 Alta |

---

## 5. Ajustes no Firestore

### Índices compostos necessários (novo componente)
Adicionar em `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "eventosManutencao",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "laboratorio", "order": "ASCENDING" },
        { "fieldPath": "dataInicio", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "eventosManutencao",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dataInicio", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Regras Firestore (sem mudança)
A regra atual já cobre o necessário:
```
match /eventosManutencao/{eventoId} {
  allow read: if isUserApproved();
  allow write: if isCoordinator();
}
```

---

## 6. Resumo de impacto esperado

| Métrica | Antes | Depois |
|---|---|---|
| **Leituras Firestore para carregar eventos** | N docs (toda a coleção, em tempo real) | ≤ 25 docs por página (sob demanda) |
| **Leituras para criar 3 eventos de horários diferentes** | 3 operações de rede sequenciais | 1 `writeBatch` atômico |
| **Tempo para responder "quais labs estão livres na terça?"** | Processo manual (visita data por data) | < 3 segundos (2 queries + processamento local) |
| **Leituras para consulta de disponibilidade (60 terças/quintas)** | Impossível ou ~120 queries | 2 queries (aulas + eventos no período) |
| **Suporte a auditoria de eventos** | ❌ | ✅ (log automático por `loggerService`) |
