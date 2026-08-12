# CronoLab — Documento de Melhorias
## Implementações Prioritárias (Grupo A)

> **Escopo:** Melhorias nas seções Calendário e Propor Aula, focadas em visibilidade de laboratórios livres e agilidade para o coordenador.
> **Base:** Estrutura existente em `CalendarioCronograma.jsx`, `ProporAulaForm.jsx`, `constants/laboratorios.jsx` e `constants/cursos.jsx`.

---

## Índice

1. [Calendário — Toggle de Perspectiva (Livres / Ocupados / Todos)](#1-calendário--toggle-de-perspectiva)
2. [Calendário — Grade de Disponibilidade](#2-calendário--grade-de-disponibilidade)
3. [Propor Aula — Mini-grade de Disponibilidade para Coordenador](#3-propor-aula--mini-grade-de-disponibilidade-para-coordenador)
4. [Propor Aula — Chip de Status no Select de Laboratório](#4-propor-aula--chip-de-status-no-select-de-laboratório)
5. [Considerações de Compatibilidade](#5-considerações-de-compatibilidade)

---

## 1. Calendário — Toggle de Perspectiva

### Contexto

O filtro atual do calendário exibe as aulas dos laboratórios favoritos selecionados, mas não oferece a perspectiva inversa: **quais laboratórios estão livres** em um determinado período. Para o coordenador, a pergunta mais comum ao planejar uma nova aula é exatamente essa.

### O que muda

Adicionar um `ToggleButtonGroup` no cabeçalho do painel de filtros com três modos:

| Modo | Comportamento |
|---|---|
| 🔴 **Ocupados** | Exibe apenas labs que possuem aulas no período selecionado (comportamento atual) |
| 🟢 **Livres** | Exibe apenas labs que **não** possuem nenhuma aula no período |
| **Todos** | Exibe todos os labs, ocupados e livres juntos |

### Localização no código

Arquivo: `src/CalendarioCronograma.jsx`
Região: cabeçalho do painel de filtros, próximo ao `FilterList` / funil existente.

### Novo estado

```jsx
// Adicionar junto aos outros estados do componente
const [perspectiva, setPerspectiva] = useState('todos');
```

### Componente de toggle

```jsx
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

// Inserir no cabeçalho do painel de filtros
<ToggleButtonGroup
  value={perspectiva}
  exclusive
  onChange={(_, novoValor) => novoValor && setPerspectiva(novoValor)}
  size="small"
  sx={{ mb: 1 }}
>
  <ToggleButton value="ocupados" color="error">
    🔴 Ocupados
  </ToggleButton>
  <ToggleButton value="livres" color="success">
    🟢 Livres
  </ToggleButton>
  <ToggleButton value="todos">
    Todos
  </ToggleButton>
</ToggleButtonGroup>
```

### Lógica de filtragem

```jsx
// Derivar a lista de labs a exibir com base na perspectiva
const labsFiltradosPorPerspectiva = useMemo(() => {
  if (perspectiva === 'todos') return LISTA_LABORATORIOS;

  // IDs dos labs que têm ao menos uma aula no período visualizado
  const labsOcupados = new Set(
    aulasDoPeriodo.map(a => a.laboratorioSelecionado)
  );

  if (perspectiva === 'ocupados') {
    return LISTA_LABORATORIOS.filter(l => labsOcupados.has(l.id));
  }

  if (perspectiva === 'livres') {
    return LISTA_LABORATORIOS.filter(l => !labsOcupados.has(l.id));
  }

  return LISTA_LABORATORIOS;
}, [perspectiva, aulasDoPeriodo]);
```

> **Nota:** `aulasDoPeriodo` é o array de aulas já carregado do Firestore para a semana/dia visível — não gera nova leitura no banco.

### Resultado esperado

Ao selecionar "🟢 Livres", o calendário exibe apenas os laboratórios sem nenhuma aula agendada no período, permitindo que o coordenador identifique espaços disponíveis em segundos.

---

## 2. Calendário — Grade de Disponibilidade

### Contexto

Mesmo com o toggle acima, a visualização semanal padrão não responde rapidamente à pergunta "qual lab está livre **neste horário específico** hoje?". Uma grade lab × horário resolve isso com uma leitura visual imediata.

### O que muda

Criar um novo componente `GradeDisponibilidade.jsx` e oferecê-lo como uma aba ou painel alternativo dentro do `CalendarioCronograma.jsx`.

### Novo arquivo: `src/components/GradeDisponibilidade.jsx`

```jsx
import React, { useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Tooltip, Typography, Box
} from '@mui/material';
import { LISTA_LABORATORIOS } from '../constants/laboratorios';

// Blocos de horário — mesma constante usada no restante do sistema
const BLOCOS = [
  { value: '07:00-09:10', label: 'Manhã 1' },
  { value: '09:30-12:00', label: 'Manhã 2' },
  { value: '13:00-15:10', label: 'Tarde 1' },
  { value: '15:30-18:00', label: 'Tarde 2' },
  { value: '18:30-20:10', label: 'Noite 1' },
  { value: '20:30-22:00', label: 'Noite 2' },
];

/**
 * GradeDisponibilidade
 * @param {Array}  aulas      - Aulas do dia/semana já carregadas (mesmo array do calendário)
 * @param {string} dataFoco   - Data no formato 'YYYY-MM-DD' para filtrar as aulas
 * @param {Array}  tiposLab   - Filtro opcional de tipos de laboratório (ex: ['anatomia'])
 * @param {Function} onCelulaClick - Callback quando o coordenador clica em uma célula livre
 */
export default function GradeDisponibilidade({ aulas, dataFoco, tiposLab = [], onCelulaClick }) {

  // Labs filtrados por tipo (se filtro aplicado)
  const labsVisiveis = useMemo(() => {
    if (!tiposLab.length) return LISTA_LABORATORIOS;
    return LISTA_LABORATORIOS.filter(l => tiposLab.includes(l.tipo));
  }, [tiposLab]);

  // Mapa: laboratorioId → Set de horários ocupados
  const mapaOcupacao = useMemo(() => {
    const mapa = {};
    aulas
      .filter(a => {
        if (!dataFoco) return true;
        // Comparar apenas a data (ignorar hora)
        const dataAula = a.dataInicio?.toDate
          ? a.dataInicio.toDate().toISOString().slice(0, 10)
          : '';
        return dataAula === dataFoco;
      })
      .forEach(a => {
        const labId = a.laboratorioSelecionado;
        if (!mapa[labId]) mapa[labId] = new Set();
        const horarios = Array.isArray(a.horarioSlotString)
          ? a.horarioSlotString
          : [a.horarioSlotString];
        horarios.forEach(h => mapa[labId].add(h));
      });
    return mapa;
  }, [aulas, dataFoco]);

  const celulaCor = (labId, horario) => {
    return mapaOcupacao[labId]?.has(horario) ? 'error' : 'success';
  };

  const celulaLabel = (labId, horario) => {
    return mapaOcupacao[labId]?.has(horario) ? 'Ocupado' : 'Livre';
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Clique em uma célula <strong>verde</strong> para pré-preencher o formulário de agendamento.
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Laboratório</TableCell>
              {BLOCOS.map(b => (
                <TableCell key={b.value} align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {b.label}<br />
                  <Typography variant="caption" color="text.secondary">{b.value}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {labsVisiveis.map(lab => (
              <TableRow key={lab.id} hover>
                <TableCell sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                  {lab.name}
                </TableCell>
                {BLOCOS.map(b => {
                  const cor = celulaCor(lab.id, b.value);
                  const livre = cor === 'success';
                  return (
                    <TableCell key={b.value} align="center" sx={{ p: 0.5 }}>
                      <Tooltip title={livre
                        ? `${lab.name} livre no horário ${b.value} — clique para agendar`
                        : `${lab.name} ocupado no horário ${b.value}`
                      }>
                        <Chip
                          label={celulaLabel(lab.id, b.value)}
                          color={cor}
                          size="small"
                          variant={livre ? 'filled' : 'outlined'}
                          clickable={livre}
                          onClick={livre && onCelulaClick
                            ? () => onCelulaClick({ labId: lab.id, labNome: lab.name, horario: b.value })
                            : undefined
                          }
                          sx={{ fontSize: '0.65rem', minWidth: 58 }}
                        />
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
```

### Integração no `CalendarioCronograma.jsx`

```jsx
import GradeDisponibilidade from './components/GradeDisponibilidade';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

// Novo estado para controlar a aba de visualização
const [abaCalendario, setAbaCalendario] = useState('semana');

// Inserir as abas antes do conteúdo principal do calendário
<Tabs
  value={abaCalendario}
  onChange={(_, v) => setAbaCalendario(v)}
  sx={{ mb: 2 }}
>
  <Tab value="semana" label="Visão Semanal" />
  <Tab value="grade" label="🟢 Grade de Disponibilidade" />
</Tabs>

{abaCalendario === 'semana' && (
  // ... renderização atual do calendário semanal
)}

{abaCalendario === 'grade' && (
  <GradeDisponibilidade
    aulas={aulasCarregadas}         // array já existente no estado do componente
    dataFoco={diaSelecionado}       // string 'YYYY-MM-DD' do dia em foco
    tiposLab={filtroTiposLab}       // filtro de tipo de lab (pode ser [] para mostrar todos)
    onCelulaClick={({ labId, labNome, horario }) => {
      // Navegar para o formulário de propor aula pré-preenchido
      navigate('/propor-aula', {
        state: { labIdPreSelecionado: labId, horarioPreSelecionado: horario }
      });
    }}
  />
)}
```

> **Impacto no Firestore:** zero leituras extras. A grade usa `aulasCarregadas`, o mesmo estado que já alimenta o calendário semanal.

---

## 3. Propor Aula — Mini-grade de Disponibilidade para Coordenador

### Contexto

O coordenador preenche os 3 passos do formulário sem saber de antemão quais labs e horários estão disponíveis na data escolhida. Isso leva a descoberta tardia de conflitos (só na Seção 3) e retrabalho.

### O que muda

Quando o usuário é coordenador e já escolheu uma data na Seção 1, exibir um painel colapsável com a grade de disponibilidade do dia, permitindo que ele clique diretamente em uma célula livre para preencher automaticamente o laboratório e o horário nas seções seguintes.

### Localização no código

Arquivo: `src/ProporAulaForm.jsx`
Região: entre a Seção 1 (Detalhes) e a Seção 2 (Laboratório), condicionado a `isCoordenador && formData.dataInicio`.

### Novo estado e handler

```jsx
// Adicionar junto aos outros estados do ProporAulaForm
const [gradeAberta, setGradeAberta] = useState(false);

// Handler chamado ao clicar em uma célula livre da grade
const handleCelulaGrade = ({ labId, labNome, horario }) => {
  // 1. Descobre o tipo do lab a partir do id
  const labEncontrado = LISTA_LABORATORIOS.find(l => l.id === labId);
  if (!labEncontrado) return;

  // 2. Preenche a seção de laboratório
  setFormData(prev => ({
    ...prev,
    dynamicLabs: [{ tipo: labEncontrado.tipo, laboratorios: [labNome] }],
    // 3. Preenche o horário na seção de data/hora
    horarioSlotString: [horario],
  }));

  // 4. Fecha a grade e dá feedback visual
  setGradeAberta(false);
  setSnackbarMessage(`Lab ${labNome} e horário ${horario} pré-selecionados ✅`);
  setSnackbarSeverity('success');
  setOpenSnackbar(true);
};
```

### JSX a inserir entre Seção 1 e Seção 2

```jsx
{isCoordenador && formData.dataInicio && (
  <Grid item xs={12}>
    <Paper
      variant="outlined"
      sx={{ p: 2, borderColor: 'success.light', borderStyle: 'dashed' }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{ cursor: 'pointer' }}
        onClick={() => setGradeAberta(prev => !prev)}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="subtitle2" color="success.main" fontWeight={700}>
            🟢 Ver disponibilidade em{' '}
            {dayjs(formData.dataInicio).format('dddd, DD/MM/YYYY')}
          </Typography>
          <Chip
            label="Clique para abrir"
            size="small"
            color="success"
            variant="outlined"
          />
        </Box>
        <ExpandMoreIcon
          sx={{
            transform: gradeAberta ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'success.main',
          }}
        />
      </Box>

      <Collapse in={gradeAberta}>
        <Box sx={{ mt: 2 }}>
          <GradeDisponibilidade
            aulas={aulasDoMes}  // array já carregado para colorir o DatePicker
            dataFoco={dayjs(formData.dataInicio).format('YYYY-MM-DD')}
            onCelulaClick={handleCelulaGrade}
          />
        </Box>
      </Collapse>
    </Paper>
  </Grid>
)}
```

> **Reutilização:** o array `aulasDoMes` já é buscado no `ProporAulaForm.jsx` para calcular `diasParcialmenteOcupados` e `diasTotalmenteOcupados` no DatePicker. Não há nova leitura no Firestore.

### Fluxo resultante para o coordenador

```
1. Preenche Título / Tipo de Atividade  (Seção 1)
2. Escolhe a data no DatePicker
   └─ Grade de disponibilidade aparece automaticamente
3. Clica em uma célula verde (lab livre + horário)
   └─ Lab e horário preenchidos automaticamente
4. Revisa e clica em "Agendar Agora"
```

Reduz de ~10 interações para ~5 no caso mais comum.

---

## 4. Propor Aula — Chip de Status no Select de Laboratório

### Contexto

Na Seção 2 do formulário, o `Select` de laboratório lista todos os labs do tipo selecionado, mas não indica quais estão livres na data e horário já escolhidos. O coordenador pode selecionar um lab ocupado e só descobrir o conflito na Seção 3, após escolher o horário.

### O que muda

Adicionar um `Chip` colorido ao lado de cada opção do `Select` de laboratório, indicando se o lab está **livre**, **parcialmente ocupado** ou **totalmente ocupado** para a data e horários já selecionados.

### Lógica auxiliar (inserir no `ProporAulaForm.jsx`)

```jsx
/**
 * Retorna o status de disponibilidade de um lab para a data e horários
 * já selecionados no formulário.
 * Usa o array aulasDoMes já carregado — zero leituras extras.
 */
const statusLab = useCallback((labNome) => {
  if (!formData.dataInicio) return 'indefinido';

  const dataStr = dayjs(formData.dataInicio).format('YYYY-MM-DD');
  const horariosForm = formData.horarioSlotString; // array de horários já escolhidos

  const aulasDoLab = aulasDoMes.filter(a => {
    const dataAula = a.dataInicio?.toDate
      ? a.dataInicio.toDate().toISOString().slice(0, 10)
      : '';
    return (
      a.laboratorioSelecionado === labNome &&
      dataAula === dataStr &&
      ['aprovada', 'pendente'].includes(a.status)
    );
  });

  if (aulasDoLab.length === 0) return 'livre';

  // Verifica se algum horário selecionado no form conflita
  const horariosOcupadosLab = aulasDoLab.flatMap(a =>
    Array.isArray(a.horarioSlotString) ? a.horarioSlotString : [a.horarioSlotString]
  );

  const temConflito = horariosForm.some(h => horariosOcupadosLab.includes(h));
  return temConflito ? 'ocupado' : 'parcial';
}, [formData.dataInicio, formData.horarioSlotString, aulasDoMes]);
```

### Mapeamento de status para visual

```jsx
const CHIP_STATUS = {
  livre:     { label: 'Livre',    color: 'success' },
  parcial:   { label: 'Parcial',  color: 'warning' },
  ocupado:   { label: 'Ocupado',  color: 'error'   },
  indefinido:{ label: '—',        color: 'default'  },
};
```

### `Select` atualizado na Seção 2

```jsx
// Substituir o MenuItem atual de laboratório por:
{LISTA_LABORATORIOS
  .filter(l => l.tipo === labSelection.tipo)
  .map(l => {
    const st = statusLab(l.name);
    const { label, color } = CHIP_STATUS[st];
    return (
      <MenuItem
        key={l.id}
        value={l.name}
        // Não desabilita — coordenador pode escolher mesmo que ocupado,
        // o sistema vai mostrar o conflito na validação
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
          gap={1}
        >
          <Typography variant="body2">{l.name}</Typography>
          <Chip
            label={label}
            color={color}
            size="small"
            variant={st === 'livre' ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.65rem', minWidth: 62 }}
          />
        </Box>
      </MenuItem>
    );
  })
}
```

> **Importante:** o chip é informativo, não bloqueia a seleção. O coordenador pode escolher um lab ocupado intencionalmente (ex: para substituir uma aula). A validação de conflito já existente no `handleSubmit` continua sendo a guarda final.

---

## 5. Considerações de Compatibilidade

### Firebase / Firestore

Nenhuma das implementações acima gera leituras adicionais no Firestore. Todas reutilizam arrays de aulas já carregados nos estados existentes de cada componente:

| Componente | Array reutilizado |
|---|---|
| `CalendarioCronograma.jsx` | `aulasCarregadas` (estado atual da semana) |
| `GradeDisponibilidade.jsx` | Recebe via prop, não faz queries próprias |
| `ProporAulaForm.jsx` | `aulasDoMes` (já usado para colorir o DatePicker) |

### Plano Spark

Compatível. Zero Cloud Functions envolvidas. Toda a lógica é computada no cliente com `useMemo` e `useCallback`, sem custo de leitura extra.

### MUI v7

Todos os componentes usados (`ToggleButtonGroup`, `Tabs`, `Collapse`, `Chip`, `Table`) estão disponíveis no MUI v7 sem necessidade de dependência nova.

### Ordem de implementação sugerida

```
1. GradeDisponibilidade.jsx  ←  componente isolado, sem dependência dos outros
2. Toggle de perspectiva     ←  consome GradeDisponibilidade via prop
3. Chip de status no Select  ←  lógica local no ProporAulaForm, simples
4. Mini-grade no ProporAula  ←  reutiliza GradeDisponibilidade já criado
```

---

*Documento gerado com base na análise do código-fonte do CronoLab — CESMAC.*
*Versão do sistema analisada: v2 (React 19, MUI v7, Firebase Spark).*
