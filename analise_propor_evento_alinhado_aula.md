# CronoLab — Propor Evento no padrão do Propor Aula (com Grade de Disponibilidade)

> **Objetivo:** deixar `ProporEventoForm.jsx` visualmente e funcionalmente igual ao fluxo de `ProporAulaForm.jsx`, **sem mexer no fluxo de aula**, adicionando a `GradeDisponibilidade` (a mesma usada em disponibilidade) — agora enxergando `aulas` **e** `eventosManutencao` — para agilizar a proposta sem perder a checagem de conflitos.

---

## 1. Diagnóstico

### 1.1 O que já está igual (não mexer)
`ProporEventoForm.jsx` já copia o esqueleto do form de aula:
- Layout em `Paper` numerados ("1. Detalhes", "2. Laboratório(s)", "3. Data e Horário") com borda colorida.
- Desbloqueio progressivo de seção (`secao1Completa` → `secao2Completa` → data/horário), com `LockIcon` e `Alert` de aviso.
- `DatePicker` com dias pintados por ocupação (`diasTotalmenteOcupados`, `diasParcialmenteOcupados`) e bloqueio de feriado (`isDayBlocked`).
- Modal de confirmação (`DialogConfirmacao`) e modal de conflito (`Dialog` com lista de conflitos, opção "Ignorar" ou "Substituir").
- `dynamicLabs` (tipo + multi-lab), igual ao padrão de aula.

**Isso preserva a identidade do fluxo de aula — deve continuar assim.**

### 1.2 O que está diferente e gera lentidão

| Ponto | `ProporEventoForm.jsx` (atual) | Impacto |
|---|---|---|
| **Seleção de horário** | `<Select multiple>` com texto `"07:00-09:10 (Ocupado)"` | Usuário não *vê* a grade — precisa ler item por item. A `GradeDisponibilidade.jsx` (grid visual, clicável, com cores) já existe no projeto mas não é usada aqui. |
| **Checagem de ocupação** | 2 `useEffect` separados: (a) `fetchOcupacaoDoMes` — pinta o calendário inteiro do mês; (b) `verificarDisponibilidade` — busca ocupação do dia selecionado | Duas idas ao Firestore com lógicas parecidas e não reaproveitadas. |
| **`GradeDisponibilidade.jsx`** | Recebe só `aulas` — não tem prop de `eventos` | Se fosse plugada hoje, mostraria como livre um horário já ocupado por outro evento. |
| **Verificação de conflito no submit** | Loop `for (const novo of eventosParaAgendar)` fazendo 2 queries (`aulas` + `eventosManutencao`) por item | Se o usuário marcar 3 laboratórios × 2 horários, isso vira várias queries sequenciais — mesmo padrão que o `analise_eventos_disponibilidade.md` já identificou como gargalo em `EventosManutencao.jsx`. |
| **Fonte da verdade de disponibilidade** | Lógica reescrita dentro do form | `useDisponibilidade.ts` já centraliza isso (2 queries em `Promise.all`, mapa `Map<string, ConflitoItem[]>`, tipagem `'aula' \| 'evento'`) — é o hook certo para reaproveitar aqui. |

**Resumo do gargalo:** o form de evento tenta refazer, com `Select` e loops manuais, o que o par `GradeDisponibilidade.jsx` + `useDisponibilidade.ts` já resolve de forma visual e em poucas queries — só que esse par hoje só "enxerga" aulas.

---

## 2. Proposta

Ideia central: **não recriar nada** — plugar as duas peças que já existem, com um ajuste mínimo em cada uma.

### 2.1 Estender `GradeDisponibilidade.jsx` para aceitar eventos

Hoje o componente só recebe `aulas`. Adicionar prop `eventos` e mesclar as duas fontes no mapa de ocupação (mesma lógica que `useDisponibilidade.ts` já usa: evento com `laboratorio === 'Todos'` ocupa todos os labs do bloco).

