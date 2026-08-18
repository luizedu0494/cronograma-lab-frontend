# CronoLab — Análise: Bug da Grade de Disponibilidade + Melhorias para o Coordenador

> **Escopo:** `src/ProporEventoForm.jsx` · `src/components/GradeDisponibilidade.jsx` · `src/hooks/useDisponibilidade.ts`

---

## 1. Diagnóstico do Bug — Grade não exibe eventos

### 1.1 O que acontece

No fluxo de **Propor Aula**, o Select de horários exibe corretamente os blocos ocupados (com o aviso "🚫 Ocupado: …"). Porém, ao abrir o Accordion **"Consulta de Grade de Disponibilidade"**, a grade aparece vazia — mesmo com eventos/aulas já carregados.

### 1.2 Causa-raiz

O problema está em como o `useDisponibilidade` retorna os conflitos e em como o `ProporEventoForm` repassa esses dados para `GradeDisponibilidade`.

#### Passo 1 — O que `useDisponibilidade` devolve

```ts
// useDisponibilidade.ts — linha ~18453
const conflito: ConflitoItem = {
  tipo: 'aula',
  laboratorio: lab,   // ← é o nome do laboratório (string)
  horario: slotStr,   // ← ex: "13:00-15:10"
  titulo: data.assunto || data.disciplina || 'Aula Agendada',
};
```

Os conflitos ficam em `resultados[0].conflitos` — um array plano de `ConflitoItem`.

#### Passo 2 — Como `ProporEventoForm` usa o resultado

```jsx
// ProporEventoForm.jsx — linhas ~14452-14461
consultarDisponibilidade({ ... }).then(resultados => {
  const conflitos = resultados[0]?.conflitos ?? [];
  const conflitosAulas  = conflitos.filter(c => c.tipo === 'aula');
  const conflitosEventos = conflitos.filter(c => c.tipo === 'evento' && c.id !== eventoId);

  setOcupacaoDoDia({
    aulas:   conflitosAulas,   // ← array de ConflitoItem
    eventos: conflitosEventos, // ← array de ConflitoItem
  });
});
```

#### Passo 3 — O que `GradeDisponibilidade` espera receber

```jsx
// GradeDisponibilidade.jsx — linhas ~17466-17481
aulas
  .filter(a => {
    const dataAula = a.dataInicio       // ← CAMPO NÃO EXISTE em ConflitoItem!
      ? toDataLocal(a.dataInicio)
      : dataSelecionada;
    return dataAula === dataSelecionada;
  })
  .forEach(a => registrar(
    a.laboratorioSelecionado || a.laboratorio,  // ← OK, .laboratorio existe
    toHorariosArray(a.horarioSlotString || a.horario), // ← .horarioSlotString NÃO EXISTE
    a, 'aula'
  ));

eventos
  .filter(e => {
    const dataEvento = e.dataInicio     // ← CAMPO NÃO EXISTE em ConflitoItem!
      ? toDataLocal(e.dataInicio)
      : dataSelecionada;
    return dataEvento === dataSelecionada;
  })
  .forEach(e => registrar(
    e.laboratorio,
    toHorariosArray(e.horarioSlotString || e.horario), // ← .horarioSlotString NÃO EXISTE
    e, 'evento'
  ));
```

### 1.3 Resumo dos campos ausentes

| Campo esperado por `GradeDisponibilidade` | Existe em `ConflitoItem`? | Efeito |
|---|---|---|
| `a.dataInicio` | ❌ | Filtro sempre usa `dataSelecionada` (fallback OK, mas instável) |
| `a.horarioSlotString` | ❌ | `toHorariosArray` recebe `undefined`; retorna `[]` → célula nunca marcada |
| `e.horarioSlotString` | ❌ | Idem para eventos |
| `a.laboratorioSelecionado` | ❌ (há só `.laboratorio`) | Fallback `.laboratorio` funciona parcialmente |

**Conclusão:** `GradeDisponibilidade` foi projetado para receber objetos de aula/evento vindos diretamente do Firestore (com `dataInicio`, `horarioSlotString`, `laboratorioSelecionado`). O `ProporEventoForm` alimenta a grade com `ConflitoItem`, que é um DTO simplificado sem esses campos. A grade nunca consegue extrair os horários e fica em branco.

