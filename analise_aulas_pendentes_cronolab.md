# CronoLab — Análise: Aulas Pendentes Sendo Tratadas como Agendadas

> **Escopo:** `src/ProporEventoForm.jsx` · `src/pages/Cronograma/CalendarioCronograma.jsx` · `src/pages/Gerenciar/GerenciarAprovacoes.jsx` · `src/hooks/useDisponibilidade.ts` · `firestore.rules`

---

## 1. Descrição do Problema

Quando um **técnico propõe uma aula**, o sistema a salva na coleção `aulas` com `status: 'pendente'`. O comportamento esperado é:

- A proposta fica **aguardando aprovação** do coordenador.
- **Visualmente**, pode aparecer no calendário com aparência diferenciada (chip laranja "Pendente"), pois há filtro de tipo para isso.
- **Operacionalmente**, não deve ocupar horário, não deve bloquear o slot de disponibilidade e não deve ser tratada como agendamento confirmado em nenhuma lógica de negócio.

O comportamento **atual** é:

- A proposta é inserida na coleção `aulas` com `status: 'pendente'` e permanece lá até aprovação/rejeição.
- Partes do sistema **não filtram por status** ao buscar aulas, fazendo com que a proposta pendente seja lida, renderizada e, em alguns fluxos, tratada como aula real.
- Componentes de **verificação de conflito na importação** (`verificarConflitos`) consultam explicitamente `status in ['aprovada', 'pendente']`, ou seja, uma proposta pendente já **bloqueia horários** para novas importações.
- O calendário principal (`CalendarioCronograma`) busca aulas **sem filtro de status**, exibindo pendentes misturadas com aprovadas na grade — embora o chip indique visualmente o estado, o evento ocupa espaço visual como se fosse confirmado.

---

## 2. Mapeamento da Causa-Raiz por Arquivo

### 2.1 `ProporEventoForm.jsx` — criação correta, mas consequências não isoladas

O técnico salva a proposta assim (linha ~6806):

```js
await addDoc(collection(db, 'aulas'), {
  ...novaProposta,
  status: 'pendente',  // ✅ correto
});
```

O problema **não está na criação** — está em como o resto do sistema lê essa coleção sem sempre filtrar pelo status.

---

### 2.2 `CalendarioCronograma.jsx` — busca sem filtro de status

O calendário principal busca aulas para exibição assim:

```js
// Sem where('status', ...) — busca TUDO
let q = collection(db, 'aulas');
if (laboratoriosFiltro.length > 0) {
  q = query(q, where('laboratorioSelecionado', 'in', laboratoriosFiltro));
}
if (anoFiltro) {
  q = query(q, where('dataInicio', '>=', startOfYear), where('dataInicio', '<=', endOfYear));
}
const querySnapshot = await getDocs(q);
let listaCompleta = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

setPropostas(listaCompleta);              // todas (aprovadas + pendentes + rejeitadas)
setAulas(listaCompleta.filter(a => a.status === 'aprovada')); // só aprovadas para análise interna
```

O estado `propostas` (com pendentes) alimenta partes do calendário que renderizam eventos. Mesmo que o chip mostre "Pendente", o evento aparece no slot de horário como se fosse real, ocupando espaço visual e podendo confundir coordenadores e técnicos.

**Efeito colateral:** ao renderizar uma aula pendente no calendário, o coordenador pode acreditar que o horário já está ocupado e rejeitar a proposta por "conflito" — quando na verdade o horário está livre (pois `useDisponibilidade` filtra corretamente por `status === 'aprovada'`). Isso cria uma **inconsistência de percepção**: a disponibilidade diz "livre", mas o calendário mostra algo no horário.

---

### 2.3 `verificarConflitos` (utilitário de importação) — pendente bloqueia horário

```js
// src/ImportarCronograma.jsx ou utilitário similar
const snap = await getDocs(query(
  collection(db, 'aulas'),
  where('dataInicio', '>=', ...),
  where('dataInicio', '<=', ...),
  where('status', 'in', ['aprovada', 'pendente'])  // ← pendente bloqueia slot
));
```

Isso faz com que uma proposta que **ainda não foi aprovada** impeça a importação de uma nova aula para o mesmo laboratório e horário. Se a proposta for rejeitada depois, o bloqueio some — mas durante a janela de análise do coordenador, o slot fica artificialmente travado.

---

### 2.4 `useDisponibilidade.ts` — comportamento correto (referência)