```jsx
// components/GradeDisponibilidade.jsx

export default function GradeDisponibilidade({
  aulas = [],
  eventos = [],           // NOVO — mesma forma de eventosManutencao
  dataFoco = dayjs().format('YYYY-MM-DD'),
  tiposLab = [],
  perspectivaFiltro = 'todos',
  onCelulaClick
}) {
  // ...

  const mapaDetalhes = useMemo(() => {
    const mapa = {};

    const registrar = (rawLab, horarios, item, origem) => {
      if (!rawLab) return;
      const labObj = LISTA_LABORATORIOS.find(l => l.id === rawLab || l.name === rawLab);
      const alvos = rawLab === 'Todos'
        ? LISTA_LABORATORIOS
        : [labObj || { id: rawLab, name: rawLab }];

      alvos.forEach(lab => {
        horarios.forEach(h => {
          if (!h) return;
          if (!mapa[lab.id]) mapa[lab.id] = {};
          if (!mapa[lab.name]) mapa[lab.name] = {};
          if (!mapa[lab.id][h]) mapa[lab.id][h] = [];
          if (!mapa[lab.name][h]) mapa[lab.name][h] = [];
          const registro = { ...item, origem };
          mapa[lab.id][h].push(registro);
          mapa[lab.name][h].push(registro);
        });
      });
    };

    aulas
      .filter(a => !dataSelecionada || toDataLocal(a.dataInicio) === dataSelecionada)
      .forEach(a => registrar(a.laboratorioSelecionado || a.laboratorio, toHorariosArray(a.horarioSlotString), a, 'aula'));

    eventos
      .filter(e => e.status !== 'cancelado')
      .filter(e => !dataSelecionada || toDataLocal(e.dataInicio) === dataSelecionada)
      .forEach(e => registrar(e.laboratorio, toHorariosArray(e.horarioSlotString), e, 'evento'));

    return mapa;
  }, [aulas, eventos, dataSelecionada]);

  // getAulasDaCelula, isOcupado, handleCellClick continuam iguais —
  // agora cada item devolvido tem `.origem` ('aula' | 'evento') para o modal/tooltip
  // distinguir "Aula: Anatomia — Prof. X" de "Evento: Manutenção — dedetização"
}
```

Isso **não altera o comportamento atual** para quem já usa `GradeDisponibilidade` sem passar `eventos` (prop opcional, default `[]`).

### 2.2 Trocar o `<Select>` de horário pela grade, no `ProporEventoForm.jsx`

Reaproveitar `useDisponibilidade` para trazer aulas + eventos do dia/labs selecionados de uma vez (2 queries, igual ao hook já pronto), e passar para a grade:

```jsx
// ProporEventoForm.jsx
import GradeDisponibilidade from './components/GradeDisponibilidade';
import { useDisponibilidade } from './hooks/useDisponibilidade';

const { consultarDisponibilidade, loading: verificandoDisp } = useDisponibilidade();
const [ocupacaoDoDia, setOcupacaoDoDia] = useState({ aulas: [], eventos: [] });

useEffect(() => {
  const laboratoriosParaVerificar = formData.dynamicLabs.flatMap(l => l.laboratorios).filter(Boolean);
  if (!formData.dataInicio || laboratoriosParaVerificar.length === 0) {
    setOcupacaoDoDia({ aulas: [], eventos: [] });
    return;
  }
  // 1 chamada cobrindo o dia inteiro, já mesclando aulas + eventosManutencao
  consultarDisponibilidade({
    dataInicio: formData.dataInicio,
    dataFim: formData.dataInicio,
    diasSemana: [dayjs(formData.dataInicio).day()],
    horarios: BLOCOS_HORARIO.map(b => b.value),
    laboratorios: laboratoriosParaVerificar,
  }).then(resultados => {
    const conflitos = resultados[0]?.conflitos ?? [];
    setOcupacaoDoDia({
      aulas: conflitos.filter(c => c.tipo === 'aula'),
      eventos: conflitos.filter(c => c.tipo === 'evento'),
    });
  });
}, [formData.dataInicio, formData.dynamicLabs]);
```

```jsx
{/* Seção 3, no lugar do <Select multiple name="horarioSlotString">: */}
<GradeDisponibilidade
  aulas={ocupacaoDoDia.aulas}
  eventos={ocupacaoDoDia.eventos}
  dataFoco={formData.dataInicio?.format('YYYY-MM-DD')}
  tiposLab={formData.dynamicLabs.map(l => l.tipo).filter(Boolean)}
  onCelulaClick={({ horario, ocupado }) => {
    if (ocupado) return; // clique em célula ocupada não seleciona
    setFormData(prev => ({
      ...prev,
      horarioSlotString: prev.horarioSlotString.includes(horario)
        ? prev.horarioSlotString.filter(h => h !== horario)
        : [...prev.horarioSlotString, horario],
    }));
  }}
/>
```