---

## 2. Correção

### 2.1 Abordagem recomendada — adaptar os dados antes de passar para a Grade

Não é necessário alterar `GradeDisponibilidade` nem `useDisponibilidade`. Basta criar um adaptador no `ProporEventoForm` que transforma `ConflitoItem` nos campos que a grade espera.

#### Em `ProporEventoForm.jsx`, substituir o bloco do `.then(resultados => ...)`:

```jsx
consultarDisponibilidade({ ... }).then(resultados => {
  const conflitos = resultados[0]?.conflitos ?? [];

  // Adaptador: ConflitoItem → shape que GradeDisponibilidade entende
  const adaptarConflito = (c) => ({
    ...c,
    // Grade filtra por dataInicio; como o hook já filtrou por data, podemos fixar a data escolhida
    dataInicio: formData.dataInicio?.toDate?.() ?? formData.dataInicio,
    // Grade lê horarioSlotString OU horario para montar o array
    horarioSlotString: c.horario,
    // Grade lê laboratorioSelecionado OU laboratorio
    laboratorioSelecionado: c.laboratorio,
  });

  const conflitosAulas   = conflitos.filter(c => c.tipo === 'aula').map(adaptarConflito);
  const conflitosEventos = conflitos
    .filter(c => c.tipo === 'evento' && c.id !== eventoId)
    .map(adaptarConflito);

  setOcupacaoDoDia({ aulas: conflitosAulas, eventos: conflitosEventos });

  const slotsOcupados = [...new Set(
    [...conflitosAulas, ...conflitosEventos].map(c => c.horario)
  )];
  setHorariosOcupados(slotsOcupados);
});
```

#### Onde aplicar no arquivo

Linha ~14446 até ~14462 de `ProporEventoForm.jsx` — substituir o `.then(resultados => { ... })` completo pelo bloco acima.

### 2.2 Mudança complementar em `GradeDisponibilidade.jsx` (linha ~17469)

Para tornar o filtro de data mais robusto independentemente do tipo recebido:

```jsx
// Antes:
const dataAula = a.dataInicio ? toDataLocal(a.dataInicio) : dataSelecionada;

// Depois — suporta Timestamp, Date, string ISO e dayjs:
const dataAula = a.dataInicio
  ? toDataLocal(
      typeof a.dataInicio?.toDate === 'function'
        ? a.dataInicio.toDate()
        : a.dataInicio
    )
  : dataSelecionada;
```

Aplicar a mesma lógica no filtro de `eventos` (linha ~17477).

### 2.3 Verificar `toHorariosArray` em `dateHelper.js`

Garantir que a função aceite uma string direta no formato `"HH:mm-HH:mm"` e não apenas arrays:

```js
// utils/dateHelper.js
export function toHorariosArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  // string única como "13:00-15:10"
  return [val];
}
```

Se essa verificação já existir, não é necessário alterar.

---

## 3. Melhorias de UX para o Coordenador no Agendamento

As sugestões abaixo são **adicionais** e não quebram nenhuma funcionalidade existente. Cada uma é independente e pode ser implementada separadamente.

---

### 3.1 Grade aberta por padrão ao selecionar a data

**Problema atual:** O coordenador precisa clicar no Accordion para ver a grade. Se a grade já estivesse aberta, o feedback visual seria imediato.

**Mudança:** Alterar o estado inicial de `gradeAberta` para `true` quando uma data é escolhida pela primeira vez.

```jsx
// ProporEventoForm.jsx — useEffect da dataInicio (linha ~14361)
useEffect(() => {
  if (isEditMode || !formData.dataInicio) return;
  setFormData(prev => ({ ...prev, horarioSlotString: [] }));
  setHorariosOcupados([]);
  setGradeAberta(true); // ← abre a grade automaticamente ao escolher data
}, [formData.dataInicio, isEditMode]);
```

---

### 3.2 Legenda visual na Grade

**Problema atual:** A grade usa cores (verde/vermelho), mas não há legenda explicando o que cada cor significa para quem usa pela primeira vez.