Este hook está **correto**. Ele filtra exclusivamente por `status === 'aprovada'`:

```ts
getDocs(query(
  collection(db, 'aulas'),
  where('dataInicio', '>=', startTs),
  where('dataInicio', '<=', endTs),
  where('status', '==', 'aprovada')  // ✅ correto — pendente não ocupa slot
))
```

Isso significa que o formulário de proposta e a grade de disponibilidade funcionam corretamente. O problema se concentra nos **pontos de leitura do calendário e de conflito na importação**.

---

### 2.5 `firestore.rules` — correto mas sem separação de coleção

As regras permitem que técnicos criem documentos na coleção `aulas` com `status === 'pendente'` — o que é intencional. O design atual **une propostas e aulas aprovadas na mesma coleção**, o que é a raiz arquitetural do problema. Não é um bug de segurança, mas é uma decisão de design que exige disciplina em todos os pontos de leitura.

---

## 3. Classificação dos Pontos Afetados

| Local | Comportamento Atual | Grau do Problema |
|---|---|---|
| `CalendarioCronograma.jsx` | Busca todas as aulas, renderiza pendentes no calendário | 🔴 Alto — confunde visualmente |
| `verificarConflitos` (importação) | Pendente bloqueia slot para importação | 🟠 Médio — impede importações legítimas |
| `GradeDisponibilidade` via `useDisponibilidade` | Filtra `status === 'aprovada'` corretamente | ✅ OK |
| `GerenciarAprovacoes.jsx` | Lista pendentes separadamente, não as trata como aprovadas | ✅ OK |
| `MinhasPropostas.jsx` | Mostra status corretamente ao técnico | ✅ OK |
| `HistoricoAulas.jsx` / `AnaliseAulas.jsx` | Tem filtro de status, mas default pode incluir pendentes | 🟡 Baixo — depende do filtro padrão |

---

## 4. Correções Recomendadas

### 4.1 (Prioritária) Filtrar por status no `CalendarioCronograma`

O calendário deve separar o que **renderizar como evento oficial** do que **mostrar como proposta pendente**.

**Abordagem recomendada:** duas queries separadas ou um filtro em memória pós-busca, com renderização diferenciada.

```jsx
// Em CalendarioCronograma.jsx — após a busca
const listaCompleta = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

const aulasAprovadas  = listaCompleta.filter(a => a.status === 'aprovada');
const aulasPendentes  = listaCompleta.filter(a => a.status === 'pendente');
const aulasRejeitadas = listaCompleta.filter(a => a.status === 'rejeitada');

setAulas(aulasAprovadas);            // base para todos os cálculos de ocupação
setPropostas(aulasPendentes);        // exibição separada, apenas visual
```

No calendário, renderizar pendentes com **opacidade reduzida e estilo tracejado**, deixando claro que são propostas aguardando aprovação — não aulas confirmadas:

```jsx
// Estilo condicional no EventoCard ou similar
sx={{
  opacity: aula.status === 'pendente' ? 0.55 : 1,
  border: aula.status === 'pendente' ? '2px dashed #ed6c02' : 'none',
  pointerEvents: aula.status === 'pendente' ? 'auto' : 'auto', // mantém clicável
}}
```

---

### 4.2 Corrigir `verificarConflitos` na importação

Remover `'pendente'` da lista de status que bloqueiam slots:

```js
// Antes:
where('status', 'in', ['aprovada', 'pendente'])

// Depois:
where('status', '==', 'aprovada')
```

Uma proposta pendente **não é uma aula confirmada** e não deve impedir a importação de novas aulas. Se houver conflito real após a aprovação, o coordenador verá o alerta de conflito no `GerenciarAprovacoes` (que já tem essa lógica implementada corretamente via `conflitosMap`).

---

### 4.3 Adicionar filtro de status visível no calendário

Para coordenadores que queiram ver ou ocultar pendentes, adicionar um toggle no filtro do calendário:

```jsx
// No painel de filtros do CalendarioCronograma
<FormControlLabel
  control={
    <Switch
      checked={exibirPendentes}
      onChange={e => setExibirPendentes(e.target.checked)}
      size="small"
    />
  }
  label={
    <Box display="flex" alignItems="center" gap={0.5}>
      <Typography variant="caption">Mostrar propostas pendentes</Typography>
      {aulasPendentes.length > 0 && (
        <Chip label={aulasPendentes.length} size="small" color="warning" sx={{ height: 16 }} />
      )}
    </Box>
  }
/>
```

