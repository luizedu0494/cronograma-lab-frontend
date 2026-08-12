# CronoLab — Correções e Melhorias (v2)
## Grade de Disponibilidade + Propor Aula (Coordenador)

> **Contexto:** A implementação A foi testada e identificou dois bugs estruturais que fazem a grade e os chips do Select mostrarem "Livre" para labs ocupados. Este documento descreve as causas raiz e as correções, além de uma nova proposta de fluxo para o coordenador na segunda etapa do ProporAulaForm.

---

## Índice

1. [Bug 1 — Grade sempre verde (problema de data)](#1-bug-1--grade-sempre-verde-problema-de-data)
2. [Bug 2 — Chips Livre/Parcial errados (problema de campo id vs name)](#2-bug-2--chips-livreparcial-errados-problema-de-campo-id-vs-name)
3. [Melhoria — Segunda etapa do ProporAula: grade por data ao invés de Select de lab](#3-melhoria--segunda-etapa-do-proporaula-grade-por-data)
4. [Estratégia de busca: query por dia ao invés de reutilizar array da semana](#4-estratégia-de-busca-query-por-dia)
5. [Ordem de implementação](#5-ordem-de-implementação)

---

## 1. Bug 1 — Grade sempre verde (problema de data)

### Causa raiz

A `GradeDisponibilidade` recebe `dataFoco` como string `'YYYY-MM-DD'` e tenta comparar com a data de cada aula assim:

```js
// ❌ Implementação atual — frequentemente falha
const dataAula = a.dataInicio?.toDate
  ? a.dataInicio.toDate().toISOString().slice(0, 10)
  : '';
return dataAula === dataFoco;
```

O problema está em **três pontos combinados**:

| Ponto | O que acontece |
|---|---|
| `dataFoco` vem da semana inteira | Quando a grade mostra a semana (09–15 ago), não é passado um dia específico — é passado o início da semana ou `undefined` |
| `toISOString()` usa UTC | Uma aula às `07:00` no fuso de Brasília (UTC-3) vira `10:00 UTC`, e `.slice(0,10)` pode retornar o dia anterior |
| Firestore Timestamp pode vir como objeto não-convertível | Se `a.dataInicio` é um `Timestamp` serializado (não instância viva), `.toDate()` não existe e a comparação retorna `''` |

### Correção

**Passo 1 — Normalizar a data sempre com dayjs no fuso local:**

```js
// ✅ Correto — usa dayjs para converter o Timestamp no fuso local
import dayjs from 'dayjs';

const toDataLocal = (dataInicio) => {
  if (!dataInicio) return '';
  // Caso 1: Timestamp do Firestore (instância viva)
  if (typeof dataInicio.toDate === 'function') {
    return dayjs(dataInicio.toDate()).format('YYYY-MM-DD');
  }
  // Caso 2: Timestamp serializado { seconds, nanoseconds }
  if (dataInicio.seconds !== undefined) {
    return dayjs(dataInicio.seconds * 1000).format('YYYY-MM-DD');
  }
  // Caso 3: string ISO ou Date nativa
  return dayjs(dataInicio).format('YYYY-MM-DD');
};
```

**Passo 2 — Passar `dataFoco` sempre como o dia selecionado, não a semana:**

```jsx
// Em CalendarioCronograma.jsx — ao renderizar a grade
// diaSelecionado deve ser o dia em foco no calendário (ex: 'Ter, 11/08')
// convertido para 'YYYY-MM-DD'

<GradeDisponibilidade
  aulas={aulasCarregadas}
  dataFoco={dayjs(diaSelecionado).format('YYYY-MM-DD')} // ← sempre um dia
  onCelulaClick={handleCelulaGrade}
/>
```

> **Se a grade deve cobrir a semana inteira**, passar `dataFoco` como `null` e mostrar
> todas as aulas da semana agrupadas por dia na grade — ver seção 4.

**Passo 3 — Filtro corrigido no `mapaOcupacao`:**

```js
// ✅ Versão corrigida do useMemo interno da GradeDisponibilidade
const mapaOcupacao = useMemo(() => {
  const mapa = {};

  aulas.forEach(a => {
    // Normaliza a data da aula para o fuso local
    const dataAula = toDataLocal(a.dataInicio);

    // Se dataFoco foi passado, filtra pelo dia; senão usa todas
    if (dataFoco && dataAula !== dataFoco) return;

    const labId = a.laboratorioSelecionado; // sempre usar o campo ID

    if (!mapa[labId]) mapa[labId] = new Set();

    // Normaliza horarioSlotString — pode ser string ou array
    const horarios = Array.isArray(a.horarioSlotString)
      ? a.horarioSlotString
      : a.horarioSlotString
        ? [a.horarioSlotString]
        : [];

    horarios.forEach(h => mapa[labId].add(h));
  });

  return mapa;
}, [aulas, dataFoco]);
```

**Passo 4 — Comparar sempre pelo `lab.id`, não pelo `lab.name`:**

```js
// ✅ Usar o ID do lab (ex: 'multidisciplinar_2') como chave do mapa
// pois é o que o Firestore guarda em laboratorioSelecionado

const celulaCor = (labId, horario) => {
  return mapaOcupacao[labId]?.has(horario) ? 'error' : 'success';
};
```

E na lista de labs da tabela:

```jsx
{labsVisiveis.map(lab => (
  <TableRow key={lab.id}>
    <TableCell>{lab.name}</TableCell>
    {BLOCOS.map(b => {
      const livre = !mapaOcupacao[lab.id]?.has(b.value); // ← lab.id, não lab.name
      return (
        <TableCell key={b.value}>
          <Chip
            label={livre ? 'Livre' : 'Ocupado'}
            color={livre ? 'success' : 'error'}
            size="small"
            clickable={livre}
            onClick={livre && onCelulaClick
              ? () => onCelulaClick({ labId: lab.id, labNome: lab.name, horario: b.value })
              : undefined}
          />
        </TableCell>
      );
    })}
  </TableRow>
))}
```

---

## 2. Bug 2 — Chips Livre/Parcial errados (problema de campo id vs name)

### Causa raiz

A função `statusLab()` no `ProporAulaForm.jsx` compara:

```js
// ❌ Compara name com laboratorioSelecionado
a.laboratorioSelecionado === labNome
// Ex: 'multidisciplinar_2' === 'Multidisciplinar 2'  → false (sempre)
```

O Firestore guarda o **id** (`'multidisciplinar_2'`) em `laboratorioSelecionado`, mas a função recebe o **name** (`'Multidisciplinar 2'`) que é o `value` usado no `Select`.

### Correção

**Opção A — Passar o `id` para `statusLab()` ao invés do `name`:**

```js
// ✅ statusLab recebe o id do lab
const statusLab = useCallback((labId) => {
  if (!formData.dataInicio) return 'indefinido';

  const dataStr = dayjs(formData.dataInicio).format('YYYY-MM-DD');

  const aulasDoLab = aulasDoMes.filter(a => {
    const dataAula = toDataLocal(a.dataInicio); // mesma função de normalização do Bug 1
    return (
      a.laboratorioSelecionado === labId &&   // ← comparar com id
      dataAula === dataStr &&
      ['aprovada', 'pendente'].includes(a.status)
    );
  });

  if (aulasDoLab.length === 0) return 'livre';

  const horariosOcupadosLab = new Set(
    aulasDoLab.flatMap(a =>
      Array.isArray(a.horarioSlotString)
        ? a.horarioSlotString
        : a.horarioSlotString ? [a.horarioSlotString] : []
    )
  );

  // Se não há horário selecionado ainda, só indica que tem algo agendado no dia
  if (!formData.horarioSlotString?.length) return 'parcial';

  const temConflito = formData.horarioSlotString.some(h => horariosOcupadosLab.has(h));
  return temConflito ? 'ocupado' : 'parcial';

}, [formData.dataInicio, formData.horarioSlotString, aulasDoMes]);
```

**Ajuste no `MenuItem` para passar `l.id`:**

```jsx
{LISTA_LABORATORIOS
  .filter(l => l.tipo === labSelection.tipo)
  .map(l => {
    const st = statusLab(l.id); // ← passa o id, não o name
    const { label, color } = CHIP_STATUS[st];
    return (
      <MenuItem key={l.id} value={l.name}> {/* value continua sendo name para o Select */}
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" gap={1}>
          <Typography variant="body2">{l.name}</Typography>
          <Chip label={label} color={color} size="small" variant={st === 'livre' ? 'filled' : 'outlined'} />
        </Box>
      </MenuItem>
    );
  })
}
```

> **Regra:** o `value` do `MenuItem` continua sendo `l.name` (para manter compatibilidade com o que já é salvo no Firestore via esse campo), mas a **verificação de ocupação** usa `l.id`.

---

## 3. Melhoria — Segunda etapa do ProporAula: grade por data

### Contexto

O problema relatado na segunda etapa do ProporAula é o mesmo da grade: chips mostram status errado. Mas além da correção técnica, há uma oportunidade de UX: ao invés de o coordenador escolher o laboratório num `Select` cego, **mostrar a grade de disponibilidade do dia escolhido** como interface principal de seleção na Seção 2.

### Novo fluxo para o coordenador

```
Seção 1 — Detalhes
  ↓ (título preenchido)

Seção 2 — Escolher data primeiro
  ├── DatePicker (data da aula)
  └── Grade de disponibilidade do dia aparece abaixo da data
        └── Colunas: blocos de horário
        └── Linhas: laboratórios (filtrável por tipo)
        └── Clique numa célula verde → lab + horário preenchidos

Seção 3 — Revisão e envio
  └── Resumo: data + lab + horário + cursos
  └── Botão "Agendar Agora" (coordenador) ou "Enviar Proposta" (técnico)
```

### O que muda na Seção 2

**Antes:** Seção 2 = Select de tipo de lab → Select de labs da lista.

**Depois (coordenador):** Seção 2 = DatePicker + grade de disponibilidade interativa.

```jsx
// ProporAulaForm.jsx — Seção 2 para coordenador
{isCoordenador ? (
  <Grid item xs={12}>
    <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #ff9800' }}>
      <Typography variant="h6" gutterBottom>2. Data e Disponibilidade</Typography>

      {/* DatePicker movido para cá na visão do coordenador */}
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
        <DatePicker
          label="Data da Aula *"
          value={formData.dataInicio}
          onChange={(val) => {
            setFormData(prev => ({ ...prev, dataInicio: val }));
            // Limpa lab/horário ao trocar a data
            setFormData(prev => ({ ...prev, dynamicLabs: [{ tipo: '', laboratorios: [] }], horarioSlotString: [] }));
          }}
          shouldDisableDate={isDayBlocked}
          slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
        />
      </LocalizationProvider>

      {/* Grade aparece assim que uma data válida é escolhida */}
      {formData.dataInicio && dayjs(formData.dataInicio).isValid() && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Disponibilidade em {dayjs(formData.dataInicio).format('dddd, DD/MM/YYYY')} — clique numa célula livre para selecionar
          </Typography>

          {/* Filtro rápido por tipo de lab — opcional */}
          <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
            <InputLabel>Filtrar por tipo de lab</InputLabel>
            <Select
              value={filtroTipoGrade}
              label="Filtrar por tipo de lab"
              onChange={e => setFiltroTipoGrade(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {TIPOS_LABORATORIO.map(t => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <GradeDisponibilidade
            aulas={aulasDoMes}
            dataFoco={dayjs(formData.dataInicio).format('YYYY-MM-DD')}
            tiposLab={filtroTipoGrade ? [filtroTipoGrade] : []}
            onCelulaClick={({ labId, labNome, horario }) => {
              const labEncontrado = LISTA_LABORATORIOS.find(l => l.id === labId);
              if (!labEncontrado) return;
              setFormData(prev => ({
                ...prev,
                dynamicLabs: [{ tipo: labEncontrado.tipo, laboratorios: [labNome] }],
                horarioSlotString: [horario],
              }));
            }}
          />

          {/* Feedback do que foi selecionado via grade */}
          {formData.dynamicLabs[0]?.laboratorios?.length > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              ✅ <strong>{formData.dynamicLabs[0].laboratorios[0]}</strong> — horário <strong>{formData.horarioSlotString[0]}</strong> selecionados.
              <Button size="small" sx={{ ml: 2 }} onClick={() => setFormData(prev => ({
                ...prev,
                dynamicLabs: [{ tipo: '', laboratorios: [] }],
                horarioSlotString: [],
              }))}>
                Limpar
              </Button>
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  </Grid>
) : (
  // Técnico: mantém o fluxo original com Select de laboratório
  <Grid item xs={12}>
    {/* ... seção 2 original ... */}
  </Grid>
)}
```

> **Técnico:** mantém o fluxo atual intacto (Seção 1 → Seção 2 com Select → Seção 3 com data/horário). Apenas o coordenador tem o novo fluxo com grade.

---

## 4. Estratégia de busca: query por dia ao invés de reutilizar array da semana

### Por que o array da semana não é suficiente

O array `aulasCarregadas` no calendário e `aulasDoMes` no ProporAulaForm são carregados com uma query ampla (semana ou mês inteiro). Eles **funcionam** para a grade, **desde que** a normalização de data e a comparação de campos estejam corretas (correções dos Bugs 1 e 2 acima).

Porém, se após as correções ainda houver divergência, a causa mais provável é que a query ampla não inclui todas as aulas do dia — por exemplo, se a query usa `where('status', '==', 'aprovada')` mas aulas `pendente` também ocupam o lab.

### Correção complementar — incluir status `pendente` na query

```js
// ✅ Garantir que aulas pendentes também bloqueiam o lab
const q = query(
  collection(db, 'aulas'),
  where('dataInicio', '>=', Timestamp.fromDate(inicioSemana.toDate())),
  where('dataInicio', '<=', Timestamp.fromDate(fimSemana.toDate())),
  where('status', 'in', ['aprovada', 'pendente']) // ← pendentes também ocupam
);
```

### Query pontual por dia (alternativa mais precisa para a grade)

Se o coordenador seleciona um dia na grade e a semana não tem dados suficientemente precisos, fazer uma query específica para aquele dia:

```js
// Hook usável tanto na GradeDisponibilidade quanto no ProporAulaForm
async function buscarAulasPorDia(data) {
  const inicio = Timestamp.fromDate(dayjs(data).startOf('day').toDate());
  const fim    = Timestamp.fromDate(dayjs(data).endOf('day').toDate());

  const snap = await getDocs(query(
    collection(db, 'aulas'),
    where('dataInicio', '>=', inicio),
    where('dataInicio', '<=', fim),
    where('status', 'in', ['aprovada', 'pendente'])
  ));

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
```

Chamar `buscarAulasPorDia` toda vez que `dataFoco` muda no calendário ou `formData.dataInicio` muda no ProporAulaForm, e passar o resultado para a grade. Isso garante dados sempre frescos e precisos para o dia consultado.

**Custo no plano Spark:** 1 query por dia consultado. Com `getDocs` (pontual, sem listener), sem risco de acumular listeners.

```jsx
// Em ProporAulaForm.jsx
const [aulasNoDia, setAulasNoDia] = useState([]);
const [loadingDia, setLoadingDia] = useState(false);

useEffect(() => {
  if (!formData.dataInicio || !dayjs(formData.dataInicio).isValid()) return;

  setLoadingDia(true);
  buscarAulasPorDia(dayjs(formData.dataInicio).format('YYYY-MM-DD'))
    .then(setAulasNoDia)
    .finally(() => setLoadingDia(false));

}, [formData.dataInicio]);

// Passar aulasNoDia para a grade (mais preciso que aulasDoMes)
<GradeDisponibilidade
  aulas={aulasNoDia}
  dataFoco={dayjs(formData.dataInicio).format('YYYY-MM-DD')}
  onCelulaClick={handleCelulaGrade}
  loading={loadingDia}
/>
```

---

## 5. Ordem de implementação

Seguir esta ordem evita regredir funcionalidades que já estão funcionando:

```
Passo 1 — Criar a função toDataLocal()
  └── Arquivo utilitário: src/utils/dateHelper.js
  └── Exportar e importar nos dois componentes afetados

Passo 2 — Corrigir GradeDisponibilidade.jsx
  └── Substituir o filtro de data pelo uso de toDataLocal()
  └── Garantir comparação por lab.id em todas as referências

Passo 3 — Corrigir statusLab() no ProporAulaForm.jsx
  └── Passar l.id para statusLab() ao invés de l.name
  └── Usar toDataLocal() no filtro de aulasDoMes

Passo 4 — Adicionar query por dia (buscarAulasPorDia)
  └── Arquivo: src/utils/aulaQueries.js
  └── Usar no ProporAulaForm ao trocar a data (useEffect)
  └── Opcional no Calendário (se array da semana ainda errar)

Passo 5 — Novo fluxo da Seção 2 para coordenador
  └── Separar JSX da Seção 2 por perfil (isCoordenador)
  └── Mover DatePicker para Seção 2 na visão do coordenador
  └── Integrar GradeDisponibilidade com aulasNoDia
```

### Arquivo utilitário sugerido: `src/utils/dateHelper.js`

```js
import dayjs from 'dayjs';

/**
 * Converte qualquer formato de data do Firestore para 'YYYY-MM-DD' no fuso local.
 * Suporta: Timestamp instância, Timestamp serializado { seconds }, string ISO, Date nativa.
 */
export function toDataLocal(dataInicio) {
  if (!dataInicio) return '';
  if (typeof dataInicio.toDate === 'function') {
    return dayjs(dataInicio.toDate()).format('YYYY-MM-DD');
  }
  if (dataInicio.seconds !== undefined) {
    return dayjs(dataInicio.seconds * 1000).format('YYYY-MM-DD');
  }
  return dayjs(dataInicio).format('YYYY-MM-DD');
}

/**
 * Normaliza horarioSlotString para sempre retornar um array de strings.
 * Suporta: string única, array de strings, undefined/null.
 */
export function toHorariosArray(horarioSlotString) {
  if (!horarioSlotString) return [];
  if (Array.isArray(horarioSlotString)) return horarioSlotString;
  return [horarioSlotString];
}
```

Importar em `GradeDisponibilidade.jsx`, `ProporAulaForm.jsx` e qualquer outro componente que precise comparar datas ou horários de aulas do Firestore.

---

## Resumo das causas e correções

| Sintoma observado | Causa raiz | Correção |
|---|---|---|
| Grade sempre verde, mesmo com aulas no calendário | Comparação de data com UTC em vez de fuso local; `dataFoco` podendo ser `undefined` | `toDataLocal()` + `dayjs().format()` + garantir que `dataFoco` é sempre um dia específico |
| Chips Livre/Parcial errados no Select de lab | `statusLab()` compara `l.name` com `a.laboratorioSelecionado` que guarda o `l.id` | Passar `l.id` para `statusLab()` e comparar com o campo correto do Firestore |
| Disponibilidade imprecisa na segunda etapa | Array do mês pode não ter todos os status; fuso UTC distorce datas | Query pontual `buscarAulasPorDia()` com `status in ['aprovada','pendente']` |
| Coordenador descobre conflito tarde demais | Fluxo força escolher lab antes de ver disponibilidade | Mover DatePicker para Seção 2 e exibir grade interativa logo após escolher a data |

---

*CronoLab — CESMAC · Versão analisada: v2 (React 19, MUI v7, Firebase Spark)*