**Mudança:** Adicionar uma linha de legenda simples acima da grade.

```jsx
// GradeDisponibilidade.jsx — logo após o Paper do seletor de dias (linha ~17541)
<Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'success.light' }} />
    <Typography variant="caption">Livre</Typography>
  </Box>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'error.light' }} />
    <Typography variant="caption">Ocupado</Typography>
  </Box>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'warning.light' }} />
    <Typography variant="caption">Evento / Manutenção</Typography>
  </Box>
</Box>
```

---

### 3.3 Clique direto na Grade para pré-preencher o horário no formulário

**Problema atual:** A grade existe apenas para consulta visual. O coordenador ainda precisa selecionar o horário manualmente no Select logo acima.

**Mudança:** Usar o `onCelulaClick` já existente em `GradeDisponibilidade` para pré-preencher o campo de horário ao clicar numa célula livre.

```jsx
// ProporEventoForm.jsx — na prop onCelulaClick da GradeDisponibilidade (linha ~14873)
<GradeDisponibilidade
  aulas={ocupacaoDoDia.aulas}
  eventos={ocupacaoDoDia.eventos}
  dataFoco={formData.dataInicio?.format('YYYY-MM-DD')}
  tiposLab={formData.dynamicLabs.map(l => l.tipo).filter(Boolean)}
  onCelulaClick={({ horario, ocupado, labNome }) => {
    if (ocupado) return; // célula ocupada — não preenche
    setFormData(prev => {
      const jaTemHorario = prev.horarioSlotString.includes(horario);
      return {
        ...prev,
        horarioSlotString: jaTemHorario
          ? prev.horarioSlotString.filter(h => h !== horario) // toggle: remove se já estava
          : [...prev.horarioSlotString, horario],             // adiciona se não estava
      };
    });
  }}
/>
```

Resultado: clicar numa célula verde na grade adiciona (ou remove) aquele bloco na seleção de horários. A sincronização é bidirecional e não quebra a seleção manual pelo Select.

---

### 3.4 Contador de vagas disponíveis por laboratório

**Problema atual:** O coordenador não sabe, de relance, quantos horários ainda estão livres em cada lab no dia escolhido.

**Mudança:** Adicionar um `Badge` ou `Chip` no nome do laboratório dentro da grade, mostrando `X/6 livres`.

```jsx
// GradeDisponibilidade.jsx — célula de cabeçalho de cada laboratório na tabela desktop
<TableCell key={lab.id} align="center" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
  {lab.name}
  {(() => {
    const livres = BLOCOS.filter(b => !isOcupado(lab, b.value)).length;
    return (
      <Chip
        label={`${livres}/6`}
        size="small"
        color={livres === 0 ? 'error' : livres === 6 ? 'success' : 'warning'}
        sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }}
      />
    );
  })()}
</TableCell>
```

---

### 3.5 Filtro rápido "Mostrar apenas laboratórios com vaga"

**Problema atual:** Com 30+ laboratórios, a grade exige muito scroll. Quando o coordenador quer apenas achar onde cabe uma aula, precisa varrer linha a linha.

**Mudança:** Adicionar um Switch "Mostrar só labs com vaga" na barra de cabeçalho da grade. Quando ativado, filtra as linhas para exibir apenas laboratórios com pelo menos um horário livre no dia selecionado.

```jsx
// GradeDisponibilidade.jsx — estado interno
const [apenasComVaga, setApenasComVaga] = useState(false);

// Filtro aplicado na lista de labs
const labsParaRenderizar = useMemo(() => {
  if (!apenasComVaga) return labsVisiveis;
  return labsVisiveis.filter(lab =>
    BLOCOS.some(b => !isOcupado(lab, b.value))
  );
}, [labsVisiveis, apenasComVaga, mapaDetalhes]);

// No cabeçalho, ao lado do ToggleButtonGroup:
<FormControlLabel
  control={
    <Switch
      size="small"
      checked={apenasComVaga}
      onChange={e => setApenasComVaga(e.target.checked)}
    />
  }
  label={<Typography variant="caption">Só com vaga</Typography>}
/>
```

---

### 3.6 Resumo textual de ocupação no topo do formulário

