# Análise e Proposta de Melhoria — Verificar Integridade de Dados

> Componente atual: `src/pages/Gerenciar/VerificarIntegridadeDados.jsx`

---

## 1. Diagnóstico do estado atual

A tela hoje faz três coisas:

1. Busca **todas** as aulas com `getDocs(collection(db, "aulas"))` — sem filtro, sem paginação, sem limite.
2. Roda validações client-side por documento: `assunto`, `tipoAtividade`, `laboratorioSelecionado`, `cursos`, `propostoPorUid`, `dataInicio`.
3. Detecta conflitos de horário agrupando por `laboratorioSelecionado + dataInicio`.

Ao final, mostra dois blocos ("Dados Inválidos" e "Conflitos de Horário") com ação de editar ou excluir **um registro por vez**.

### 1.1 Causa raiz do problema relatado (dados antigos "fantasmas")

Comparando com como o restante do app lê os dados, ficou claro que **existem pelo menos dois schemas coexistindo** na coleção `aulas`:

| Consumidor | Campo de data usado | Campo de laboratório usado | Campo de título usado |
|---|---|---|---|
| `useAulasDia` (calendário do dia) | `data` (string `DD/MM/YYYY`) | — | — |
| `useFetchAulas` | `dataInicio` (Timestamp) | `laboratorio` **ou** `laboratorioSelecionado` | `disciplina` **ou** `assunto` |
| `VerificarIntegridadeDados` (atual) | `dataInicio` (Timestamp) | `laboratorioSelecionado` | `assunto` |

Isso explica exatamente o sintoma relatado: um documento de uma versão antiga do sistema pode:
- Não aparecer no calendário (porque o calendário depende de um campo que ele não tem, ex: `data` string ausente);
- Não ser sinalizado como erro na verificação atual (porque tem `dataInicio` preenchido e por acaso os outros campos passam na validação);
- Continuar sendo somado como ocupação em alguma consulta legada que ainda lê `laboratorio` em vez de `laboratorioSelecionado`.

Ou seja: **o dado não é "inválido" pelas regras atuais, é "órfão de versão"** — um conceito que a tela não verifica hoje.

### 1.2 Outras lacunas

- **Sem filtros**: não dá para isolar por laboratório, curso, período letivo ou intervalo de datas — tudo é jogado na mesma lista.
- **Sem noção de período letivo**: o sistema já tem `GerenciarPeriodos.jsx`, mas a verificação não cruza as aulas com o período ativo para saber se algo é "lixo" de um semestre encerrado.
- **Exclusão 1 a 1**: inviável quando o problema é uma limpeza de dezenas de registros de uma versão antiga.
- **Sem preview do dado bruto**: para investigar um caso estranho, o usuário ainda precisa abrir o Firebase Console.
- **Sem checagem de vínculos**: `propostoPorUid` e técnicos designados podem apontar para usuários que já foram removidos.
- **Sem paginação/custo controlado**: carregar a coleção inteira toda vez que a tela abre consome uma fatia grande do limite diário de leitura do plano Spark (50.000 leituras/dia, conforme `useUsageCounter.jsx`).
- **Sem trilha de auditoria própria**: exclusões feitas aqui não ficam registradas de forma diferenciada (o app já tem `UltimasExclusoesCard`, mas não fica claro se essa tela alimenta o mesmo log).

---

## 2. Proposta de melhoria

### 2.1 Nova categoria: "Dados Órfãos / Schema Legado"

Adicionar uma terceira categoria de verificação, além de "Dados Inválidos" e "Conflitos de Horário":

**Regras de detecção sugeridas:**
- Documento tem `data` (string) mas não tem `dataInicio` (Timestamp), ou vice-versa.
- Documento tem `laboratorio` preenchido mas não `laboratorioSelecionado` (ou o inverso).
- Documento tem `disciplina` preenchido mas não `assunto` (ou o inverso).
- `dataInicio` (quando existir) cai **fora de todos os períodos letivos cadastrados** em `GerenciarPeriodos` — forte indício de resíduo de semestre antigo.
- Documento não possui nenhum campo de status reconhecido pelo `useFetchAulas` (`status` ausente é tratado como `'agendada'` por padrão — isso mascara dados mortos como se estivessem ativos).

Cada item aqui deveria vir com um selo visual "🕓 Legado" e uma explicação curta do motivo técnico (qual campo é o culpado), para o usuário não precisar adivinhar.

### 2.2 Filtros

