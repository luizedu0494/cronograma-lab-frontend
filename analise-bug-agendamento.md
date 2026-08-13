# 🐛 Análise de Bug — Formulário de Agendamento de Aula (CronoLab)

> Componente afetado: `GerenciarAulasAvancado.jsx` (ou equivalente de agendamento de aula)  
> Data da análise: Agosto/2026

---

## 📋 Sumário dos Problemas

| # | Problema | Gravidade | Componente |
|---|---|---|---|
| 1 | Laboratório anterior persiste ao trocar de data com "manter dados" | 🔴 Crítico | `formData.dynamicLabs` / `secao3` |
| 2 | Grade de disponibilidade mostra conflito falso (lab do agendamento anterior) | 🔴 Crítico | `GradeDisponibilidade.jsx` / `verificarDisponibilidade` |
| 3 | Seção 3 (Labs) é desbloqueada também pelo horário, não só pela data | 🟡 Médio | `secao2Completa` logic |

---

## 🔍 Diagnóstico Detalhado

---

### Bug #1 — Lab persiste ao trocar de data com "manter dados"

#### O que acontece

Quando o usuário usa a função **"manter dados"** para reaproveitar as informações de um agendamento anterior e depois seleciona uma nova data, o `formData.dynamicLabs` **não é resetado**. O laboratório do agendamento anterior permanece selecionado no estado.

#### Causa raiz no código

```js
// ProporEventoForm.jsx — estado inicial ao "manter dados"
const [formData, setFormData] = useState({
    titulo: '', descricao: '', tipo: EVENT_TYPES[0],
    dataInicio: safeDayjs(initialDate) || null,
    horarioSlotString: [],
    dynamicLabs: [{ tipo: '', laboratorios: [] }], // ← valores padrão limpos
});
```

O problema ocorre porque ao usar "manter dados", o `dynamicLabs` é copiado do formulário anterior e **nunca é limpo quando o usuário troca a data**. O `useEffect` que verifica disponibilidade reage a `formData.dataInicio` **e** `formData.dynamicLabs`, ou seja, ao trocar a data, ele vai verificar conflitos para o lab antigo na nova data — podendo mostrar "Livre" ou "Ocupado" com base em informações cruzadas.

#### Onde o bug se manifesta no useEffect

```js
// Este useEffect é disparado quando a data muda
// MAS ele usa formData.dynamicLabs, que ainda tem o lab do agendamento anterior
useEffect(() => {
    const verificarDisponibilidade = async () => {
        if (!secao2Completa && !eventoId) {
            setHorariosOcupados([]);
            return; // ← sai cedo, não limpa o lab selecionado
        }
        const laboratoriosParaVerificar = formData.dynamicLabs
            .flatMap(lab => lab.laboratorios)
            .filter(Boolean);
        // laboratoriosParaVerificar tem o lab ANTIGO aqui!
        ...
    };
}, [formData.dataInicio, formData.dynamicLabs, secao2Completa, eventoId]);
```

---

### Bug #2 — Grade de Disponibilidade mostra estado incorreto

#### O que acontece

A grade renderiza corretamente para o **primeiro** agendamento. Mas ao reutilizar o formulário ("manter dados") e trocar a data, a grade de disponibilidade na **Seção 2 (Data e Horário)** ainda exibe as células com base no laboratório pré-selecionado da sessão anterior. Isso pode:

- Mostrar células como "Ocupado" quando na nova data o lab está livre
- Ou o contrário: mostrar "Livre" quando na nova data já existe conflito

#### Causa raiz

O componente `GradeDisponibilidade` recebe `aulas` filtradas com base nos `laboratoriosParaVerificar`, que vêm do `dynamicLabs` desatualizado. A grade não tem como saber que o lab selecionado não é válido para a nova data.

---

### Bug #3 — Seção 3 desbloqueada pelo horário (não só pela data)

#### O que acontece

Atualmente a `secao2Completa` (que controla se a Seção 3 — Labs está desbloqueada) depende de:

```js
const labsCompletos = formData.dynamicLabs.every(
    lab => lab && lab.tipo !== '' && lab.laboratorios.length > 0
);
setSecao2Completa(labsCompletos && secao1Completa);
```

E a seção 3 é renderizada com base em `secao2Completa`:

```jsx
<Paper ... opacity={(!secao2Completa && !isEditMode) ? 0.8 : 1}>
    {!secao2Completa && !isEditMode && (
        <Alert severity="warning">
            <strong>Seção bloqueada!</strong> Complete a Seção 2 (Data e Horário) para desbloquear...
        </Alert>
    )}
```

O problema: a seção 3 deveria ser desbloqueada **somente quando a data for selecionada**, não quando o horário for escolhido. O horário deve ser selecionado **depois** da escolha do laboratório, pois a disponibilidade de horários depende do lab.