**Problema atual:** Ao abrir a grade, o coordenador ainda precisa interpretar visualmente. Um resumo rápido reduz esforço cognitivo.

**Mudança:** Exibir um `Alert` informativo logo abaixo do DatePicker, antes do Accordion, quando a data já estiver selecionada.

```jsx
// ProporEventoForm.jsx — logo após o Grid do DatePicker e horário (linha ~14856)
{formData.dataInicio && (
  <Alert
    severity={
      ocupacaoDoDia.aulas.length + ocupacaoDoDia.eventos.length === 0
        ? 'success'
        : horariosOcupados.length >= BLOCOS_HORARIO.length
        ? 'error'
        : 'warning'
    }
    sx={{ mt: 1 }}
  >
    {ocupacaoDoDia.aulas.length + ocupacaoDoDia.eventos.length === 0
      ? `✅ Nenhuma ocupação encontrada em ${formData.dataInicio.format('DD/MM/YYYY')} para os laboratórios selecionados.`
      : `⚠️ ${horariosOcupados.length} bloco(s) ocupado(s) em ${formData.dataInicio.format('DD/MM/YYYY')}. Consulte a grade abaixo.`
    }
  </Alert>
)}
```

---

### 3.7 Destaque visual dos horários selecionados na grade

**Problema atual:** Os horários que o coordenador já escolheu no Select não aparecem destacados na grade, quebrando o feedback visual entre os dois controles.

**Mudança:** Passar os horários selecionados como prop para a grade e destacar a célula com uma borda azul.

```jsx
// GradeDisponibilidade.jsx — nova prop
export default function GradeDisponibilidade({
  aulas = [],
  eventos = [],
  dataFoco,
  tiposLab = [],
  perspectivaFiltro = 'todos',
  onCelulaClick,
  horariosDestacados = [], // ← nova prop
}) { ... }

// Na renderização de cada célula, aplicar borda se o horário está em horariosDestacados:
sx={{
  ...estiloAtual,
  outline: horariosDestacados.includes(bloco.value)
    ? '2px solid #1976d2'
    : 'none',
  outlineOffset: '-2px',
}}
```

```jsx
// ProporEventoForm.jsx — passar a prop:
<GradeDisponibilidade
  ...
  horariosDestacados={formData.horarioSlotString}
/>
```

---

## 4. Checklist de implementação

| # | Item | Prioridade | Arquivo(s) |
|---|---|---|---|
| 🐛 | Adaptador `ConflitoItem → shape da Grade` | **Crítico** | `ProporEventoForm.jsx` |
| 🐛 | Tornar filtro de data na Grade robusto a tipos mistos | **Alta** | `GradeDisponibilidade.jsx` |
| 🐛 | Verificar `toHorariosArray` aceita string simples | **Alta** | `dateHelper.js` |
| ✨ | Grade aberta automaticamente ao selecionar data | Média | `ProporEventoForm.jsx` |
| ✨ | Legenda de cores na Grade | Média | `GradeDisponibilidade.jsx` |
| ✨ | Clique na Grade pré-preenche horário | Alta | `ProporEventoForm.jsx` + `GradeDisponibilidade.jsx` |
| ✨ | Contador `X/6 livres` por laboratório | Média | `GradeDisponibilidade.jsx` |
| ✨ | Switch "Só labs com vaga" | Alta | `GradeDisponibilidade.jsx` |
| ✨ | Alert resumo de ocupação | Média | `ProporEventoForm.jsx` |
| ✨ | Destaque visual dos horários selecionados na Grade | Alta | `GradeDisponibilidade.jsx` + `ProporEventoForm.jsx` |

---

## 5. Impacto e risco

Todas as correções do item 2 são **cirúrgicas** — alteram apenas o transformador de dados em `ProporEventoForm` e dois filtros na grade, sem tocar na lógica de negócio, nas queries do Firestore ou nas regras de segurança. As melhorias do item 3 são **aditivas** (novos estados, props e JSX), sem remover nem sobrescrever funcionalidades existentes.

Nenhuma alteração requer mudança de schema no Firestore, criação de índices novos ou alteração de `firestore.rules`.
