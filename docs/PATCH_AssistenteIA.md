# Patch: AssistenteIA — Suporte a Provas

## O que fazer

No arquivo `AssistenteIA.jsx`, localize onde o **system prompt** é construído
(geralmente uma string longa ou uma função `buildSystemPrompt` / `getSystemPrompt`).

Adicione o trecho abaixo **dentro** do prompt de sistema, na seção que descreve
os tipos de atividade ou a estrutura dos dados:

---

### Trecho a adicionar no system prompt

```
## Tipos de atividade no cronograma

Cada documento na coleção `aulas` pode ter os seguintes campos de classificação:

- `isProva: true/false` — indica se a atividade é uma **prova** (avaliação formal).
  Provas aparecem com borda vermelha e chip "📝 Prova" no calendário.

- `isRevisao: true/false` — indica se é uma **revisão ou aula de reforço**.
  Revisões aparecem com borda roxa e chip "📖 [tipo]" no calendário.
  O campo `tipoRevisao` guarda o subtipo: 'revisao_conteudo', 'revisao_pre_prova',
  'aula_reforco', 'pratica_extra', 'monitoria', 'outro'.

- Se ambos forem false (ou ausentes), é uma **aula normal**.

Quando o usuário perguntar sobre provas, filtre por `isProva === true`.
Quando perguntar sobre revisões, filtre por `isRevisao === true && !isProva`.
Quando perguntar sobre aulas normais, filtre por `!isProva && !isRevisao`.

Exemplos de perguntas e como responder:
- "Quantas provas tivemos esse mês?" → contar docs com isProva=true no período
- "Quais laboratórios tiveram mais provas?" → agrupar por laboratorioSelecionado onde isProva=true
- "Há alguma prova essa semana?" → filtrar por isProva=true e dataInicio na semana atual
- "Quais cursos têm mais provas agendadas?" → agrupar por cursos onde isProva=true
```

---

### Onde localizar no código

Procure por uma das seguintes strings no arquivo:

```js
// Opção 1 — constante de sistema
const SYSTEM_PROMPT = `...`

// Opção 2 — função construtora
const buildSystemPrompt = (dados) => `...`

// Opção 3 — dentro do fetch/axios para a API
{ role: 'system', content: `...` }
```

Adicione o trecho acima **antes** da seção final do prompt (geralmente onde diz
"responda sempre em português" ou similar).

---

### Também verificar: dados enviados para a IA

Se o componente busca aulas do Firestore para enviar como contexto,
certifique-se de que o campo `isProva` está incluído na query e no
objeto enviado. Por exemplo:

```js
// Ao montar o contexto de aulas para enviar à IA:
const dadosParaIA = aulas.map(a => ({
  assunto: a.assunto,
  data: ...,
  laboratorio: a.laboratorioSelecionado,
  cursos: a.cursos,
  horario: a.horarioSlotString,
  status: a.status,
  isProva: a.isProva || false,       // ← adicionar
  isRevisao: a.isRevisao || false,   // ← já deve existir
  tipoRevisao: a.tipoRevisao || null,
}));
```