---

## ✅ Soluções Propostas

---

### Correção #1 e #2 — Limpar `dynamicLabs` ao trocar de data

Adicionar um `useEffect` dedicado que **reseta os laboratórios** toda vez que a data for alterada, **mas somente se não for modo de edição**:

```js
// NOVO useEffect — limpar labs ao trocar de data
useEffect(() => {
    if (isEditMode || !formData.dataInicio) return;

    // Limpa a seleção de laboratório e horário ao mudar a data
    setFormData(prev => ({
        ...prev,
        horarioSlotString: [],
        dynamicLabs: [{ tipo: '', laboratorios: [] }],
    }));

    // Limpa os horários ocupados para não mostrar dados antigos na grade
    setHorariosOcupados([]);

}, [formData.dataInicio]); // ← só reage à troca de data
```

> ⚠️ **Atenção**: certifique-se de que este `useEffect` vem **antes** do `useEffect` de verificação de disponibilidade no arquivo, para que a ordem de execução seja correta.

---

### Correção #3 — Desbloquear Seção 3 somente pela data

Criar um estado separado `secaoDataCompleta` que controla especificamente se a data foi selecionada:

```js
// Novo estado semântico
const [secaoDataCompleta, setSecaoDataCompleta] = useState(false);

// useEffect para detectar seleção de data
useEffect(() => {
    if (eventoId) {
        setSecaoDataCompleta(true);
        return;
    }
    setSecaoDataCompleta(!!formData.dataInicio && secao1Completa);
}, [formData.dataInicio, secao1Completa, eventoId]);
```

E usar `secaoDataCompleta` para desbloquear a Seção 3:

```jsx
// ANTES — desbloqueava pela seção de labs (secao2Completa)
<Paper ... opacity={(!secao2Completa && !isEditMode) ? 0.8 : 1}>
    {!secao2Completa && !isEditMode && (
        <Alert severity="warning">Seção bloqueada! Complete a Seção 2...</Alert>
    )}

// DEPOIS — desbloqueia pela data
<Paper ... opacity={(!secaoDataCompleta && !isEditMode) ? 0.8 : 1}>
    {!secaoDataCompleta && !isEditMode && (
        <Alert severity="warning">
            <strong>Seção bloqueada!</strong> Selecione uma data na Seção 2 para desbloquear.
        </Alert>
    )}
```

E manter o `secao2Completa` original para validação do formulário na hora de salvar (data + horário + labs preenchidos).

---

## 🗺️ Fluxo Correto Após as Correções

```
Seção 1 (Dados gerais)
    └─ Título + Tipo preenchidos → secao1Completa = true

Seção 2 (Data e Horário)
    └─ Data selecionada → secaoDataCompleta = true → desbloqueia Seção 3
    └─ Horário selecionado → (validação somente ao salvar)
    └─ Grade de disponibilidade mostra slots do dia selecionado

Seção 3 (Laboratórios) — desbloqueada APENAS pela data
    └─ Tipo + Lab selecionados → labs validados
    └─ Ao trocar de data → labs resetados automaticamente
    └─ secao2Completa = data + horário + labs → habilita "Agendar Aula"
```

---

## 📝 Resumo das Mudanças no Código

| Arquivo | Mudança | Motivo |
|---|---|---|
| `GerenciarAulasAvancado.jsx` | Adicionar `useEffect` que reseta `dynamicLabs` e `horarioSlotString` na troca de data | Fix bug #1 e #2 |
| `GerenciarAulasAvancado.jsx` | Criar `secaoDataCompleta` controlado apenas por `formData.dataInicio` | Fix bug #3 |
| `GerenciarAulasAvancado.jsx` | Trocar `secao2Completa` por `secaoDataCompleta` no gate da Seção 3 | Fix bug #3 |
| `GradeDisponibilidade.jsx` | Nenhuma mudança necessária — o componente já está correto; o problema é o estado que ele recebe | — |

---

## 🧪 Como Testar Após a Correção

1. Agende uma aula no **Microscopia 6**, Manhã 1, dia 12/11/2026
2. Use "manter dados" e abra novo agendamento
3. Troque a data para 13/11/2026
4. ✅ Os campos de laboratório devem estar **limpos** (não pré-selecionados)
5. ✅ A grade de disponibilidade deve mostrar os slots do dia 13/11 **sem** considerar o lab anterior
6. ✅ A Seção 3 deve desbloquear ao selecionar a data, **antes** de selecionar o horário

---

*Análise gerada com base na leitura do código-fonte de `GerenciarAulasAvancado.jsx` e `GradeDisponibilidade.jsx` do repositório CronoLab.*