Isso preserva a visibilidade das pendentes para o coordenador (útil para contexto), mas deixa claro que são propostas — não aulas confirmadas.

---

### 4.4 Legenda visual no calendário

Adicionar uma legenda compacta no topo do calendário, abaixo dos filtros:

```jsx
<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1, alignItems: 'center' }}>
  <Box display="flex" alignItems="center" gap={0.5}>
    <Box sx={{ width: 12, height: 12, bgcolor: 'success.main', borderRadius: 0.5 }} />
    <Typography variant="caption">Aprovada</Typography>
  </Box>
  <Box display="flex" alignItems="center" gap={0.5}>
    <Box sx={{ width: 12, height: 12, border: '2px dashed #ed6c02', borderRadius: 0.5 }} />
    <Typography variant="caption">Pendente (aguarda aprovação)</Typography>
  </Box>
  <Box display="flex" alignItems="center" gap={0.5}>
    <Box sx={{ width: 12, height: 12, bgcolor: 'error.light', borderRadius: 0.5 }} />
    <Typography variant="caption">Rejeitada</Typography>
  </Box>
</Box>
```

---

### 4.5 (Opcional — longo prazo) Separar coleções `propostas` e `aulas`

A raiz arquitetural do problema é que propostas e aulas confirmadas vivem na mesma coleção. Uma separação resolveria definitivamente a necessidade de filtrar por status em cada ponto de leitura:

| Situação | Coleção |
|---|---|
| Técnico propõe → aguarda aprovação | `propostas` |
| Coordenador aprova → move para cronograma | `aulas` |
| Coordenador rejeita → documento permanece em `propostas` como rejeitado | `propostas` |

**Prós:** nenhum ponto de leitura de `aulas` precisaria filtrar por status — a coleção só teria aulas aprovadas. A coleção `propostas` seria lida apenas em `MinhasPropostas` e `GerenciarAprovacoes`.

**Contras:** requer migração dos dados existentes, mudanças nas Firestore Rules e refatoração de todos os componentes que hoje leem de `aulas`. No plano Spark, a separação também reduz o número de leituras em consultas que hoje buscam tudo para filtrar no cliente.

> Para o momento atual do projeto, **a correção 4.1 + 4.2 resolve o problema sem refatoração pesada** e deve ser priorizada.

---

## 5. Resumo das Ações

| # | Ação | Arquivo | Prioridade |
|---|---|---|---|
| 4.1 | Separar `aulasAprovadas` e `aulasPendentes` na busca e na renderização | `CalendarioCronograma.jsx` | 🔴 Alta |
| 4.2 | Remover `'pendente'` da query de verificação de conflitos na importação | Utilitário de importação / `ImportarCronograma.jsx` | 🔴 Alta |
| 4.3 | Adicionar toggle "Mostrar pendentes" nos filtros do calendário | `CalendarioCronograma.jsx` | 🟠 Média |
| 4.4 | Adicionar legenda visual de status no calendário | `CalendarioCronograma.jsx` | 🟡 Baixa |
| 4.5 | Separar coleções `propostas` e `aulas` | Firestore + múltiplos componentes | 🔵 Longo prazo |

---

## 6. Comportamento Esperado Após as Correções

```
Técnico propõe aula
        ↓
Documento salvo em 'aulas' com status: 'pendente'
        ↓
┌─────────────────────────────────────────────┐
│ CalendarioCronograma                        │
│ ✅ Aula aprovada → renderizada normalmente  │
│ 🔶 Proposta pendente → renderizada com      │
│    borda tracejada + opacidade reduzida     │
│    (apenas se toggle "Mostrar pendentes"    │
│     estiver ativado)                        │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│ useDisponibilidade / Grade                  │
│ ✅ Pendente não ocupa slot (já correto)     │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│ verificarConflitos (importação)             │
│ ✅ Pendente não bloqueia importações        │
└─────────────────────────────────────────────┘
        ↓
Coordenador aprova ou rejeita em GerenciarAprovacoes
        ↓
✅ Se aprovada: status muda para 'aprovada'
   → aparece normalmente em todos os componentes
✅ Se rejeitada: status muda para 'rejeitada'
   → some do calendário (ou aparece com estilo rejeitado)
```

---

*Análise gerada sobre o código-fonte do CronoLab — agosto de 2026.*