Adicionar uma barra de filtros no topo da tela, aplicados **depois** da busca (client-side, já que o volume de aulas costuma ser gerenciável) ou via `where()` quando fizer sentido:

- **Laboratório** (multi-select, usando `LISTA_LABORATORIOS`)
- **Curso** (multi-select, usando `LISTA_CURSOS`)
- **Tipo de atividade** (aula / revisão)
- **Categoria do problema** (Dados Inválidos / Conflitos / Órfãos-Legado / Vínculos Quebrados)
- **Período** (select alimentado por `GerenciarPeriodos`, com opção "Fora de qualquer período cadastrado")
- **Intervalo de datas customizado** (de/até)

Isso resolve diretamente o pedido de "filtros corretos, dados mais específicos".

### 2.3 Seleção múltipla e exclusão em massa

- Cada card passa a ter um checkbox.
- Botão "Selecionar todos os desta categoria" (por exemplo, todos os "Órfãos-Legado" filtrados).
- Ao clicar em "Excluir selecionados", abrir um **modal de dry-run**: lista simples com assunto/data/laboratório de cada item que será apagado, exigindo digitar a quantidade ou marcar "Confirmo que revisei a lista" antes de liberar o botão de exclusão definitiva.
- Excluir via `writeBatch` do Firestore (mais eficiente e atômico que `deleteDoc` em loop).

Isso resolve diretamente o pedido de "não precisar ir no Firebase deletar direto lá".

### 2.4 Inspeção de dado bruto

- Botão "Ver JSON" em cada card, abrindo um `Dialog` com o documento completo (`{ id, ...doc.data() }`) formatado, incluindo campos que a UI normalmente não mostra.
- Isso ajuda a confirmar rapidamente qual schema o registro está usando antes de decidir excluir ou corrigir.

### 2.5 Verificação de vínculos quebrados

- Cruzar `propostoPorUid` e técnicos designados com a coleção `usuarios`.
- Sinalizar como "Vínculo quebrado" quando o UID referenciado não existir mais.

### 2.6 Duplicatas

- Agrupar por `laboratorioSelecionado + dataInicio + assunto` (ou `disciplina`) e sinalizar grupos com mais de um documento idêntico — comum em reimportações de cronograma.

### 2.7 Performance e custo de leitura

- Trocar a busca "tudo de uma vez" por paginação (`limit` + `startAfter`) ou, no mínimo, mostrar um aviso do número de leituras que a verificação completa vai consumir, reaproveitando `incrementCriticalReads`/`useUsageCounter` que o projeto já tem.
- Cachear o resultado da última verificação (com timestamp "última verificação em: ...") para não forçar nova leitura completa toda vez que o usuário só quer olhar o resultado anterior.

### 2.8 Exportar relatório

- Botão "Exportar CSV/JSON" com o resultado da verificação (reaproveitando padrão já usado em `DownloadCronograma.jsx`), útil para levar o achado para outra pessoa da coordenação sem precisar printar tela.

### 2.9 Auditoria

- Toda exclusão feita nesta tela grava um documento em uma subcoleção `logs/exclusoesIntegridade` (usuário, data, motivo = categoria detectada, snapshot do documento excluído) — permite desfazer manualmente em caso de engano e dá rastreabilidade.

---

## 3. Resumo visual da nova estrutura da tela

```
[ Cabeçalho: "Diagnóstico e Integridade de Dados" ]

[ Barra de Filtros: Laboratório | Curso | Tipo | Período | Categoria | Intervalo de datas ]

[ Cards de resumo: Verificadas | Inválidas | Conflitos | Órfãs/Legado | Vínculos quebrados | Duplicatas ]

[ Botão: Selecionar todos (categoria atual) ]   [ Botão: Excluir selecionados ]   [ Botão: Exportar relatório ]

[ Lista de resultados agrupada por categoria, cada card com:
    - Checkbox de seleção
    - Resumo do problema + selo da categoria
    - Botão "Ver JSON"
    - Botão "Edição completa"
    - Botão "Excluir" (individual)
]

[ Modal de dry-run antes de exclusão em massa ]
[ Modal de edição rápida (já existente) ]
```

---

## 4. Prioridade sugerida de implementação

1. **Alta** — Categoria "Órfãos / Schema Legado" (resolve diretamente o problema relatado)
2. **Alta** — Seleção múltipla + exclusão em massa com dry-run
3. **Média** — Filtros (laboratório, curso, período, categoria)
4. **Média** — Inspeção de JSON bruto
5. **Baixa** — Duplicatas, vínculos quebrados, exportação, auditoria dedicada