**Resultado para quem propõe evento:** em vez de ler uma lista com "(Ocupado)", a pessoa vê a mesma grade colorida (verde/vermelho) que já usa em Consulta de Disponibilidade — clica direto no bloco livre. Multi-seleção continua igual, agora visual.

### 2.3 Deixar o submit com 1 verificação em vez de N

O loop atual de conflito no `prepareAndConfirm` (2 queries por evento a criar) pode reaproveitar os `conflitos` já calculados por `consultarDisponibilidade` — dispensando as queries extras no momento do submit, já que a grade já buscou o dia inteiro:

```jsx
const prepareAndConfirm = () => {
  // ... validações de campo continuam iguais ...

  const conflitosEncontrados = eventosParaAgendar.flatMap(novo =>
    (ocupacaoDoDia.aulas.concat(ocupacaoDoDia.eventos))
      .filter(c => c.horario === novo.horarioSlotString && c.laboratorio === novo.laboratorio)
      .map(conflito => ({ novo, conflito }))
  );

  if (conflitosEncontrados.length > 0) {
    setConflitos(conflitosEncontrados);
    setEventosParaConfirmar(eventosParaAgendar);
    setOpenDuplicateDialog(true);
  } else {
    setEventosParaConfirmar(eventosParaAgendar);
    setOpenConfirmModal(true);
  }
};
```

Isso elimina o `for` com `getDocs` duplicado — a grade já é a fonte da verdade no momento do clique.

---

## 3. O que **não muda** (garantia de preservação da Aula)

- `ProporAulaForm.jsx` e a coleção `aulas` **não são tocados** — nenhuma alteração de schema, regra do Firestore ou lógica de aprovação de aula.
- `GradeDisponibilidade` ganha uma prop **opcional** (`eventos`); qualquer tela que já a usa sem essa prop continua funcionando exatamente igual.
- `useDisponibilidade.ts` já é usado como está — nenhuma mudança nele, só reaproveitamento.
- O schema de `eventosManutencao` não muda (mesmos campos do `analise_eventos_disponibilidade.md`).

---

## 4. Ganho esperado

| Métrica | Antes | Depois |
|---|---|---|
| Leituras Firestore ao selecionar dia+labs | 2 (mês inteiro) + 2 (dia) = 4 queries | 2 queries (`aulas` + `eventosManutencao`) via `useDisponibilidade`, reaproveitadas na grade e no submit |
| Leituras no submit (conflito) | 2 × nº de horários/labs a criar | 0 (usa o resultado já em memória) |
| Como o usuário escolhe horário | Lê texto "(Ocupado)" num dropdown | Clica na grade colorida, igual à Aula/Consulta de Disponibilidade |
| Visibilidade de conflito com Evento | `GradeDisponibilidade` não via eventos | Grade mostra aula **e** evento na mesma célula, com origem identificada |

---

## 5. Checklist de implementação

```
[ ] GradeDisponibilidade.jsx — adicionar prop `eventos` (default []) e mesclar no mapaDetalhes
[ ] GradeDisponibilidade.jsx — no modal de célula, exibir origem ("Aula" vs "Evento") no detalhe
[ ] ProporEventoForm.jsx — importar useDisponibilidade e substituir fetchOcupacaoDoMes + verificarDisponibilidade
[ ] ProporEventoForm.jsx — trocar <Select multiple horarioSlotString> pela <GradeDisponibilidade onCelulaClick>
[ ] ProporEventoForm.jsx — simplificar prepareAndConfirm para reaproveitar conflitos já buscados
[ ] Manter dynamicLabs, seções bloqueadas, modais de confirmação/conflito e integração Telegram como estão
[ ] Testar: nenhuma alteração em ProporAulaForm.jsx, aulas ou regras do Firestore
[ ] Testar visualmente em mobile (GradeDisponibilidade já tem modo Accordion para isMobile)
```
